//! Inter-agent messaging system for real-time communication between agents.
//!
//! Enables agents to:
//! - Send direct messages to other agents
//! - Broadcast messages to all agents
//! - Request information from other agents
//! - Coordinate work in real-time

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

/// A message sent between agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    /// Unique message ID
    pub id: Uuid,
    /// Execution context
    pub execution_id: Uuid,
    /// Sender agent ID
    pub from_agent_id: Uuid,
    /// Sender node ID
    pub from_node_id: String,
    /// Sender role
    pub from_role: String,
    /// Recipient (None for broadcast)
    pub to_agent_id: Option<Uuid>,
    /// Recipient node ID (None for broadcast)
    pub to_node_id: Option<String>,
    /// Message type
    pub message_type: MessageType,
    /// Message content
    pub content: MessageContent,
    /// When the message was sent
    pub timestamp: DateTime<Utc>,
    /// Priority level
    pub priority: MessagePriority,
    /// Whether the message has been read
    pub read: bool,
    /// Reply to message ID (for threaded conversations)
    pub reply_to: Option<Uuid>,
}

/// Types of inter-agent messages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    /// Informational message
    Info,
    /// Request for action or information
    Request,
    /// Response to a request
    Response,
    /// Warning about potential issues
    Warning,
    /// Error notification
    Error,
    /// Status update
    Status,
    /// Data transfer
    Data,
    /// Coordination message
    Coordination,
    /// Completion notification
    Completion,
}

/// Message content variants
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum MessageContent {
    /// Plain text message
    Text(String),
    /// Structured data
    Json(serde_json::Value),
    /// Code snippet
    Code { language: String, content: String },
    /// File reference
    FileReference { path: String, description: Option<String> },
    /// Progress update
    Progress { current: u32, total: u32, message: String },
    /// Request for specific action
    ActionRequest { action: String, parameters: serde_json::Value },
    /// Action response
    ActionResponse { success: bool, result: Option<serde_json::Value>, error: Option<String> },
    /// Dependency notification
    DependencyReady { node_id: String, output_available: bool },
    /// Blocking notification
    Blocked { reason: String, blocked_by: Option<String> },
}

/// Message priority levels
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum MessagePriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

impl Default for MessagePriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Message bus for an execution
pub struct MessageBus {
    /// Execution ID
    execution_id: Uuid,
    /// All messages in this execution
    messages: DashMap<Uuid, AgentMessage>,
    /// Messages per agent (inbox)
    inboxes: DashMap<Uuid, VecDeque<Uuid>>,
    /// Broadcast channel for real-time notifications
    broadcast_tx: broadcast::Sender<AgentMessage>,
    /// Maximum messages to keep
    max_messages: usize,
}

impl MessageBus {
    pub fn new(execution_id: Uuid) -> Self {
        let (broadcast_tx, _) = broadcast::channel(1000);
        Self {
            execution_id,
            messages: DashMap::new(),
            inboxes: DashMap::new(),
            broadcast_tx,
            max_messages: 10000,
        }
    }

    /// Send a message
    pub fn send(&self, mut message: AgentMessage) -> Uuid {
        message.id = Uuid::new_v4();
        message.execution_id = self.execution_id;
        message.timestamp = Utc::now();
        message.read = false;

        let message_id = message.id;

        // Store message
        self.messages.insert(message_id, message.clone());

        // Add to recipient's inbox
        if let Some(to_agent_id) = message.to_agent_id {
            self.inboxes
                .entry(to_agent_id)
                .or_insert_with(VecDeque::new)
                .push_back(message_id);
        } else {
            // Broadcast - add to all inboxes
            for mut inbox in self.inboxes.iter_mut() {
                inbox.push_back(message_id);
            }
        }

        // Notify subscribers
        let _ = self.broadcast_tx.send(message);

        // Cleanup if needed
        if self.messages.len() > self.max_messages {
            self.cleanup_old_messages();
        }

        message_id
    }

    /// Create a quick text message
    pub fn send_text(
        &self,
        from_agent_id: Uuid,
        from_node_id: &str,
        from_role: &str,
        to_agent_id: Option<Uuid>,
        to_node_id: Option<&str>,
        text: &str,
    ) -> Uuid {
        self.send(AgentMessage {
            id: Uuid::nil(), // Will be set by send()
            execution_id: self.execution_id,
            from_agent_id,
            from_node_id: from_node_id.to_string(),
            from_role: from_role.to_string(),
            to_agent_id,
            to_node_id: to_node_id.map(|s| s.to_string()),
            message_type: MessageType::Info,
            content: MessageContent::Text(text.to_string()),
            timestamp: Utc::now(),
            priority: MessagePriority::Normal,
            read: false,
            reply_to: None,
        })
    }

    /// Send a request message and return the message ID for tracking responses
    pub fn send_request(
        &self,
        from_agent_id: Uuid,
        from_node_id: &str,
        from_role: &str,
        to_agent_id: Uuid,
        to_node_id: &str,
        action: &str,
        parameters: serde_json::Value,
    ) -> Uuid {
        self.send(AgentMessage {
            id: Uuid::nil(),
            execution_id: self.execution_id,
            from_agent_id,
            from_node_id: from_node_id.to_string(),
            from_role: from_role.to_string(),
            to_agent_id: Some(to_agent_id),
            to_node_id: Some(to_node_id.to_string()),
            message_type: MessageType::Request,
            content: MessageContent::ActionRequest {
                action: action.to_string(),
                parameters,
            },
            timestamp: Utc::now(),
            priority: MessagePriority::High,
            read: false,
            reply_to: None,
        })
    }

    /// Send a response to a request
    pub fn send_response(
        &self,
        from_agent_id: Uuid,
        from_node_id: &str,
        from_role: &str,
        to_agent_id: Uuid,
        to_node_id: &str,
        reply_to: Uuid,
        success: bool,
        result: Option<serde_json::Value>,
        error: Option<String>,
    ) -> Uuid {
        self.send(AgentMessage {
            id: Uuid::nil(),
            execution_id: self.execution_id,
            from_agent_id,
            from_node_id: from_node_id.to_string(),
            from_role: from_role.to_string(),
            to_agent_id: Some(to_agent_id),
            to_node_id: Some(to_node_id.to_string()),
            message_type: MessageType::Response,
            content: MessageContent::ActionResponse { success, result, error },
            timestamp: Utc::now(),
            priority: MessagePriority::High,
            read: false,
            reply_to: Some(reply_to),
        })
    }

    /// Broadcast a status update
    pub fn broadcast_status(
        &self,
        from_agent_id: Uuid,
        from_node_id: &str,
        from_role: &str,
        status: &str,
    ) -> Uuid {
        self.send(AgentMessage {
            id: Uuid::nil(),
            execution_id: self.execution_id,
            from_agent_id,
            from_node_id: from_node_id.to_string(),
            from_role: from_role.to_string(),
            to_agent_id: None,
            to_node_id: None,
            message_type: MessageType::Status,
            content: MessageContent::Text(status.to_string()),
            timestamp: Utc::now(),
            priority: MessagePriority::Normal,
            read: false,
            reply_to: None,
        })
    }

    /// Get messages for an agent
    pub fn get_inbox(&self, agent_id: &Uuid) -> Vec<AgentMessage> {
        self.inboxes
            .get(agent_id)
            .map(|inbox| {
                inbox
                    .iter()
                    .filter_map(|msg_id| self.messages.get(msg_id).map(|m| m.clone()))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get unread messages for an agent
    pub fn get_unread(&self, agent_id: &Uuid) -> Vec<AgentMessage> {
        self.get_inbox(agent_id)
            .into_iter()
            .filter(|m| !m.read)
            .collect()
    }

    /// Mark a message as read
    pub fn mark_read(&self, message_id: &Uuid) -> bool {
        if let Some(mut msg) = self.messages.get_mut(message_id) {
            msg.read = true;
            true
        } else {
            false
        }
    }

    /// Get a specific message
    pub fn get_message(&self, message_id: &Uuid) -> Option<AgentMessage> {
        self.messages.get(message_id).map(|m| m.clone())
    }

    /// Get all messages in the execution
    pub fn get_all_messages(&self) -> Vec<AgentMessage> {
        let mut messages: Vec<_> = self.messages.iter().map(|m| m.clone()).collect();
        messages.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        messages
    }

    /// Get messages by type
    pub fn get_messages_by_type(&self, message_type: MessageType) -> Vec<AgentMessage> {
        self.get_all_messages()
            .into_iter()
            .filter(|m| m.message_type == message_type)
            .collect()
    }

    /// Get thread (message and all replies)
    pub fn get_thread(&self, root_message_id: &Uuid) -> Vec<AgentMessage> {
        let mut thread = Vec::new();

        if let Some(root) = self.get_message(root_message_id) {
            thread.push(root);

            // Find all replies
            for msg in self.get_all_messages() {
                if msg.reply_to == Some(*root_message_id) {
                    thread.push(msg);
                }
            }
        }

        thread.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        thread
    }

    /// Subscribe to message notifications
    pub fn subscribe(&self) -> broadcast::Receiver<AgentMessage> {
        self.broadcast_tx.subscribe()
    }

    /// Register an agent's inbox
    pub fn register_agent(&self, agent_id: Uuid) {
        self.inboxes.entry(agent_id).or_insert_with(VecDeque::new);
    }

    /// Get conversation between two agents
    pub fn get_conversation(&self, agent1: &Uuid, agent2: &Uuid) -> Vec<AgentMessage> {
        self.get_all_messages()
            .into_iter()
            .filter(|m| {
                (m.from_agent_id == *agent1 && m.to_agent_id == Some(*agent2))
                    || (m.from_agent_id == *agent2 && m.to_agent_id == Some(*agent1))
            })
            .collect()
    }

    /// Clean up old messages
    fn cleanup_old_messages(&self) {
        let mut messages: Vec<_> = self.messages.iter().map(|m| (m.id, m.timestamp)).collect();
        messages.sort_by(|a, b| a.1.cmp(&b.1));

        // Remove oldest 20%
        let to_remove = self.max_messages / 5;
        for (id, _) in messages.into_iter().take(to_remove) {
            self.messages.remove(&id);
        }
    }
}

/// Global message bus store
pub struct MessageBusStore {
    buses: DashMap<Uuid, Arc<MessageBus>>,
}

impl MessageBusStore {
    pub fn new() -> Self {
        Self {
            buses: DashMap::new(),
        }
    }

    /// Create a message bus for an execution
    pub fn create(&self, execution_id: Uuid) -> Arc<MessageBus> {
        let bus = Arc::new(MessageBus::new(execution_id));
        self.buses.insert(execution_id, bus.clone());
        bus
    }

    /// Get message bus for an execution
    pub fn get(&self, execution_id: &Uuid) -> Option<Arc<MessageBus>> {
        self.buses.get(execution_id).map(|b| b.clone())
    }

    /// Remove message bus
    pub fn remove(&self, execution_id: &Uuid) -> Option<Arc<MessageBus>> {
        self.buses.remove(execution_id).map(|(_, b)| b)
    }
}

impl Default for MessageBusStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_send_and_receive() {
        let bus = MessageBus::new(Uuid::new_v4());
        let agent1 = Uuid::new_v4();
        let agent2 = Uuid::new_v4();

        bus.register_agent(agent1);
        bus.register_agent(agent2);

        let msg_id = bus.send_text(
            agent1,
            "node-1",
            "architect",
            Some(agent2),
            Some("node-2"),
            "Hello from architect!",
        );

        let inbox = bus.get_inbox(&agent2);
        assert_eq!(inbox.len(), 1);
        assert_eq!(inbox[0].id, msg_id);
    }

    #[test]
    fn test_broadcast() {
        let bus = MessageBus::new(Uuid::new_v4());
        let agent1 = Uuid::new_v4();
        let agent2 = Uuid::new_v4();
        let agent3 = Uuid::new_v4();

        bus.register_agent(agent1);
        bus.register_agent(agent2);
        bus.register_agent(agent3);

        bus.broadcast_status(agent1, "node-1", "orchestrator", "Starting execution");

        // All agents should have the message
        assert_eq!(bus.get_inbox(&agent2).len(), 1);
        assert_eq!(bus.get_inbox(&agent3).len(), 1);
    }

    #[test]
    fn test_request_response() {
        let bus = MessageBus::new(Uuid::new_v4());
        let agent1 = Uuid::new_v4();
        let agent2 = Uuid::new_v4();

        bus.register_agent(agent1);
        bus.register_agent(agent2);

        let request_id = bus.send_request(
            agent1,
            "node-1",
            "architect",
            agent2,
            "node-2",
            "get_design",
            serde_json::json!({"component": "auth"}),
        );

        let response_id = bus.send_response(
            agent2,
            "node-2",
            "implementer",
            agent1,
            "node-1",
            request_id,
            true,
            Some(serde_json::json!({"design": "OAuth2"})),
            None,
        );

        let thread = bus.get_thread(&request_id);
        assert_eq!(thread.len(), 2);
    }
}
