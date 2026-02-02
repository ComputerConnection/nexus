"""
NEXUS Handoff Validator

Validates handoff blocks against the protocol schema.
Rejects invalid handoffs before they can cause drift.

Usage:
    from handoff_validator import HandoffValidator

    validator = HandoffValidator()
    result = validator.validate(handoff_data, from_agent="implementer")

    if result.is_valid:
        # Proceed with handoff
    else:
        # Reject and return errors
        print(result.errors)
"""

import yaml
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class AgentType(Enum):
    ARCHITECT = "architect"
    IMPLEMENTER = "implementer"
    SECURITY = "security"
    TESTER = "tester"
    DEVOPS = "devops"


class CompletionStatus(Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    BLOCKED = "blocked"


@dataclass
class ValidationResult:
    """Result of handoff validation"""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    handoff_id: Optional[str] = None

    def add_error(self, error: str):
        self.errors.append(error)
        self.is_valid = False

    def add_warning(self, warning: str):
        self.warnings.append(warning)


class HandoffValidator:
    """
    Validates handoff blocks against NEXUS protocol.

    Enforces:
    - Required fields present
    - Agent-specific sections included
    - Status-dependent fields filled
    - Scope boundaries defined
    - Original intent preserved
    """

    # Required fields for ALL handoffs
    REQUIRED_BASE_FIELDS = [
        "handoff.from_agent",
        "handoff.to_agent",
        "handoff.task_id",
        "handoff.summary.what_was_done",
        "handoff.summary.decisions_made",
        "handoff.summary.current_state",
        "handoff.context_for_next_agent.must_know",
        "handoff.context_for_next_agent.original_intent",
        "handoff.context_for_next_agent.scope_boundaries",
        "handoff.status.completion",
        "handoff.next_steps",
        "handoff.verification",
    ]

    # Agent-specific required sections
    AGENT_REQUIRED_SECTIONS = {
        AgentType.ARCHITECT: [
            "handoff.architecture.overview",
            "handoff.architecture.components",
            "handoff.next_steps.implementation_order",
        ],
        AgentType.IMPLEMENTER: [
            "handoff.implementation.key_files",
            "handoff.security_context",  # Required when going to security
            "handoff.testing_context",   # Required when going to tester
        ],
        AgentType.SECURITY: [
            "handoff.findings",
            "handoff.summary.overall_assessment",
            "handoff.summary.risk_level",
        ],
        AgentType.TESTER: [
            "handoff.test_results",
            "handoff.test_results.summary",
        ],
        AgentType.DEVOPS: [
            "handoff.deployment",
            "handoff.deployment.target",
            "handoff.deployment.version",
            "handoff.rollback",
        ],
    }

    # Required when status is partial
    PARTIAL_REQUIRED = [
        "handoff.status.if_partial.remaining_work",
        "handoff.status.if_partial.why_stopping",
    ]

    # Required when status is blocked
    BLOCKED_REQUIRED = [
        "handoff.status.if_blocked.blocker",
        "handoff.status.if_blocked.needs_from",
        "handoff.status.if_blocked.unblock_criteria",
    ]

    def __init__(self, strict_mode: bool = True):
        """
        Initialize validator.

        Args:
            strict_mode: If True, warnings become errors
        """
        self.strict_mode = strict_mode

    def validate(
        self,
        handoff_data: Dict[str, Any],
        from_agent: str,
        to_agent: Optional[str] = None
    ) -> ValidationResult:
        """
        Validate a handoff block.

        Args:
            handoff_data: The handoff data (parsed YAML/JSON)
            from_agent: Agent type that created this handoff
            to_agent: Agent type receiving this handoff (optional)

        Returns:
            ValidationResult with is_valid, errors, and warnings
        """
        result = ValidationResult(is_valid=True)

        # Validate agent type
        try:
            agent_type = AgentType(from_agent.lower())
        except ValueError:
            result.add_error(f"Invalid from_agent: {from_agent}. Must be one of: {[a.value for a in AgentType]}")
            return result

        # Check base required fields
        self._validate_required_fields(handoff_data, self.REQUIRED_BASE_FIELDS, result)

        # Check agent-specific required fields
        agent_required = self.AGENT_REQUIRED_SECTIONS.get(agent_type, [])
        self._validate_required_fields(handoff_data, agent_required, result, prefix=f"[{agent_type.value}] ")

        # Validate status-dependent fields
        self._validate_status_fields(handoff_data, result)

        # Validate content quality
        self._validate_content_quality(handoff_data, result)

        # Validate agent-specific rules
        self._validate_agent_specific(handoff_data, agent_type, to_agent, result)

        # Generate handoff ID if valid
        if result.is_valid:
            result.handoff_id = self._generate_handoff_id(handoff_data, from_agent)

        # In strict mode, warnings become errors
        if self.strict_mode and result.warnings:
            for warning in result.warnings:
                result.add_error(f"[STRICT] {warning}")

        return result

    def _validate_required_fields(
        self,
        data: Dict[str, Any],
        required_fields: List[str],
        result: ValidationResult,
        prefix: str = ""
    ):
        """Check that required fields are present and non-empty"""
        for field_path in required_fields:
            value = self._get_nested_value(data, field_path)
            if value is None:
                result.add_error(f"{prefix}Missing required field: {field_path}")
            elif isinstance(value, str) and not value.strip():
                result.add_error(f"{prefix}Empty required field: {field_path}")
            elif isinstance(value, list) and len(value) == 0:
                result.add_error(f"{prefix}Empty required list: {field_path}")

    def _validate_status_fields(self, data: Dict[str, Any], result: ValidationResult):
        """Validate status-dependent required fields"""
        status = self._get_nested_value(data, "handoff.status.completion")

        if status == "partial":
            self._validate_required_fields(data, self.PARTIAL_REQUIRED, result, prefix="[PARTIAL] ")

        elif status == "blocked":
            self._validate_required_fields(data, self.BLOCKED_REQUIRED, result, prefix="[BLOCKED] ")

    def _validate_content_quality(self, data: Dict[str, Any], result: ValidationResult):
        """Validate content quality (not just presence)"""

        # Check original_intent is substantial
        original_intent = self._get_nested_value(data, "handoff.context_for_next_agent.original_intent")
        if original_intent and len(str(original_intent).strip()) < 20:
            result.add_warning("original_intent seems too short - are you preserving context?")

        # Check decisions have rationale
        decisions = self._get_nested_value(data, "handoff.summary.decisions_made") or []
        for i, decision in enumerate(decisions):
            if isinstance(decision, dict):
                if not decision.get("rationale"):
                    result.add_warning(f"Decision {i+1} missing rationale - this causes drift")

        # Check scope boundaries are defined
        scope = self._get_nested_value(data, "handoff.context_for_next_agent.scope_boundaries") or {}
        if not scope.get("in_scope"):
            result.add_warning("No in_scope defined - agents won't know what to do")
        if not scope.get("out_of_scope"):
            result.add_warning("No out_of_scope defined - agents might add unwanted features")

        # Check verification is actionable
        verification = self._get_nested_value(data, "handoff.verification")
        if verification:
            how_to_verify = verification.get("how_to_verify") or verification.get("how_to_verify_implementation")
            if not how_to_verify:
                result.add_warning("No verification method specified - how will we know it works?")

    def _validate_agent_specific(
        self,
        data: Dict[str, Any],
        from_agent: AgentType,
        to_agent: Optional[str],
        result: ValidationResult
    ):
        """Validate agent-specific rules"""

        # Implementer → Security: security_context required
        if from_agent == AgentType.IMPLEMENTER and to_agent == "security":
            if not self._get_nested_value(data, "handoff.security_context"):
                result.add_error("[IMPLEMENTER→SECURITY] security_context section is required")
            else:
                # Validate security context has user inputs documented
                user_inputs = self._get_nested_value(data, "handoff.security_context.user_inputs")
                if not user_inputs:
                    result.add_error("[IMPLEMENTER→SECURITY] security_context.user_inputs must document all external inputs")

        # Implementer → Tester: testing_context required
        if from_agent == AgentType.IMPLEMENTER and to_agent == "tester":
            if not self._get_nested_value(data, "handoff.testing_context"):
                result.add_error("[IMPLEMENTER→TESTER] testing_context section is required")
            else:
                # Validate testing context has what_to_test
                what_to_test = self._get_nested_value(data, "handoff.testing_context.what_to_test")
                if not what_to_test:
                    result.add_error("[IMPLEMENTER→TESTER] testing_context.what_to_test must be defined")

        # Security: must have overall assessment
        if from_agent == AgentType.SECURITY:
            assessment = self._get_nested_value(data, "handoff.summary.overall_assessment")
            valid_assessments = ["approved", "approved_with_conditions", "needs_fixes", "rejected"]
            if assessment not in valid_assessments:
                result.add_error(f"[SECURITY] overall_assessment must be one of: {valid_assessments}")

        # Tester: bugs must have classification
        if from_agent == AgentType.TESTER:
            bugs = self._get_nested_value(data, "handoff.bugs") or {}
            for severity in ["critical", "high", "medium", "low"]:
                severity_bugs = bugs.get(severity, [])
                for i, bug in enumerate(severity_bugs):
                    if isinstance(bug, dict) and not bug.get("classification"):
                        result.add_warning(f"[TESTER] Bug {bug.get('bug_id', i+1)} missing classification (bug vs feature_request)")

        # DevOps: must have rollback plan
        if from_agent == AgentType.DEVOPS:
            rollback = self._get_nested_value(data, "handoff.rollback.plan")
            if not rollback:
                result.add_error("[DEVOPS] rollback.plan is required - how do we undo this?")

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get a nested value from a dict using dot notation"""
        keys = path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value

    def _generate_handoff_id(self, data: Dict[str, Any], from_agent: str) -> str:
        """Generate a unique handoff ID"""
        task_id = self._get_nested_value(data, "handoff.task_id") or "unknown"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        to_agent = self._get_nested_value(data, "handoff.to_agent") or "any"
        return f"{task_id}_{from_agent}_to_{to_agent}_{timestamp}"


class HandoffLogger:
    """
    Logs all handoffs to append-only log for debugging and audit.
    """

    def __init__(self, log_dir: str = "./handoff_logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def log_handoff(
        self,
        handoff_data: Dict[str, Any],
        validation_result: ValidationResult,
        project_id: str
    ) -> str:
        """
        Log a handoff to the project's handoff log.

        Returns the log file path.
        """
        project_dir = self.log_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        # Get existing log count for numbering
        existing_logs = list(project_dir.glob("*.yaml"))
        log_number = len(existing_logs) + 1

        # Create log entry
        log_entry = {
            "handoff_id": validation_result.handoff_id,
            "logged_at": datetime.now().isoformat(),
            "validation": {
                "is_valid": validation_result.is_valid,
                "errors": validation_result.errors,
                "warnings": validation_result.warnings,
            },
            "handoff": handoff_data,
        }

        # Write log
        from_agent = handoff_data.get("handoff", {}).get("from_agent", "unknown")
        to_agent = handoff_data.get("handoff", {}).get("to_agent", "unknown")
        log_filename = f"{log_number:03d}_{from_agent}_to_{to_agent}.yaml"
        log_path = project_dir / log_filename

        with open(log_path, "w") as f:
            yaml.dump(log_entry, f, default_flow_style=False, allow_unicode=True)

        return str(log_path)


class AgentBoundaryEnforcer:
    """
    Enforces agent boundaries - what each agent can and cannot do.
    """

    # What each agent is allowed to modify
    ALLOWED_ACTIONS = {
        AgentType.ARCHITECT: {
            "can_modify": ["docs", "diagrams", "specs"],
            "cannot_modify": ["src", "tests", "config"],
            "can_create": ["architecture docs", "api contracts", "diagrams"],
        },
        AgentType.IMPLEMENTER: {
            "can_modify": ["src", "config"],
            "cannot_modify": ["docs/architecture"],  # That's architect's domain
            "can_create": ["source files", "config files"],
        },
        AgentType.SECURITY: {
            "can_modify": [],  # Security reviews, doesn't modify
            "cannot_modify": ["src", "config", "docs"],
            "can_create": ["security reports", "findings"],
        },
        AgentType.TESTER: {
            "can_modify": ["tests"],
            "cannot_modify": ["src"],  # Tester doesn't fix, only reports
            "can_create": ["test files", "test reports"],
        },
        AgentType.DEVOPS: {
            "can_modify": ["deployment", "infrastructure", "ci-cd"],
            "cannot_modify": ["src"],  # DevOps doesn't change app code
            "can_create": ["deployment configs", "scripts", "runbooks"],
        },
    }

    def check_boundary(
        self,
        agent_type: AgentType,
        action: str,
        target: str
    ) -> tuple[bool, str]:
        """
        Check if an agent is allowed to perform an action.

        Args:
            agent_type: The agent attempting the action
            action: "modify" or "create"
            target: What they're trying to modify/create

        Returns:
            (is_allowed, reason)
        """
        rules = self.ALLOWED_ACTIONS.get(agent_type, {})

        if action == "modify":
            cannot_modify = rules.get("cannot_modify", [])
            for restricted in cannot_modify:
                if restricted in target or target.startswith(restricted):
                    return False, f"{agent_type.value} cannot modify {restricted}"
            return True, "Allowed"

        return True, "Allowed"


# Convenience function for quick validation
def validate_handoff(
    handoff_yaml: str,
    from_agent: str,
    to_agent: Optional[str] = None,
    strict: bool = True
) -> ValidationResult:
    """
    Convenience function to validate a handoff from YAML string.

    Args:
        handoff_yaml: YAML string of the handoff
        from_agent: Agent type that created the handoff
        to_agent: Agent type receiving the handoff
        strict: Whether to run in strict mode

    Returns:
        ValidationResult
    """
    try:
        data = yaml.safe_load(handoff_yaml)
    except yaml.YAMLError as e:
        result = ValidationResult(is_valid=False)
        result.add_error(f"Invalid YAML: {e}")
        return result

    validator = HandoffValidator(strict_mode=strict)
    return validator.validate(data, from_agent, to_agent)


# Example usage and testing
if __name__ == "__main__":
    # Example handoff for testing
    example_handoff = """
    handoff:
      from_agent: architect
      to_agent: implementer
      timestamp: 2026-01-25T20:00:00Z
      task_id: store-ai-auth

      summary:
        what_was_done: |
          Designed authentication system for store AI server.
          JWT-based auth with local SQLite storage.

        decisions_made:
          - decision: Use JWT for auth
            rationale: Stateless, scales well, simple to implement
            alternatives_rejected:
              - Session cookies - requires session store

        current_state:
          files_created:
            - /docs/auth-architecture.md
          files_modified: []
          dependencies_added: []

      context_for_next_agent:
        must_know:
          - Auth is local only
          - Max 50 users
          - Must work offline

        original_intent: |
          Build simple, secure authentication for the store AI server POC.
          Local only, no external dependencies, privacy-first.

        scope_boundaries:
          in_scope:
            - User registration
            - Login/logout
            - JWT tokens
          out_of_scope:
            - Role-based permissions
            - OAuth
            - Password reset

      architecture:
        overview: |
          Simple JWT auth with SQLite backend.
        components:
          - name: auth-service
            purpose: Handle registration and login
            technology: Node.js/Express

      status:
        completion: complete

      next_steps:
        implementation_order:
          - priority: 1
            task: JWT middleware
          - priority: 2
            task: Register endpoint
          - priority: 3
            task: Login endpoint

        warnings:
          - Don't add roles yet

      verification:
        how_to_verify: |
          Can register, login, and access protected endpoints.
    """

    print("Testing handoff validation...")
    print("-" * 50)

    result = validate_handoff(example_handoff, "architect", "implementer")

    print(f"Valid: {result.is_valid}")
    print(f"Handoff ID: {result.handoff_id}")

    if result.errors:
        print("\nErrors:")
        for error in result.errors:
            print(f"  - {error}")

    if result.warnings:
        print("\nWarnings:")
        for warning in result.warnings:
            print(f"  - {warning}")

    print("-" * 50)
    print("Validation complete.")
