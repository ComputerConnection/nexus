"""
NEXUS Orchestrator Package

Central coordination for NEXUS agent handoffs.
"""

from .handoff_validator import (
    HandoffValidator,
    HandoffLogger,
    AgentBoundaryEnforcer,
    ValidationResult,
    AgentType,
    validate_handoff,
)

from .orchestrator import (
    NexusOrchestrator,
    ProjectStatus,
    ProjectState,
)

from .agent_interface import (
    AgentInterface,
    AgentPromptBuilder,
    create_agent,
)

__all__ = [
    # Validator
    "HandoffValidator",
    "HandoffLogger",
    "AgentBoundaryEnforcer",
    "ValidationResult",
    "AgentType",
    "validate_handoff",
    # Orchestrator
    "NexusOrchestrator",
    "ProjectStatus",
    "ProjectState",
    # Agent Interface
    "AgentInterface",
    "AgentPromptBuilder",
    "create_agent",
]

__version__ = "1.0.0"
