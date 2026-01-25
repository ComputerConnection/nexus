use super::protocol::{AgentMessage, MessageEnvelope};
use dashmap::DashMap;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use uuid::Uuid;

pub type MessageSender = mpsc::UnboundedSender<MessageEnvelope>;
pub type MessageReceiver = mpsc::UnboundedReceiver<MessageEnvelope>;

pub struct MessageRouter {
    app: AppHandle,
    agents: DashMap<Uuid, MessageSender>,
    message_log: DashMap<Uuid, MessageEnvelope>,
}

impl MessageRouter {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            agents: DashMap::new(),
            message_log: DashMap::new(),
        }
    }

    pub fn register_agent(&self, agent_id: Uuid) -> MessageReceiver {
        let (tx, rx) = mpsc::unbounded_channel();
        self.agents.insert(agent_id, tx);
        rx
    }

    pub fn unregister_agent(&self, agent_id: &Uuid) {
        self.agents.remove(agent_id);
    }

    pub async fn route_message(&self, envelope: MessageEnvelope) -> Result<(), RouterError> {
        // Log the message
        self.message_log.insert(envelope.id, envelope.clone());

        // Emit to frontend for visualization
        let _ = self.app.emit("agent-message", &envelope);

        match envelope.to {
            Some(target_id) => {
                // Direct message
                if let Some(sender) = self.agents.get(&target_id) {
                    sender
                        .send(envelope)
                        .map_err(|_| RouterError::SendFailed(target_id))?;
                } else {
                    return Err(RouterError::AgentNotFound(target_id));
                }
            }
            None => {
                // Broadcast to all agents except sender
                for entry in self.agents.iter() {
                    if *entry.key() != envelope.from {
                        let _ = entry.value().send(envelope.clone());
                    }
                }
            }
        }

        Ok(())
    }

    pub fn send_to_agent(
        &self,
        from: Uuid,
        to: Uuid,
        message: AgentMessage,
    ) -> Result<(), RouterError> {
        let envelope = MessageEnvelope::new(from, Some(to), message);
        self.message_log.insert(envelope.id, envelope.clone());

        if let Some(sender) = self.agents.get(&to) {
            sender
                .send(envelope)
                .map_err(|_| RouterError::SendFailed(to))?;
            Ok(())
        } else {
            Err(RouterError::AgentNotFound(to))
        }
    }

    pub fn broadcast(&self, from: Uuid, message: AgentMessage) {
        let envelope = MessageEnvelope::broadcast(from, message);
        self.message_log.insert(envelope.id, envelope.clone());

        for entry in self.agents.iter() {
            if *entry.key() != from {
                let _ = entry.value().send(envelope.clone());
            }
        }
    }

    pub fn get_message(&self, message_id: &Uuid) -> Option<MessageEnvelope> {
        self.message_log.get(message_id).map(|e| e.clone())
    }

    pub fn get_agent_count(&self) -> usize {
        self.agents.len()
    }

    pub fn get_registered_agents(&self) -> Vec<Uuid> {
        self.agents.iter().map(|e| *e.key()).collect()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RouterError {
    #[error("Agent not found: {0}")]
    AgentNotFound(Uuid),
    #[error("Failed to send message to agent: {0}")]
    SendFailed(Uuid),
    #[error("Message expired")]
    MessageExpired,
}

// Helper for starting a message handler for an agent
pub async fn start_message_handler(
    agent_id: Uuid,
    mut rx: MessageReceiver,
    handler: impl Fn(MessageEnvelope) + Send + 'static,
) {
    tokio::spawn(async move {
        while let Some(envelope) = rx.recv().await {
            handler(envelope);
        }
        log::debug!("Message handler for agent {} stopped", agent_id);
    });
}
