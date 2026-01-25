use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Write};
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
}

pub struct ProcessHandle {
    child: Child,
}

impl ProcessHandle {
    /// Spawn Claude in print mode (-p) for one-shot tasks
    /// This runs the prompt and exits when complete
    pub fn spawn_claude_print(working_dir: &str, prompt: &str) -> Result<Self, SpawnerError> {
        let mut cmd = Command::new("claude");

        cmd.arg("-p")
            .arg(prompt)
            .arg("--dangerously-skip-permissions") // Allow automated execution
            .current_dir(working_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd.spawn().map_err(|e| SpawnerError::SpawnError(e.to_string()))?;
        Ok(Self { child })
    }

    /// Spawn Claude in interactive mode for ongoing conversations
    /// Use write() to send messages and read stdout for responses
    pub fn spawn_claude_interactive(working_dir: &str) -> Result<Self, SpawnerError> {
        let mut cmd = Command::new("claude");

        cmd.arg("--dangerously-skip-permissions") // Allow automated execution
            .current_dir(working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd.spawn().map_err(|e| SpawnerError::SpawnError(e.to_string()))?;
        Ok(Self { child })
    }

    /// Legacy method - defaults to print mode for backwards compatibility
    pub fn spawn_claude(working_dir: &str, initial_prompt: Option<&str>) -> Result<Self, SpawnerError> {
        match initial_prompt {
            Some(prompt) => Self::spawn_claude_print(working_dir, prompt),
            None => Self::spawn_claude_interactive(working_dir),
        }
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), SpawnerError> {
        if let Some(ref mut stdin) = self.child.stdin {
            stdin.write_all(data).map_err(|e| SpawnerError::IoError(e.to_string()))?;
            stdin.flush().map_err(|e| SpawnerError::IoError(e.to_string()))?;
            Ok(())
        } else {
            Err(SpawnerError::NotRunning)
        }
    }

    pub fn kill(&mut self) -> Result<(), SpawnerError> {
        self.child.kill().map_err(|e| SpawnerError::IoError(e.to_string()))
    }

    pub fn try_wait(&mut self) -> Result<Option<std::process::ExitStatus>, SpawnerError> {
        self.child.try_wait().map_err(|e| SpawnerError::IoError(e.to_string()))
    }

    pub fn take_stdout(&mut self) -> Option<std::process::ChildStdout> {
        self.child.stdout.take()
    }

    pub fn take_stderr(&mut self) -> Option<std::process::ChildStderr> {
        self.child.stderr.take()
    }

    pub fn id(&self) -> u32 {
        self.child.id()
    }
}

pub fn start_output_reader<R: std::io::Read + Send + 'static>(
    reader: R,
    tx: mpsc::UnboundedSender<Vec<u8>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buf_reader = BufReader::new(reader);
        let mut line = String::new();

        loop {
            line.clear();
            match buf_reader.read_line(&mut line) {
                Ok(0) => break, // EOF
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
