//! Resource management for controlling agent execution.
//!
//! Provides:
//! - Concurrent agent limits
//! - Task queuing with priorities
//! - Rate limiting
//! - Resource pools

use chrono::{DateTime, Utc};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use uuid::Uuid;

/// Configuration for resource management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceConfig {
    /// Maximum concurrent agents
    pub max_concurrent_agents: u32,
    /// Maximum agents per role
    pub max_agents_per_role: HashMap<String, u32>,
    /// Queue size limit
    pub max_queue_size: usize,
    /// Rate limit: max requests per minute
    pub rate_limit_per_minute: Option<u32>,
    /// Timeout for acquiring resources (ms)
    pub acquire_timeout_ms: u64,
    /// Enable priority queuing
    pub enable_priority_queue: bool,
}

impl Default for ResourceConfig {
    fn default() -> Self {
        Self {
            max_concurrent_agents: 5,
            max_agents_per_role: HashMap::new(),
            max_queue_size: 100,
            rate_limit_per_minute: Some(60),
            acquire_timeout_ms: 30000,
            enable_priority_queue: true,
        }
    }
}

impl ResourceConfig {
    /// Configuration for high-throughput scenarios
    pub fn high_throughput() -> Self {
        Self {
            max_concurrent_agents: 10,
            max_agents_per_role: HashMap::new(),
            max_queue_size: 500,
            rate_limit_per_minute: Some(120),
            acquire_timeout_ms: 60000,
            enable_priority_queue: true,
        }
    }

    /// Configuration for resource-constrained environments
    pub fn conservative() -> Self {
        Self {
            max_concurrent_agents: 2,
            max_agents_per_role: HashMap::new(),
            max_queue_size: 50,
            rate_limit_per_minute: Some(30),
            acquire_timeout_ms: 60000,
            enable_priority_queue: true,
        }
    }
}

/// Priority levels for queued tasks
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for TaskPriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// A queued task waiting for resources
#[derive(Debug, Clone)]
pub struct QueuedTask {
    pub id: Uuid,
    pub execution_id: Uuid,
    pub node_id: String,
    pub agent_role: String,
    pub priority: TaskPriority,
    pub queued_at: DateTime<Utc>,
    pub estimated_duration_ms: Option<u64>,
}

impl PartialEq for QueuedTask {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for QueuedTask {}

impl PartialOrd for QueuedTask {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QueuedTask {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Higher priority first, then older tasks first
        match self.priority.cmp(&other.priority) {
            std::cmp::Ordering::Equal => other.queued_at.cmp(&self.queued_at),
            ord => ord.reverse(), // Reverse for max-heap behavior
        }
    }
}

/// Resource manager for controlling agent execution
#[allow(dead_code)]
pub struct ResourceManager {
    config: ResourceConfig,
    /// Semaphore for overall concurrency limit
    concurrency_semaphore: Arc<Semaphore>,
    /// Per-role semaphores (reserved for future role-based limiting)
    role_semaphores: Mutex<HashMap<String, Arc<Semaphore>>>,
    /// Priority queue for waiting tasks
    task_queue: Mutex<BinaryHeap<QueuedTask>>,
    /// Current active agents count
    active_agents: AtomicU32,
    /// Per-role active counts
    active_per_role: Mutex<HashMap<String, u32>>,
    /// Rate limiter state
    rate_limiter: RateLimiter,
    /// Statistics
    stats: ResourceStats,
}

impl ResourceManager {
    pub fn new(config: ResourceConfig) -> Self {
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent_agents as usize));

        Self {
            concurrency_semaphore: semaphore,
            role_semaphores: Mutex::new(HashMap::new()),
            task_queue: Mutex::new(BinaryHeap::new()),
            active_agents: AtomicU32::new(0),
            active_per_role: Mutex::new(HashMap::new()),
            rate_limiter: RateLimiter::new(config.rate_limit_per_minute),
            stats: ResourceStats::new(),
            config,
        }
    }

    /// Try to acquire resources for an agent
    pub async fn acquire(
        &self,
        _execution_id: Uuid,
        _node_id: &str,
        agent_role: &str,
        _priority: TaskPriority,
    ) -> Result<ResourcePermit, ResourceError> {
        // Check rate limit
        if !self.rate_limiter.try_acquire() {
            return Err(ResourceError::RateLimited);
        }

        // Check queue size
        {
            let queue = self.task_queue.lock();
            if queue.len() >= self.config.max_queue_size {
                self.stats.rejected.fetch_add(1, Ordering::Relaxed);
                return Err(ResourceError::QueueFull);
            }
        }

        // Try to get a permit with timeout
        let timeout = std::time::Duration::from_millis(self.config.acquire_timeout_ms);

        let permit = match tokio::time::timeout(
            timeout,
            self.concurrency_semaphore.clone().acquire_owned(),
        ).await {
            Ok(Ok(permit)) => permit,
            Ok(Err(_)) => return Err(ResourceError::SemaphoreClosed),
            Err(_) => {
                self.stats.timeouts.fetch_add(1, Ordering::Relaxed);
                return Err(ResourceError::Timeout);
            }
        };

        // Check role-specific limit
        if let Some(&max) = self.config.max_agents_per_role.get(agent_role) {
            let mut active = self.active_per_role.lock();
            let current = active.get(agent_role).copied().unwrap_or(0);
            if current >= max {
                drop(permit); // Release the general permit
                return Err(ResourceError::RoleLimitExceeded {
                    role: agent_role.to_string(),
                    limit: max,
                });
            }
            *active.entry(agent_role.to_string()).or_insert(0) += 1;
        }

        // Update stats
        self.active_agents.fetch_add(1, Ordering::Relaxed);
        self.stats.acquired.fetch_add(1, Ordering::Relaxed);
        self.stats.update_peak(self.active_agents.load(Ordering::Relaxed));

        Ok(ResourcePermit {
            permit,
            agent_role: agent_role.to_string(),
            acquired_at: Utc::now(),
        })
    }

    /// Release resources when agent completes
    pub fn release(&self, permit: ResourcePermit) {
        let duration = Utc::now() - permit.acquired_at;
        self.stats.add_duration(duration.num_milliseconds() as u64);

        // Update per-role count
        {
            let mut active = self.active_per_role.lock();
            if let Some(count) = active.get_mut(&permit.agent_role) {
                *count = count.saturating_sub(1);
            }
        }

        self.active_agents.fetch_sub(1, Ordering::Relaxed);
        self.stats.released.fetch_add(1, Ordering::Relaxed);

        // Permit is dropped automatically, releasing the semaphore
    }

    /// Queue a task for later execution
    pub fn queue_task(&self, task: QueuedTask) -> Result<usize, ResourceError> {
        let mut queue = self.task_queue.lock();

        if queue.len() >= self.config.max_queue_size {
            return Err(ResourceError::QueueFull);
        }

        queue.push(task);
        self.stats.queued.fetch_add(1, Ordering::Relaxed);

        Ok(queue.len())
    }

    /// Get the next task from the queue
    pub fn dequeue_task(&self) -> Option<QueuedTask> {
        let mut queue = self.task_queue.lock();
        let task = queue.pop();
        if task.is_some() {
            self.stats.dequeued.fetch_add(1, Ordering::Relaxed);
        }
        task
    }

    /// Get current queue length
    pub fn queue_length(&self) -> usize {
        self.task_queue.lock().len()
    }

    /// Get current active agent count
    pub fn active_count(&self) -> u32 {
        self.active_agents.load(Ordering::Relaxed)
    }

    /// Get statistics
    pub fn get_stats(&self) -> ResourceStatsSnapshot {
        self.stats.snapshot(self.active_count(), self.queue_length())
    }

    /// Update configuration
    pub fn update_config(&mut self, config: ResourceConfig) {
        // Update semaphore if concurrency limit changed
        if config.max_concurrent_agents != self.config.max_concurrent_agents {
            self.concurrency_semaphore = Arc::new(Semaphore::new(config.max_concurrent_agents as usize));
        }

        // Update rate limiter
        self.rate_limiter = RateLimiter::new(config.rate_limit_per_minute);

        self.config = config;
    }

    /// Check if resources are available (non-blocking)
    pub fn is_available(&self) -> bool {
        self.concurrency_semaphore.available_permits() > 0
    }

    /// Get available permits count
    pub fn available_permits(&self) -> usize {
        self.concurrency_semaphore.available_permits()
    }
}

/// A permit representing acquired resources
/// The permit is held to maintain the semaphore lock until dropped
#[allow(dead_code)]
pub struct ResourcePermit {
    permit: OwnedSemaphorePermit,
    agent_role: String,
    acquired_at: DateTime<Utc>,
}

/// Errors that can occur during resource acquisition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceError {
    /// Rate limit exceeded
    RateLimited,
    /// Queue is full
    QueueFull,
    /// Timed out waiting for resources
    Timeout,
    /// Role-specific limit exceeded
    RoleLimitExceeded { role: String, limit: u32 },
    /// Semaphore was closed
    SemaphoreClosed,
}

impl std::fmt::Display for ResourceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResourceError::RateLimited => write!(f, "Rate limit exceeded"),
            ResourceError::QueueFull => write!(f, "Task queue is full"),
            ResourceError::Timeout => write!(f, "Timed out waiting for resources"),
            ResourceError::RoleLimitExceeded { role, limit } => {
                write!(f, "Role {} limit of {} exceeded", role, limit)
            }
            ResourceError::SemaphoreClosed => write!(f, "Resource manager was closed"),
        }
    }
}

impl std::error::Error for ResourceError {}

/// Simple rate limiter using token bucket algorithm
struct RateLimiter {
    tokens: AtomicU32,
    max_tokens: u32,
    last_refill: Mutex<DateTime<Utc>>,
    enabled: bool,
}

impl RateLimiter {
    fn new(rate_per_minute: Option<u32>) -> Self {
        let max_tokens = rate_per_minute.unwrap_or(u32::MAX);
        Self {
            tokens: AtomicU32::new(max_tokens),
            max_tokens,
            last_refill: Mutex::new(Utc::now()),
            enabled: rate_per_minute.is_some(),
        }
    }

    fn try_acquire(&self) -> bool {
        if !self.enabled {
            return true;
        }

        // Refill tokens based on elapsed time
        self.refill();

        // Try to take a token
        loop {
            let current = self.tokens.load(Ordering::Relaxed);
            if current == 0 {
                return false;
            }
            if self.tokens.compare_exchange(
                current,
                current - 1,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ).is_ok() {
                return true;
            }
        }
    }

    fn refill(&self) {
        let mut last_refill = self.last_refill.lock();
        let now = Utc::now();
        let elapsed = now - *last_refill;
        let elapsed_minutes = elapsed.num_seconds() as f64 / 60.0;

        if elapsed_minutes >= 0.1 {
            // Refill every 6 seconds minimum
            let tokens_to_add = (self.max_tokens as f64 * elapsed_minutes).min(self.max_tokens as f64) as u32;
            let current = self.tokens.load(Ordering::Relaxed);
            let new_tokens = (current + tokens_to_add).min(self.max_tokens);
            self.tokens.store(new_tokens, Ordering::Relaxed);
            *last_refill = now;
        }
    }
}

/// Statistics tracking for resource usage
struct ResourceStats {
    acquired: AtomicU64,
    released: AtomicU64,
    queued: AtomicU64,
    dequeued: AtomicU64,
    timeouts: AtomicU64,
    rejected: AtomicU64,
    peak_active: AtomicU32,
    total_duration_ms: AtomicU64,
    duration_count: AtomicU64,
}

impl ResourceStats {
    fn new() -> Self {
        Self {
            acquired: AtomicU64::new(0),
            released: AtomicU64::new(0),
            queued: AtomicU64::new(0),
            dequeued: AtomicU64::new(0),
            timeouts: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            peak_active: AtomicU32::new(0),
            total_duration_ms: AtomicU64::new(0),
            duration_count: AtomicU64::new(0),
        }
    }

    fn update_peak(&self, current: u32) {
        loop {
            let peak = self.peak_active.load(Ordering::Relaxed);
            if current <= peak {
                break;
            }
            if self.peak_active.compare_exchange(
                peak,
                current,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ).is_ok() {
                break;
            }
        }
    }

    fn add_duration(&self, duration_ms: u64) {
        self.total_duration_ms.fetch_add(duration_ms, Ordering::Relaxed);
        self.duration_count.fetch_add(1, Ordering::Relaxed);
    }

    fn snapshot(&self, current_active: u32, queue_length: usize) -> ResourceStatsSnapshot {
        let duration_count = self.duration_count.load(Ordering::Relaxed);
        let avg_duration = if duration_count > 0 {
            Some(self.total_duration_ms.load(Ordering::Relaxed) / duration_count)
        } else {
            None
        };

        ResourceStatsSnapshot {
            current_active,
            queue_length,
            total_acquired: self.acquired.load(Ordering::Relaxed),
            total_released: self.released.load(Ordering::Relaxed),
            total_queued: self.queued.load(Ordering::Relaxed),
            total_dequeued: self.dequeued.load(Ordering::Relaxed),
            total_timeouts: self.timeouts.load(Ordering::Relaxed),
            total_rejected: self.rejected.load(Ordering::Relaxed),
            peak_active: self.peak_active.load(Ordering::Relaxed),
            avg_duration_ms: avg_duration,
        }
    }
}

/// Snapshot of resource statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceStatsSnapshot {
    pub current_active: u32,
    pub queue_length: usize,
    pub total_acquired: u64,
    pub total_released: u64,
    pub total_queued: u64,
    pub total_dequeued: u64,
    pub total_timeouts: u64,
    pub total_rejected: u64,
    pub peak_active: u32,
    pub avg_duration_ms: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_acquire_release() {
        let manager = ResourceManager::new(ResourceConfig {
            max_concurrent_agents: 2,
            rate_limit_per_minute: None,
            ..Default::default()
        });

        let permit1 = manager.acquire(Uuid::new_v4(), "node-1", "implementer", TaskPriority::Normal).await;
        assert!(permit1.is_ok());
        assert_eq!(manager.active_count(), 1);

        let permit2 = manager.acquire(Uuid::new_v4(), "node-2", "tester", TaskPriority::Normal).await;
        assert!(permit2.is_ok());
        assert_eq!(manager.active_count(), 2);

        manager.release(permit1.unwrap());
        assert_eq!(manager.active_count(), 1);
    }

    #[test]
    fn test_priority_queue() {
        let manager = ResourceManager::new(ResourceConfig::default());

        // Queue tasks with different priorities
        manager.queue_task(QueuedTask {
            id: Uuid::new_v4(),
            execution_id: Uuid::new_v4(),
            node_id: "low".to_string(),
            agent_role: "implementer".to_string(),
            priority: TaskPriority::Low,
            queued_at: Utc::now(),
            estimated_duration_ms: None,
        }).unwrap();

        manager.queue_task(QueuedTask {
            id: Uuid::new_v4(),
            execution_id: Uuid::new_v4(),
            node_id: "critical".to_string(),
            agent_role: "implementer".to_string(),
            priority: TaskPriority::Critical,
            queued_at: Utc::now(),
            estimated_duration_ms: None,
        }).unwrap();

        manager.queue_task(QueuedTask {
            id: Uuid::new_v4(),
            execution_id: Uuid::new_v4(),
            node_id: "normal".to_string(),
            agent_role: "implementer".to_string(),
            priority: TaskPriority::Normal,
            queued_at: Utc::now(),
            estimated_duration_ms: None,
        }).unwrap();

        // Critical should come first
        let task = manager.dequeue_task().unwrap();
        assert_eq!(task.node_id, "critical");

        // Then normal
        let task = manager.dequeue_task().unwrap();
        assert_eq!(task.node_id, "normal");

        // Then low
        let task = manager.dequeue_task().unwrap();
        assert_eq!(task.node_id, "low");
    }
}
