"""
NEXUS Orchestrator Core

Central coordinator for agent handoffs and project management.
Enforces the handoff protocol and prevents drift.

Usage:
    from orchestrator import NexusOrchestrator

    orchestrator = NexusOrchestrator(project_dir="./projects")

    # Create new project
    project = orchestrator.create_project(
        project_id="store-ai-auth",
        brief=brief_content
    )

    # Process handoff
    result = orchestrator.process_handoff(
        project_id="store-ai-auth",
        handoff_data=handoff,
        from_agent="architect"
    )
"""

import yaml
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum

from handoff_validator import (
    HandoffValidator,
    HandoffLogger,
    AgentBoundaryEnforcer,
    ValidationResult,
    AgentType,
)


class ProjectStatus(Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    BLOCKED = "blocked"


@dataclass
class ProjectState:
    """Current state of a project"""
    project_id: str
    status: ProjectStatus
    current_agent: Optional[str]
    last_handoff: Optional[str]
    blockers: List[str]
    created_at: str
    updated_at: str


class NexusOrchestrator:
    """
    Central orchestrator for NEXUS agent coordination.

    Responsibilities:
    - Create and manage projects
    - Validate and log handoffs
    - Track project state
    - Enforce agent boundaries
    - Detect and prevent drift
    """

    def __init__(self, project_dir: str = "./projects", strict_mode: bool = True):
        """
        Initialize orchestrator.

        Args:
            project_dir: Base directory for projects
            strict_mode: If True, warnings become errors
        """
        self.project_dir = Path(project_dir)
        self.project_dir.mkdir(parents=True, exist_ok=True)

        self.validator = HandoffValidator(strict_mode=strict_mode)
        self.logger = HandoffLogger(log_dir=str(self.project_dir / "_logs"))
        self.boundary_enforcer = AgentBoundaryEnforcer()
        self.strict_mode = strict_mode

    # =========================================================================
    # PROJECT MANAGEMENT
    # =========================================================================

    def create_project(
        self,
        project_id: str,
        brief: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new project with the given brief.

        Args:
            project_id: Unique project identifier
            brief: The ORIGINAL_BRIEF content (markdown)
            metadata: Optional additional metadata

        Returns:
            Project info dict
        """
        project_path = self.project_dir / project_id

        if project_path.exists():
            raise ValueError(f"Project {project_id} already exists")

        # Create project structure
        project_path.mkdir(parents=True)
        (project_path / "handoff_log").mkdir()
        (project_path / "decisions").mkdir()
        (project_path / "artifacts").mkdir()

        # Write immutable brief
        brief_path = project_path / "ORIGINAL_BRIEF.md"
        with open(brief_path, "w") as f:
            f.write(brief)

        # Initialize state file
        state = ProjectState(
            project_id=project_id,
            status=ProjectStatus.ACTIVE,
            current_agent=None,
            last_handoff=None,
            blockers=[],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        self._save_project_state(project_id, state)

        # Initialize current state (empty)
        current_state_path = project_path / "CURRENT_STATE.yaml"
        with open(current_state_path, "w") as f:
            yaml.dump({
                "project_id": project_id,
                "status": "awaiting_first_handoff",
                "last_updated": datetime.now().isoformat(),
            }, f)

        # Initialize decision log
        decision_log_path = project_path / "decisions" / "DECISION_LOG.md"
        with open(decision_log_path, "w") as f:
            f.write(f"# Decision Log: {project_id}\n\n")
            f.write("| Date | Agent | Decision | Rationale |\n")
            f.write("|------|-------|----------|----------|\n")

        return {
            "project_id": project_id,
            "path": str(project_path),
            "status": "created",
            "brief_path": str(brief_path),
        }

    def get_project_state(self, project_id: str) -> ProjectState:
        """Get current state of a project"""
        state_path = self.project_dir / project_id / ".state.yaml"

        if not state_path.exists():
            raise ValueError(f"Project {project_id} not found")

        with open(state_path) as f:
            data = yaml.safe_load(f)

        return ProjectState(
            project_id=data["project_id"],
            status=ProjectStatus(data["status"]),
            current_agent=data.get("current_agent"),
            last_handoff=data.get("last_handoff"),
            blockers=data.get("blockers", []),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )

    def _save_project_state(self, project_id: str, state: ProjectState):
        """Save project state"""
        state_path = self.project_dir / project_id / ".state.yaml"

        data = {
            "project_id": state.project_id,
            "status": state.status.value,
            "current_agent": state.current_agent,
            "last_handoff": state.last_handoff,
            "blockers": state.blockers,
            "created_at": state.created_at,
            "updated_at": datetime.now().isoformat(),
        }

        with open(state_path, "w") as f:
            yaml.dump(data, f)

    # =========================================================================
    # HANDOFF PROCESSING
    # =========================================================================

    def process_handoff(
        self,
        project_id: str,
        handoff_data: Dict[str, Any],
        from_agent: str,
        to_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process and validate a handoff.

        Args:
            project_id: Project this handoff belongs to
            handoff_data: The handoff data
            from_agent: Agent submitting the handoff
            to_agent: Target agent (optional, can be in handoff_data)

        Returns:
            Processing result with validation info
        """
        # Get to_agent from handoff if not provided
        if to_agent is None:
            to_agent = handoff_data.get("handoff", {}).get("to_agent")

        # Validate the handoff
        validation = self.validator.validate(handoff_data, from_agent, to_agent)

        # Check against original brief (drift detection)
        drift_check = self._check_for_drift(project_id, handoff_data)
        if drift_check["has_drift"]:
            for drift_issue in drift_check["issues"]:
                validation.add_error(f"[DRIFT] {drift_issue}")

        # Log the handoff (even if invalid, for debugging)
        log_path = self.logger.log_handoff(handoff_data, validation, project_id)

        # If valid, update project state
        if validation.is_valid:
            self._apply_handoff(project_id, handoff_data, validation)

            # Extract and log decisions
            self._log_decisions(project_id, handoff_data, from_agent)

            # Update current state file
            self._update_current_state(project_id, handoff_data)

        return {
            "is_valid": validation.is_valid,
            "handoff_id": validation.handoff_id,
            "errors": validation.errors,
            "warnings": validation.warnings,
            "log_path": log_path,
            "drift_check": drift_check,
            "next_agent": to_agent if validation.is_valid else None,
        }

    def _check_for_drift(
        self,
        project_id: str,
        handoff_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Check if handoff is drifting from original brief.

        Compares:
        - Scope boundaries against original brief
        - Original intent preservation
        - Out of scope violations
        """
        brief_path = self.project_dir / project_id / "ORIGINAL_BRIEF.md"

        if not brief_path.exists():
            return {"has_drift": False, "issues": [], "note": "No brief to check against"}

        with open(brief_path) as f:
            brief_content = f.read().lower()

        issues = []
        handoff = handoff_data.get("handoff", {})

        # Check if out_of_scope items are being built
        scope = handoff.get("context_for_next_agent", {}).get("scope_boundaries", {})
        in_scope = scope.get("in_scope", [])

        # Look for mentions of out-of-scope items in brief
        if "out of scope" in brief_content or "out_of_scope" in brief_content:
            what_was_done = handoff.get("summary", {}).get("what_was_done", "").lower()

            # Simple keyword check - could be made smarter
            out_of_scope_keywords = ["oauth", "role-based", "email", "sms", "mfa", "multi-factor"]
            for keyword in out_of_scope_keywords:
                if keyword in what_was_done and keyword in brief_content:
                    # Check if it's in the out of scope section
                    if f"out of scope" in brief_content and keyword in brief_content.split("out of scope")[1][:500]:
                        issues.append(f"Possible out-of-scope work detected: '{keyword}' mentioned in what_was_done")

        # Check original intent is preserved
        original_intent = handoff.get("context_for_next_agent", {}).get("original_intent", "")
        if len(original_intent.strip()) < 20:
            issues.append("Original intent is too short or missing - drift likely")

        return {
            "has_drift": len(issues) > 0,
            "issues": issues,
        }

    def _apply_handoff(
        self,
        project_id: str,
        handoff_data: Dict[str, Any],
        validation: ValidationResult
    ):
        """Apply a valid handoff to project state"""
        state = self.get_project_state(project_id)

        handoff = handoff_data.get("handoff", {})
        status = handoff.get("status", {}).get("completion", "complete")
        to_agent = handoff.get("to_agent")

        # Update state
        state.last_handoff = validation.handoff_id
        state.current_agent = to_agent
        state.updated_at = datetime.now().isoformat()

        if status == "blocked":
            state.status = ProjectStatus.BLOCKED
            blocker = handoff.get("status", {}).get("if_blocked", {}).get("blocker", "Unknown")
            state.blockers.append(blocker)
        elif status == "complete" and to_agent is None:
            state.status = ProjectStatus.COMPLETED
        else:
            state.status = ProjectStatus.ACTIVE

        self._save_project_state(project_id, state)

    def _log_decisions(
        self,
        project_id: str,
        handoff_data: Dict[str, Any],
        from_agent: str
    ):
        """Extract and log decisions from handoff"""
        decisions = handoff_data.get("handoff", {}).get("summary", {}).get("decisions_made", [])

        if not decisions:
            return

        decision_log_path = self.project_dir / project_id / "decisions" / "DECISION_LOG.md"

        with open(decision_log_path, "a") as f:
            for decision in decisions:
                if isinstance(decision, dict):
                    date = datetime.now().strftime("%Y-%m-%d")
                    dec = decision.get("decision", "N/A")
                    rationale = decision.get("rationale", "N/A")
                    f.write(f"| {date} | {from_agent} | {dec} | {rationale} |\n")

    def _update_current_state(self, project_id: str, handoff_data: Dict[str, Any]):
        """Update the CURRENT_STATE.yaml file"""
        current_state_path = self.project_dir / project_id / "CURRENT_STATE.yaml"

        # Current state is just the latest handoff
        state = {
            "last_updated": datetime.now().isoformat(),
            "handoff": handoff_data.get("handoff", {}),
        }

        with open(current_state_path, "w") as f:
            yaml.dump(state, f, default_flow_style=False, allow_unicode=True)

    # =========================================================================
    # AGENT TASK ASSIGNMENT
    # =========================================================================

    def assign_task(
        self,
        project_id: str,
        agent_type: str,
        task_description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Assign a task to an agent.

        Args:
            project_id: Project ID
            agent_type: Type of agent to assign to
            task_description: What the agent should do
            context: Additional context for the agent

        Returns:
            Task assignment with all context needed
        """
        project_path = self.project_dir / project_id

        # Read original brief
        brief_path = project_path / "ORIGINAL_BRIEF.md"
        with open(brief_path) as f:
            brief = f.read()

        # Read current state
        current_state_path = project_path / "CURRENT_STATE.yaml"
        with open(current_state_path) as f:
            current_state = yaml.safe_load(f)

        # Read recent handoffs for context
        handoff_log_path = project_path / "handoff_log"
        recent_handoffs = []
        if handoff_log_path.exists():
            handoff_files = sorted(handoff_log_path.glob("*.yaml"))[-3:]  # Last 3
            for hf in handoff_files:
                with open(hf) as f:
                    recent_handoffs.append(yaml.safe_load(f))

        return {
            "project_id": project_id,
            "agent_type": agent_type,
            "task": task_description,
            "original_brief": brief,
            "current_state": current_state,
            "recent_handoffs": recent_handoffs,
            "additional_context": context,
            "handoff_protocol_reminder": self._get_protocol_reminder(agent_type),
        }

    def _get_protocol_reminder(self, agent_type: str) -> str:
        """Get protocol reminder for agent"""
        return f"""
HANDOFF PROTOCOL REMINDER FOR {agent_type.upper()}:

1. Your work is NOT complete until you write a valid handoff block
2. Restate the original_intent in your handoff
3. Document ALL decisions with rationale
4. Define scope boundaries (in_scope / out_of_scope)
5. Do NOT work on out_of_scope items - log them as technical debt
6. Specify how to verify your work
7. If blocked, document what you need and from whom

Anti-drift rules:
- No scope creep - log it, don't fix it
- No "while I'm here" changes
- Original intent is sacred
- Questions pause work - don't guess
"""

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects"""
        projects = []

        for path in self.project_dir.iterdir():
            if path.is_dir() and not path.name.startswith("_"):
                state_file = path / ".state.yaml"
                if state_file.exists():
                    with open(state_file) as f:
                        state = yaml.safe_load(f)
                    projects.append({
                        "project_id": state["project_id"],
                        "status": state["status"],
                        "current_agent": state.get("current_agent"),
                        "updated_at": state.get("updated_at"),
                    })

        return projects

    def get_project_history(self, project_id: str) -> List[Dict[str, Any]]:
        """Get full handoff history for a project"""
        log_dir = self.project_dir / project_id / "handoff_log"

        if not log_dir.exists():
            return []

        history = []
        for log_file in sorted(log_dir.glob("*.yaml")):
            with open(log_file) as f:
                history.append(yaml.safe_load(f))

        return history

    def get_blocked_projects(self) -> List[Dict[str, Any]]:
        """Get all blocked projects that need human input"""
        blocked = []

        for project in self.list_projects():
            if project["status"] == "blocked":
                state = self.get_project_state(project["project_id"])
                blocked.append({
                    "project_id": project["project_id"],
                    "blockers": state.blockers,
                    "current_agent": state.current_agent,
                })

        return blocked


# Example usage
if __name__ == "__main__":
    print("NEXUS Orchestrator")
    print("=" * 50)

    # Initialize orchestrator
    orchestrator = NexusOrchestrator(project_dir="./test_projects")

    # Example brief
    example_brief = """# ORIGINAL BRIEF

## Project Metadata
| Field | Value |
|-------|-------|
| **Project ID** | `store-ai-auth` |
| **Project Name** | Store AI Authentication |
| **Created** | 2026-01-25 |

## The Problem
Users currently have no way to securely access the store AI server.

## The Solution
Simple JWT-based authentication with local SQLite storage.

## Scope
### In Scope
- User registration
- Login/logout
- JWT tokens

### Out of Scope
- OAuth
- Role-based permissions
- Password reset via email
"""

    # Create project
    try:
        project = orchestrator.create_project(
            project_id="store-ai-auth",
            brief=example_brief
        )
        print(f"Created project: {project['project_id']}")
    except ValueError as e:
        print(f"Project exists: {e}")

    # Example handoff
    example_handoff = {
        "handoff": {
            "from_agent": "architect",
            "to_agent": "implementer",
            "task_id": "store-ai-auth",
            "summary": {
                "what_was_done": "Designed JWT auth system with SQLite backend",
                "decisions_made": [
                    {
                        "decision": "Use JWT",
                        "rationale": "Stateless, simple, works offline",
                        "alternatives_rejected": ["Sessions - need store"],
                    }
                ],
                "current_state": {
                    "files_created": ["/docs/auth-arch.md"],
                    "files_modified": [],
                    "dependencies_added": [],
                },
            },
            "context_for_next_agent": {
                "must_know": ["Local only", "Max 50 users", "Offline capable"],
                "original_intent": "Build simple secure auth for store AI POC. Local, offline, privacy-first.",
                "scope_boundaries": {
                    "in_scope": ["Registration", "Login", "JWT"],
                    "out_of_scope": ["OAuth", "Roles", "Email reset"],
                },
            },
            "architecture": {
                "overview": "JWT auth with SQLite",
                "components": [{"name": "auth-service", "purpose": "Auth", "technology": "Node"}],
            },
            "status": {"completion": "complete"},
            "next_steps": {
                "implementation_order": [
                    {"priority": 1, "task": "JWT middleware"},
                    {"priority": 2, "task": "Register endpoint"},
                ],
                "warnings": ["Don't add roles"],
            },
            "verification": {
                "how_to_verify": "Can register, login, and access protected endpoints",
            },
        }
    }

    # Process handoff
    result = orchestrator.process_handoff(
        project_id="store-ai-auth",
        handoff_data=example_handoff,
        from_agent="architect"
    )

    print(f"\nHandoff result:")
    print(f"  Valid: {result['is_valid']}")
    print(f"  Handoff ID: {result['handoff_id']}")
    print(f"  Next agent: {result['next_agent']}")

    if result['errors']:
        print(f"  Errors: {result['errors']}")

    print("\n" + "=" * 50)
    print("Orchestrator test complete.")
