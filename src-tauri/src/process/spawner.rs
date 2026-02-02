use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::env;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use thiserror::Error;
use tokio::sync::mpsc;

#[derive(Error, Debug)]
pub enum SpawnerError {
    #[error("Failed to spawn process: {0}")]
    SpawnError(String),
    #[error("Failed to get reader/writer: {0}")]
    IoError(String),
    #[error("Process not running")]
    NotRunning,
    #[error("Claude CLI not found: {0}")]
    ClaudeNotFound(String),
}

/// Find the claude CLI executable
fn find_claude_path() -> Option<String> {
    // First try PATH using 'which'
    if let Ok(output) = std::process::Command::new("which").arg("claude").output() {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                let path = path.trim();
                if !path.is_empty() {
                    return Some(path.to_string());
                }
            }
        }
    }

    // Check common locations
    let home = env::var("HOME").unwrap_or_default();
    let common_paths = [
        format!("{}/.local/bin/claude", home),
        "/usr/local/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
        format!("{}/.npm-global/bin/claude", home),
    ];

    for path in &common_paths {
        if std::path::Path::new(path).exists() {
            return Some(path.clone());
        }
    }

    // Try nvm paths with glob
    let nvm_pattern = format!("{}/.nvm/versions/node/*/bin/claude", home);
    if let Ok(entries) = glob::glob(&nvm_pattern) {
        for entry in entries.flatten() {
            if entry.exists() {
                return Some(entry.to_string_lossy().to_string());
            }
        }
    }

    None
}

/// A handle to a Claude Code terminal session running in a PTY
pub struct PtyHandle {
    pty_pair: PtyPair,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    pid: u32,
}

impl PtyHandle {
    /// Spawn Claude Code in an interactive PTY session
    pub fn spawn_claude_pty(
        working_dir: &str,
        initial_prompt: Option<&str>,
    ) -> Result<Self, SpawnerError> {
        let claude_path = find_claude_path().ok_or_else(|| {
            SpawnerError::ClaudeNotFound(
                "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
                    .to_string(),
            )
        })?;

        log::info!("Spawning Claude Code PTY at: {}", claude_path);

        // Create PTY system
        let pty_system = native_pty_system();

        // Create PTY pair with reasonable terminal size
        let pty_pair = pty_system
            .openpty(PtySize {
                rows: 40,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| SpawnerError::SpawnError(format!("Failed to create PTY: {}", e)))?;

        // Build command
        let mut cmd = CommandBuilder::new(&claude_path);

        // Add initial prompt if provided - use print mode for streaming output
        if let Some(prompt) = initial_prompt {
            // Use -p (print mode) for streaming text output without TUI
            cmd.arg("-p");
            cmd.arg(prompt);
            // Skip permission prompts for autonomous operation
            cmd.arg("--dangerously-skip-permissions");
        }

        // Set working directory
        cmd.cwd(working_dir);

        // Set up environment
        let home = env::var("HOME").unwrap_or_default();
        let current_path = env::var("PATH").unwrap_or_default();
        let enhanced_path = format!(
            "{}:{}/.local/bin:{}/.nvm/versions/node/v22.0.0/bin:/usr/local/bin:/usr/bin",
            current_path, home, home
        );

        cmd.env("PATH", enhanced_path);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        if let Ok(key) = env::var("ANTHROPIC_API_KEY") {
            cmd.env("ANTHROPIC_API_KEY", key);
        }

        // Spawn the child process in the PTY
        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| SpawnerError::SpawnError(format!("Failed to spawn claude: {}", e)))?;

        let pid = child.process_id().unwrap_or(0);
        log::info!("Claude Code PTY spawned with PID: {}", pid);

        // Get writer for sending input
        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| SpawnerError::IoError(format!("Failed to get PTY writer: {}", e)))?;

        Ok(Self {
            pty_pair,
            writer: Arc::new(Mutex::new(writer)),
            child,
            pid,
        })
    }

    /// Get the process ID
    pub fn id(&self) -> u32 {
        self.pid
    }

    /// Take the PTY reader for streaming output
    pub fn take_reader(&self) -> Result<Box<dyn Read + Send>, SpawnerError> {
        self.pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| SpawnerError::IoError(format!("Failed to clone PTY reader: {}", e)))
    }

    /// Send input to the Claude Code session
    pub fn write(&self, data: &[u8]) -> Result<(), SpawnerError> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|e| SpawnerError::IoError(format!("Lock error: {}", e)))?;
        writer
            .write_all(data)
            .map_err(|e| SpawnerError::IoError(format!("Write error: {}", e)))?;
        writer
            .flush()
            .map_err(|e| SpawnerError::IoError(format!("Flush error: {}", e)))?;
        Ok(())
    }

    /// Send a line of input (adds newline)
    pub fn send_line(&self, line: &str) -> Result<(), SpawnerError> {
        self.write(format!("{}\n", line).as_bytes())
    }

    /// Check if the process is still running
    pub fn try_wait(&mut self) -> Result<Option<portable_pty::ExitStatus>, SpawnerError> {
        self.child
            .try_wait()
            .map_err(|e| SpawnerError::IoError(format!("Wait error: {}", e)))
    }

    /// Kill the process
    pub fn kill(&mut self) -> Result<(), SpawnerError> {
        self.child
            .kill()
            .map_err(|e| SpawnerError::IoError(format!("Kill error: {}", e)))
    }

    /// Resize the PTY
    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), SpawnerError> {
        self.pty_pair
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| SpawnerError::IoError(format!("Resize error: {}", e)))
    }

    /// Get an Arc to the writer for async use
    pub fn writer_handle(&self) -> Arc<Mutex<Box<dyn Write + Send>>> {
        self.writer.clone()
    }
}

/// Start reading from a PTY and sending output through a channel
pub fn start_pty_reader(
    mut reader: Box<dyn Read + Send>,
    tx: mpsc::UnboundedSender<Vec<u8>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        log::debug!("PTY reader thread started");
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    if tx.send(buffer[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    log::error!("PTY read error: {}", e);
                    break;
                }
            }
        }
        log::debug!("PTY reader thread finished");
    })
}

// ============================================================================
// Legacy Process Handle (for backwards compatibility)
// ============================================================================

use std::process::{Child, Command, Stdio};

pub struct ProcessHandle {
    child: Option<Child>,
}

impl ProcessHandle {
    /// Legacy: Spawn Claude in print mode
    pub fn spawn_claude_print(working_dir: &str, prompt: &str) -> Result<Self, SpawnerError> {
        let claude_path = find_claude_path().ok_or_else(|| {
            SpawnerError::ClaudeNotFound(
                "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
                    .to_string(),
            )
        })?;

        let home = env::var("HOME").unwrap_or_default();
        let current_path = env::var("PATH").unwrap_or_default();
        let enhanced_path = format!(
            "{}:{}/.local/bin:{}/.nvm/versions/node/v22.0.0/bin:/usr/local/bin",
            current_path, home, home
        );

        let mut cmd = Command::new(&claude_path);
        cmd.arg("-p")
            .arg(prompt)
            .arg("--dangerously-skip-permissions")
            .current_dir(working_dir)
            .env("PATH", enhanced_path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd
            .spawn()
            .map_err(|e| SpawnerError::SpawnError(format!("Failed to spawn: {}", e)))?;
        Ok(Self { child: Some(child) })
    }

    /// Legacy: Spawn Claude interactive (use PtyHandle instead for real terminal)
    pub fn spawn_claude_interactive(working_dir: &str) -> Result<Self, SpawnerError> {
        let claude_path = find_claude_path().ok_or_else(|| {
            SpawnerError::ClaudeNotFound(
                "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
                    .to_string(),
            )
        })?;

        let home = env::var("HOME").unwrap_or_default();
        let current_path = env::var("PATH").unwrap_or_default();
        let enhanced_path = format!(
            "{}:{}/.local/bin:{}/.nvm/versions/node/v22.0.0/bin:/usr/local/bin",
            current_path, home, home
        );

        let mut cmd = Command::new(&claude_path);
        cmd.arg("--dangerously-skip-permissions")
            .current_dir(working_dir)
            .env("PATH", enhanced_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd
            .spawn()
            .map_err(|e| SpawnerError::SpawnError(format!("Failed to spawn: {}", e)))?;
        Ok(Self { child: Some(child) })
    }

    /// Legacy method - now uses PTY for proper terminal emulation
    pub fn spawn_claude(working_dir: &str, initial_prompt: Option<&str>) -> Result<Self, SpawnerError> {
        match initial_prompt {
            Some(prompt) => Self::spawn_claude_print(working_dir, prompt),
            None => Self::spawn_claude_interactive(working_dir),
        }
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), SpawnerError> {
        if let Some(ref mut child) = self.child {
            if let Some(ref mut stdin) = child.stdin {
                stdin
                    .write_all(data)
                    .map_err(|e| SpawnerError::IoError(e.to_string()))?;
                stdin
                    .flush()
                    .map_err(|e| SpawnerError::IoError(e.to_string()))?;
                return Ok(());
            }
        }
        Err(SpawnerError::NotRunning)
    }

    pub fn kill(&mut self) -> Result<(), SpawnerError> {
        if let Some(ref mut child) = self.child {
            child
                .kill()
                .map_err(|e| SpawnerError::IoError(e.to_string()))
        } else {
            Err(SpawnerError::NotRunning)
        }
    }

    pub fn try_wait(&mut self) -> Result<Option<std::process::ExitStatus>, SpawnerError> {
        if let Some(ref mut child) = self.child {
            child
                .try_wait()
                .map_err(|e| SpawnerError::IoError(e.to_string()))
        } else {
            Err(SpawnerError::NotRunning)
        }
    }

    pub fn take_stdout(&mut self) -> Option<std::process::ChildStdout> {
        self.child.as_mut().and_then(|c| c.stdout.take())
    }

    pub fn take_stderr(&mut self) -> Option<std::process::ChildStderr> {
        self.child.as_mut().and_then(|c| c.stderr.take())
    }

    pub fn id(&self) -> u32 {
        self.child.as_ref().map(|c| c.id()).unwrap_or(0)
    }

    pub fn take_child(&mut self) -> Child {
        self.child.take().expect("Child process already taken")
    }
}

pub fn start_output_reader<R: std::io::Read + Send + 'static>(
    reader: R,
    tx: mpsc::UnboundedSender<Vec<u8>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buf_reader = std::io::BufReader::new(reader);
        let mut line = String::new();
        use std::io::BufRead;

        loop {
            line.clear();
            match buf_reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    if tx.send(line.as_bytes().to_vec()).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    })
}
