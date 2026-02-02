//! Retry logic for failed agent executions with configurable strategies.
//!
//! Supports:
//! - Exponential backoff with jitter
//! - Maximum retry attempts
//! - Custom retry conditions
//! - Fallback strategies

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

/// Configuration for retry behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Maximum number of retry attempts (0 = no retries)
    pub max_attempts: u32,
    /// Initial delay before first retry (milliseconds)
    pub initial_delay_ms: u64,
    /// Maximum delay between retries (milliseconds)
    pub max_delay_ms: u64,
    /// Multiplier for exponential backoff (e.g., 2.0 = double each time)
    pub backoff_multiplier: f64,
    /// Add random jitter to prevent thundering herd
    pub jitter: bool,
    /// Retry on timeout errors
    pub retry_on_timeout: bool,
    /// Retry on API errors
    pub retry_on_api_error: bool,
    /// Custom error patterns that should trigger retry
    pub retry_patterns: Vec<String>,
    /// Error patterns that should NOT trigger retry (take precedence)
    pub no_retry_patterns: Vec<String>,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
            jitter: true,
            retry_on_timeout: true,
            retry_on_api_error: true,
            retry_patterns: vec![
                "rate limit".to_string(),
                "connection reset".to_string(),
                "temporary failure".to_string(),
                "service unavailable".to_string(),
                "timeout".to_string(),
                "ETIMEDOUT".to_string(),
                "ECONNRESET".to_string(),
            ],
            no_retry_patterns: vec![
                "authentication failed".to_string(),
                "invalid api key".to_string(),
                "permission denied".to_string(),
                "not found".to_string(),
            ],
        }
    }
}

impl RetryConfig {
    /// Create a config with no retries
    pub fn no_retry() -> Self {
        Self {
            max_attempts: 0,
            ..Default::default()
        }
    }

    /// Create a config for aggressive retry (more attempts, longer delays)
    pub fn aggressive() -> Self {
        Self {
            max_attempts: 5,
            initial_delay_ms: 2000,
            max_delay_ms: 60000,
            backoff_multiplier: 2.0,
            jitter: true,
            ..Default::default()
        }
    }

    /// Create a config for quick retry (fewer attempts, shorter delays)
    pub fn quick() -> Self {
        Self {
            max_attempts: 2,
            initial_delay_ms: 500,
            max_delay_ms: 5000,
            backoff_multiplier: 1.5,
            jitter: true,
            ..Default::default()
        }
    }
}

/// Result of checking if an error should be retried
#[derive(Debug, Clone)]
pub enum RetryDecision {
    /// Should retry after the specified delay
    Retry { delay: Duration, attempt: u32 },
    /// Should not retry
    NoRetry { reason: String },
    /// All retry attempts exhausted
    Exhausted { total_attempts: u32 },
}

/// Tracks retry state for a single execution
#[derive(Debug, Clone)]
pub struct RetryState {
    config: RetryConfig,
    current_attempt: u32,
    errors: Vec<RetryAttemptError>,
    started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryAttemptError {
    pub attempt: u32,
    pub error: String,
    pub timestamp: DateTime<Utc>,
    pub delay_before_next: Option<Duration>,
}

impl RetryState {
    pub fn new(config: RetryConfig) -> Self {
        Self {
            config,
            current_attempt: 0,
            errors: Vec::new(),
            started_at: Utc::now(),
        }
    }

    /// Check if we should retry after an error
    pub fn should_retry(&mut self, error: &str) -> RetryDecision {
        self.current_attempt += 1;

        // Check if we've exhausted all attempts
        if self.current_attempt > self.config.max_attempts {
            return RetryDecision::Exhausted {
                total_attempts: self.current_attempt,
            };
        }

        // Check if error matches no-retry patterns
        let error_lower = error.to_lowercase();
        for pattern in &self.config.no_retry_patterns {
            if error_lower.contains(&pattern.to_lowercase()) {
                return RetryDecision::NoRetry {
                    reason: format!("Error matches no-retry pattern: {}", pattern),
                };
            }
        }

        // Check if error matches retry patterns
        let mut should_retry = false;

        // Check timeout
        if self.config.retry_on_timeout && (error_lower.contains("timeout") || error_lower.contains("timed out")) {
            should_retry = true;
        }

        // Check API errors
        if self.config.retry_on_api_error && (error_lower.contains("api") || error_lower.contains("rate limit")) {
            should_retry = true;
        }

        // Check custom patterns
        for pattern in &self.config.retry_patterns {
            if error_lower.contains(&pattern.to_lowercase()) {
                should_retry = true;
                break;
            }
        }

        if !should_retry {
            return RetryDecision::NoRetry {
                reason: "Error does not match any retry patterns".to_string(),
            };
        }

        // Calculate delay with exponential backoff
        let delay = self.calculate_delay();

        // Record this error
        self.errors.push(RetryAttemptError {
            attempt: self.current_attempt,
            error: error.to_string(),
            timestamp: Utc::now(),
            delay_before_next: Some(delay),
        });

        RetryDecision::Retry {
            delay,
            attempt: self.current_attempt,
        }
    }

    /// Calculate delay for current attempt using exponential backoff
    fn calculate_delay(&self) -> Duration {
        let base_delay = self.config.initial_delay_ms as f64;
        let multiplier = self.config.backoff_multiplier.powi((self.current_attempt - 1) as i32);
        let mut delay_ms = (base_delay * multiplier) as u64;

        // Cap at max delay
        delay_ms = delay_ms.min(self.config.max_delay_ms);

        // Add jitter if enabled (±25%)
        if self.config.jitter {
            let jitter_range = delay_ms / 4;
            let jitter = rand::random::<u64>() % (jitter_range * 2);
            delay_ms = delay_ms.saturating_sub(jitter_range) + jitter;
        }

        Duration::from_millis(delay_ms)
    }

    /// Get the current attempt number
    pub fn current_attempt(&self) -> u32 {
        self.current_attempt
    }

    /// Get all recorded errors
    pub fn get_errors(&self) -> &[RetryAttemptError] {
        &self.errors
    }

    /// Get total elapsed time since start
    pub fn elapsed(&self) -> chrono::Duration {
        Utc::now() - self.started_at
    }

    /// Record a successful completion
    pub fn mark_success(&mut self) -> RetryResult {
        RetryResult {
            success: true,
            total_attempts: self.current_attempt,
            errors: self.errors.clone(),
            elapsed: self.elapsed(),
        }
    }

    /// Record final failure
    pub fn mark_failure(&mut self, final_error: &str) -> RetryResult {
        self.errors.push(RetryAttemptError {
            attempt: self.current_attempt,
            error: final_error.to_string(),
            timestamp: Utc::now(),
            delay_before_next: None,
        });

        RetryResult {
            success: false,
            total_attempts: self.current_attempt,
            errors: self.errors.clone(),
            elapsed: self.elapsed(),
        }
    }
}

/// Final result of a retry sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryResult {
    pub success: bool,
    pub total_attempts: u32,
    pub errors: Vec<RetryAttemptError>,
    #[serde(with = "chrono_duration_serde")]
    pub elapsed: chrono::Duration,
}

mod chrono_duration_serde {
    use chrono::Duration;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        duration.num_milliseconds().serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        let ms = i64::deserialize(deserializer)?;
        Ok(Duration::milliseconds(ms))
    }
}

/// Execute an async operation with retry logic
pub async fn with_retry<F, Fut, T, E>(
    config: RetryConfig,
    mut operation: F,
) -> Result<(T, RetryResult), (E, RetryResult)>
where
    F: FnMut(u32) -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut state = RetryState::new(config);

    loop {
        let attempt = state.current_attempt() + 1;

        match operation(attempt).await {
            Ok(result) => {
                state.current_attempt += 1;
                let retry_result = state.mark_success();
                return Ok((result, retry_result));
            }
            Err(error) => {
                let error_str = error.to_string();
                match state.should_retry(&error_str) {
                    RetryDecision::Retry { delay, attempt: _ } => {
                        log::warn!(
                            "Attempt {} failed: {}. Retrying in {:?}...",
                            state.current_attempt(),
                            error_str,
                            delay
                        );
                        sleep(delay).await;
                    }
                    RetryDecision::NoRetry { reason } => {
                        log::error!("Not retrying: {}", reason);
                        let retry_result = state.mark_failure(&error_str);
                        return Err((error, retry_result));
                    }
                    RetryDecision::Exhausted { total_attempts } => {
                        log::error!(
                            "All {} retry attempts exhausted. Final error: {}",
                            total_attempts,
                            error_str
                        );
                        let retry_result = state.mark_failure(&error_str);
                        return Err((error, retry_result));
                    }
                }
            }
        }
    }
}

/// Fallback strategy when all retries fail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FallbackStrategy {
    /// Skip this node and continue with workflow
    Skip,
    /// Use a default/cached result
    UseDefault { value: serde_json::Value },
    /// Run an alternative agent with different config
    AlternativeAgent { role: String, system_prompt: Option<String> },
    /// Notify user and pause for manual intervention
    PauseForIntervention,
    /// Fail the entire workflow
    FailWorkflow,
}

impl Default for FallbackStrategy {
    fn default() -> Self {
        Self::FailWorkflow
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_retry_timeout() {
        let config = RetryConfig::default();
        let mut state = RetryState::new(config);

        match state.should_retry("Connection timeout occurred") {
            RetryDecision::Retry { .. } => {}
            other => panic!("Expected Retry, got {:?}", other),
        }
    }

    #[test]
    fn test_should_not_retry_auth_error() {
        let config = RetryConfig::default();
        let mut state = RetryState::new(config);

        match state.should_retry("Authentication failed: invalid api key") {
            RetryDecision::NoRetry { .. } => {}
            other => panic!("Expected NoRetry, got {:?}", other),
        }
    }

    #[test]
    fn test_retry_exhaustion() {
        let config = RetryConfig {
            max_attempts: 2,
            ..Default::default()
        };
        let mut state = RetryState::new(config);

        // First two should retry
        assert!(matches!(
            state.should_retry("timeout"),
            RetryDecision::Retry { .. }
        ));
        assert!(matches!(
            state.should_retry("timeout"),
            RetryDecision::Retry { .. }
        ));

        // Third should exhaust
        assert!(matches!(
            state.should_retry("timeout"),
            RetryDecision::Exhausted { .. }
        ));
    }

    #[test]
    fn test_exponential_backoff() {
        let config = RetryConfig {
            max_attempts: 5,
            initial_delay_ms: 1000,
            backoff_multiplier: 2.0,
            jitter: false,
            ..Default::default()
        };
        let mut state = RetryState::new(config);

        // Check increasing delays
        if let RetryDecision::Retry { delay, .. } = state.should_retry("timeout") {
            assert_eq!(delay.as_millis(), 1000);
        }
        if let RetryDecision::Retry { delay, .. } = state.should_retry("timeout") {
            assert_eq!(delay.as_millis(), 2000);
        }
        if let RetryDecision::Retry { delay, .. } = state.should_retry("timeout") {
            assert_eq!(delay.as_millis(), 4000);
        }
    }
}
