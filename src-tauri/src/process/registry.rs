use dashmap::DashMap;
use parking_lot::RwLock;
use std::io::Write;
use std::process::Child;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use uuid::Uuid;

use std::sync::Mutex;

/// PTY writer handle type
pub type PtyWriter = Arc<Mutex<Box<dyn Write + Send>>>;

/// Stores process handles and output buffers for agents
pub struct AgentRegistry {
    /// Process handles keyed by agent ID
    processes: DashMap<Uuid, AgentProcess>,
    /// Output buffers for collecting agent output
    output_buffers: DashMap<Uuid, Arc<RwLock<String>>>,
    /// Completion notifiers
    completion_channels: DashMap<Uuid, Vec<oneshot::Sender<AgentCompletion>>>,
    /// Agent configurations for restart capability
    configs: DashMap<Uuid, super::manager::AgentConfig>,
    /// Agent start times for timeout tracking
    start_times: DashMap<Uuid, Instant>,
    /// PTY writers for sending input to PTY-based agents
    pty_writers: DashMap<Uuid, PtyWriter>,
}

pub struct AgentProcess {
    pub child: Option<Child>,
    pub pid: u32,
    pub stdin: Option<std::process::ChildStdin>,
}

#[derive(Debug, Clone)]
pub struct AgentCompletion {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            processes: DashMap::new(),
            output_buffers: DashMap::new(),
            completion_channels: DashMap::new(),
            configs: DashMap::new(),
            start_times: DashMap::new(),
            pty_writers: DashMap::new(),
        }
    }

    /// Register a PTY-based agent (no Child process, just tracking)
    pub fn register_pty_agent(&self, agent_id: Uuid, pid: u32) {
        // Create a placeholder process entry for PTY agents
        self.processes.insert(
            agent_id,
            AgentProcess {
                child: None,
                pid,
                stdin: None,
            },
        );
        self.output_buffers
            .insert(agent_id, Arc::new(RwLock::new(String::new())));
        self.start_times.insert(agent_id, Instant::now());
        log::info!("Registered PTY agent {} with pid {}", agent_id, pid);
    }

    /// Store a PTY writer for sending input to a PTY-based agent
    pub fn store_pty_writer(&self, agent_id: Uuid, writer: PtyWriter) {
        self.pty_writers.insert(agent_id, writer);
    }

    /// Get PTY writer for an agent
    pub fn get_pty_writer(&self, agent_id: &Uuid) -> Option<PtyWriter> {
        self.pty_writers.get(agent_id).map(|w| w.clone())
    }

    /// Send input to agent via PTY (preferred) or stdin
    pub fn send_pty_input(&self, agent_id: &Uuid, input: &str) -> Result<(), String> {
        // First try PTY writer
        if let Some(writer) = self.pty_writers.get(agent_id) {
            let mut guard = writer
                .lock()
                .map_err(|e| format!("Failed to lock PTY writer: {}", e))?;
            guard
                .write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            guard
                .write_all(b"\n")
                .map_err(|e| format!("Failed to write newline to PTY: {}", e))?;
            guard
                .flush()
                .map_err(|e| format!("Failed to flush PTY: {}", e))?;
            log::info!("Sent PTY input to agent {}: {}", agent_id, input);
            return Ok(());
        }

        // Fall back to stdin for legacy processes
        self.send_input(agent_id, input)
    }

    /// Register a new agent process
    pub fn register(&self, agent_id: Uuid, mut child: Child, pid: u32) {
        let stdin = child.stdin.take();
        self.processes.insert(
            agent_id,
            AgentProcess {
                child: Some(child),
                pid,
                stdin,
            },
        );
        self.output_buffers
            .insert(agent_id, Arc::new(RwLock::new(String::new())));
        self.start_times.insert(agent_id, Instant::now());
    }

    /// Store agent config for potential restart
    pub fn store_config(&self, agent_id: Uuid, config: super::manager::AgentConfig) {
        self.configs.insert(agent_id, config);
    }

    /// Get stored config for restart
    pub fn get_config(&self, agent_id: &Uuid) -> Option<super::manager::AgentConfig> {
        self.configs.get(agent_id).map(|c| c.clone())
    }

    /// Send input to agent's stdin
    pub fn send_input(&self, agent_id: &Uuid, input: &str) -> Result<(), String> {
        if let Some(mut entry) = self.processes.get_mut(agent_id) {
            if let Some(ref mut stdin) = entry.stdin {
                stdin
                    .write_all(input.as_bytes())
                    .map_err(|e| format!("Failed to write to stdin: {}", e))?;
                stdin
                    .write_all(b"\n")
                    .map_err(|e| format!("Failed to write newline: {}", e))?;
                stdin
                    .flush()
                    .map_err(|e| format!("Failed to flush stdin: {}", e))?;
                log::info!("Sent input to agent {}: {}", agent_id, input);
                return Ok(());
            }
            return Err("Agent stdin not available (running in print mode?)".to_string());
        }
        Err("Agent not found".to_string())
    }

    /// Check if agent has exceeded timeout
    pub fn check_timeout(&self, agent_id: &Uuid, timeout: Duration) -> bool {
        self.start_times
            .get(agent_id)
            .map(|start| start.elapsed() > timeout)
            .unwrap_or(false)
    }

    /// Get agent runtime duration
    pub fn get_runtime(&self, agent_id: &Uuid) -> Option<Duration> {
        self.start_times.get(agent_id).map(|start| start.elapsed())
    }

    /// Get the output buffer for an agent (for appending output)
    pub fn get_output_buffer(&self, agent_id: &Uuid) -> Option<Arc<RwLock<String>>> {
        self.output_buffers.get(agent_id).map(|b| b.clone())
    }

    /// Get the collected output for an agent
    pub fn get_output(&self, agent_id: &Uuid) -> Option<String> {
        self.output_buffers
            .get(agent_id)
            .map(|b| b.read().clone())
    }

    /// Append output to an agent's buffer
    pub fn append_output(&self, agent_id: &Uuid, output: &str) {
        if let Some(buffer) = self.output_buffers.get(agent_id) {
            buffer.write().push_str(output);
        }
    }

    /// Kill an agent's process with graceful shutdown
    /// Sends SIGTERM first, waits briefly, then SIGKILL if still running
    pub fn kill(&self, agent_id: &Uuid) -> bool {
        self.kill_graceful(agent_id, Duration::from_secs(2))
    }

    /// Kill with configurable grace period
    pub fn kill_graceful(&self, agent_id: &Uuid, grace_period: Duration) -> bool {
        if let Some(mut entry) = self.processes.get_mut(agent_id) {
            let pid = entry.pid;

            // First try SIGTERM for graceful shutdown
            #[cfg(unix)]
            {
                use std::process::Command;
                log::info!("Sending SIGTERM to agent {} (pid {})", agent_id, pid);
                let _ = Command::new("kill")
                    .arg("-TERM")
                    .arg(pid.to_string())
                    .output();

                // Wait for grace period
                std::thread::sleep(grace_period);

                // Check if still running
                if let Some(ref mut child) = entry.child {
                    match child.try_wait() {
                        Ok(Some(_)) => {
                            log::info!("Agent {} terminated gracefully", agent_id);
                            return true;
                        }
                        Ok(None) => {
                            // Still running, force kill
                            log::info!("Agent {} didn't terminate, sending SIGKILL", agent_id);
                            match child.kill() {
                                Ok(_) => {
                                    log::info!("Force killed agent {}", agent_id);
                                    return true;
                                }
                                Err(e) => {
                                    log::error!("Failed to kill agent {}: {}", agent_id, e);
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("Error checking agent {} status: {}", agent_id, e);
                        }
                    }
                }
            }

            #[cfg(not(unix))]
            {
                // On non-Unix, just kill directly
                if let Some(ref mut child) = entry.child {
                    match child.kill() {
                        Ok(_) => {
                            log::info!("Killed agent process {}", agent_id);
                            return true;
                        }
                        Err(e) => {
                            log::error!("Failed to kill agent {}: {}", agent_id, e);
                        }
                    }
                }
            }
        }
        false
    }

    /// Check if a process has exited
    pub fn try_wait(&self, agent_id: &Uuid) -> Option<bool> {
        if let Some(mut entry) = self.processes.get_mut(agent_id) {
            if let Some(ref mut child) = entry.child {
                match child.try_wait() {
                    Ok(Some(status)) => return Some(status.success()),
                    Ok(None) => return None, // Still running
                    Err(_) => return Some(false),
                }
            }
        }
        Some(false)
    }

    /// Remove an agent from the registry (full cleanup)
    pub fn remove(&self, agent_id: &Uuid) {
        self.processes.remove(agent_id);
        self.output_buffers.remove(agent_id);
        self.completion_channels.remove(agent_id);
        self.configs.remove(agent_id);
        self.start_times.remove(agent_id);
        self.pty_writers.remove(agent_id);
    }

    /// Cleanup completed/failed agents older than the specified duration
    pub fn cleanup_old_agents(&self, max_age: Duration) -> Vec<Uuid> {
        let mut removed = Vec::new();
        let to_remove: Vec<Uuid> = self
            .start_times
            .iter()
            .filter(|entry| entry.value().elapsed() > max_age)
            .filter(|entry| {
                // Only remove if process has exited
                self.try_wait(entry.key()).is_some()
            })
            .map(|entry| *entry.key())
            .collect();

        for id in to_remove {
            self.remove(&id);
            removed.push(id);
            log::info!("Cleaned up old agent {}", id);
        }
        removed
    }

    /// Get list of all registered agent IDs
    pub fn list_agents(&self) -> Vec<Uuid> {
        self.processes.iter().map(|entry| *entry.key()).collect()
    }

    /// Check if an agent is registered
    pub fn contains(&self, agent_id: &Uuid) -> bool {
        self.processes.contains_key(agent_id)
    }

    /// Subscribe to agent completion
    pub fn subscribe_completion(&self, agent_id: Uuid) -> oneshot::Receiver<AgentCompletion> {
        let (tx, rx) = oneshot::channel();
        self.completion_channels
            .entry(agent_id)
            .or_insert_with(Vec::new)
            .push(tx);
        rx
    }

    /// Notify that an agent has completed
    pub fn notify_completion(&self, agent_id: &Uuid, completion: AgentCompletion) {
        if let Some((_, channels)) = self.completion_channels.remove(agent_id) {
            for tx in channels {
                let _ = tx.send(completion.clone());
            }
        }
    }

    /// Get PID for an agent
    pub fn get_pid(&self, agent_id: &Uuid) -> Option<u32> {
        self.processes.get(agent_id).map(|p| p.pid)
    }

    /// Pause an agent's process (SIGSTOP on Unix)
    #[cfg(unix)]
    pub fn pause(&self, agent_id: &Uuid) -> Result<(), String> {
        if let Some(entry) = self.processes.get(agent_id) {
            let pid = entry.pid;
            use std::process::Command;
            Command::new("kill")
                .arg("-STOP")
                .arg(pid.to_string())
                .output()
                .map_err(|e| format!("Failed to pause agent: {}", e))?;
            log::info!("Paused agent {} (pid {})", agent_id, pid);
            Ok(())
        } else {
            Err("Agent not found".to_string())
        }
    }

    #[cfg(not(unix))]
    pub fn pause(&self, agent_id: &Uuid) -> Result<(), String> {
        Err("Pause not supported on this platform".to_string())
    }

    /// Resume a paused agent's process (SIGCONT on Unix)
    #[cfg(unix)]
    pub fn resume(&self, agent_id: &Uuid) -> Result<(), String> {
        if let Some(entry) = self.processes.get(agent_id) {
            let pid = entry.pid;
            use std::process::Command;
            Command::new("kill")
                .arg("-CONT")
                .arg(pid.to_string())
                .output()
                .map_err(|e| format!("Failed to resume agent: {}", e))?;
            log::info!("Resumed agent {} (pid {})", agent_id, pid);
            Ok(())
        } else {
            Err("Agent not found".to_string())
        }
    }

    #[cfg(not(unix))]
    pub fn resume(&self, agent_id: &Uuid) -> Result<(), String> {
        Err("Resume not supported on this platform".to_string())
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// Global registry instance
lazy_static::lazy_static! {
    pub static ref AGENT_REGISTRY: AgentRegistry = AgentRegistry::new();
}
