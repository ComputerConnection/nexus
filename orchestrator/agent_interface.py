"""
NEXUS Agent Interface

Interface for agents to interact with the orchestrator.
Provides task context, handoff submission, and protocol guidance.

Usage:
    from agent_interface import AgentInterface

    agent = AgentInterface(
        orchestrator=orchestrator,
        agent_type="implementer",
        project_id="store-ai-auth"
    )

    # Get task context
    context = agent.get_context()

    # ... do work ...

    # Submit handoff
    result = agent.submit_handoff(handoff_data)
"""

import yaml
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime

from orchestrator import NexusOrchestrator
from handoff_validator import AgentType


class AgentInterface:
    """
    Interface for agents to interact with NEXUS orchestrator.

    Provides:
    - Task context (brief, current state, recent handoffs)
    - Handoff submission with validation
    - Template access
    - Protocol reminders
    """

    def __init__(
        self,
        orchestrator: NexusOrchestrator,
        agent_type: str,
        project_id: str
    ):
        """
        Initialize agent interface.

        Args:
            orchestrator: The NEXUS orchestrator instance
            agent_type: Type of this agent (architect, implementer, etc.)
            project_id: Project this agent is working on
        """
        self.orchestrator = orchestrator
        self.agent_type = AgentType(agent_type.lower())
        self.project_id = project_id

        # Load template for this agent type
        self.template = self._load_template()

    def _load_template(self) -> str:
        """Load the handoff template for this agent type"""
        template_dir = Path(__file__).parent.parent / "templates"
        template_file = template_dir / f"{self.agent_type.value}_handoff.yaml"

        if template_file.exists():
            with open(template_file) as f:
                return f.read()
        return ""

    # =========================================================================
    # CONTEXT RETRIEVAL
    # =========================================================================

    def get_context(self) -> Dict[str, Any]:
        """
        Get full context for the current task.

        Returns:
            Dict containing:
            - original_brief: The immutable project brief
            - current_state: Latest handoff/state
            - previous_handoff: The handoff that assigned this task
            - recent_decisions: Recent decisions made
            - protocol_reminder: What this agent should do
            - template: Handoff template for this agent
        """
        project_path = self.orchestrator.project_dir / self.project_id

        # Get original brief
        brief_path = project_path / "ORIGINAL_BRIEF.md"
        brief = ""
        if brief_path.exists():
            with open(brief_path) as f:
                brief = f.read()

        # Get current state
        state_path = project_path / "CURRENT_STATE.yaml"
        current_state = {}
        if state_path.exists():
            with open(state_path) as f:
                current_state = yaml.safe_load(f) or {}

        # Get previous handoff (the one that triggered this work)
        previous_handoff = self._get_previous_handoff()

        # Get recent decisions
        decisions = self._get_recent_decisions()

        return {
            "project_id": self.project_id,
            "agent_type": self.agent_type.value,
            "original_brief": brief,
            "current_state": current_state,
            "previous_handoff": previous_handoff,
            "recent_decisions": decisions,
            "protocol_reminder": self._get_protocol_reminder(),
            "template": self.template,
            "anti_drift_rules": self._get_anti_drift_rules(),
            "scope_boundaries": self._extract_scope_boundaries(current_state),
        }

    def _get_previous_handoff(self) -> Optional[Dict[str, Any]]:
        """Get the most recent handoff"""
        history = self.orchestrator.get_project_history(self.project_id)
        if history:
            return history[-1]
        return None

    def _get_recent_decisions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent decisions from decision log"""
        decision_log = self.orchestrator.project_dir / self.project_id / "decisions" / "DECISION_LOG.md"

        if not decision_log.exists():
            return []

        decisions = []
        with open(decision_log) as f:
            lines = f.readlines()

        # Parse markdown table (skip header)
        for line in lines[3:]:  # Skip header rows
            if line.strip() and line.startswith("|"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 4:
                    decisions.append({
                        "date": parts[0],
                        "agent": parts[1],
                        "decision": parts[2],
                        "rationale": parts[3],
                    })

        return decisions[-limit:]

    def _extract_scope_boundaries(self, current_state: Dict[str, Any]) -> Dict[str, Any]:
        """Extract scope boundaries from current state"""
        handoff = current_state.get("handoff", {})
        context = handoff.get("context_for_next_agent", {})
        return context.get("scope_boundaries", {"in_scope": [], "out_of_scope": []})

    def _get_protocol_reminder(self) -> str:
        """Get protocol reminder specific to this agent type"""
        reminders = {
            AgentType.ARCHITECT: """
## ARCHITECT PROTOCOL REMINDER

Your job: Design the solution. Don't implement.

Required in your handoff:
- Architecture overview and component diagram
- API contracts / interfaces
- Data models
- Non-functional requirements
- WHY you chose this architecture (prevents implementer "improvements")
- Implementation order with priorities
- Explicit "do not" list for implementer

Anti-drift:
- Don't over-engineer for hypothetical future
- Design for stated constraints only
- If requirements are unclear, STOP and ask
""",
            AgentType.IMPLEMENTER: """
## IMPLEMENTER PROTOCOL REMINDER

Your job: Build what architect designed. Don't redesign.

Required in your handoff:
- Files modified/created
- Dependencies added (with justification)
- Deviations from design (if any, with architect approval)
- Security context (all inputs, auth, data storage)
- Testing context (what to test, how, what NOT to test)
- How to verify your work

Anti-drift:
- Follow architect's design unless you have a BLOCKING reason
- No "while I'm here" improvements
- Out of scope = don't touch, log as tech debt
- If you want to deviate, ASK first
""",
            AgentType.SECURITY: """
## SECURITY PROTOCOL REMINDER

Your job: Review for vulnerabilities. Don't refactor.

Required in your handoff:
- Findings by severity (critical/high/medium/low)
- Positive findings (what was done well)
- Specific remediation for each issue
- Clear acceptance criteria for fixes
- Risk level assessment

Anti-drift:
- Only flag security issues
- Don't expand scope to code quality/style
- Don't add features
- Re-review only the specific fixes, not entire codebase
""",
            AgentType.TESTER: """
## TESTER PROTOCOL REMINDER

Your job: Verify it works. Report bugs. Don't fix.

Required in your handoff:
- Test results summary (passed/failed/skipped)
- Bug reports with reproduction steps
- Classification: bug vs feature request (be honest)
- What NOT bugs section
- Fix scope for implementer

Anti-drift:
- Test what's in scope only
- Out of scope features are NOT bugs
- Don't request features disguised as bugs
- Fix scope is ONLY the specific bugs
""",
            AgentType.DEVOPS: """
## DEVOPS PROTOCOL REMINDER

Your job: Deploy and configure. Don't modify app code.

Required in your handoff:
- Deployment details (what, where, how)
- Configuration changes
- Rollback plan (tested!)
- Health check verification
- Operational runbook

Anti-drift:
- Don't modify application code
- Don't "optimize" things not in scope
- If deployment needs code changes, hand back to implementer
""",
        }
        return reminders.get(self.agent_type, "")

    def _get_anti_drift_rules(self) -> List[str]:
        """Get anti-drift rules"""
        return [
            "1. NO SCOPE CREEP - If it's not in scope, log it as tech debt, don't do it",
            "2. NO 'WHILE I'M HERE' - Only modify what's required for your task",
            "3. ORIGINAL INTENT IS SACRED - Every handoff restates original_intent",
            "4. EXPLICIT > IMPLICIT - Over-communicate, never assume",
            "5. QUESTIONS PAUSE WORK - If unsure, STOP and ask",
            "6. VERIFY YOUR SCOPE - Check in_scope and out_of_scope before working",
        ]

    # =========================================================================
    # HANDOFF SUBMISSION
    # =========================================================================

    def submit_handoff(
        self,
        handoff_data: Dict[str, Any],
        to_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a handoff for validation and processing.

        Args:
            handoff_data: The handoff data
            to_agent: Target agent (can also be in handoff_data)

        Returns:
            Result dict with validation status
        """
        # Ensure from_agent is set correctly
        if "handoff" not in handoff_data:
            handoff_data = {"handoff": handoff_data}

        handoff_data["handoff"]["from_agent"] = self.agent_type.value
        handoff_data["handoff"]["timestamp"] = datetime.now().isoformat()

        if to_agent:
            handoff_data["handoff"]["to_agent"] = to_agent

        # Submit to orchestrator
        result = self.orchestrator.process_handoff(
            project_id=self.project_id,
            handoff_data=handoff_data,
            from_agent=self.agent_type.value,
            to_agent=to_agent
        )

        return result

    def create_handoff_from_template(self) -> Dict[str, Any]:
        """
        Create a handoff skeleton from the agent's template.

        Returns:
            Dict structure ready to be filled in
        """
        if self.template:
            # Parse template and return structure
            parsed = yaml.safe_load(self.template)
            return parsed
        return {"handoff": {}}

    # =========================================================================
    # HELPERS
    # =========================================================================

    def check_scope(self, item: str) -> Dict[str, Any]:
        """
        Check if an item is in scope.

        Args:
            item: Item to check (feature, task, etc.)

        Returns:
            Dict with in_scope, out_of_scope, and recommendation
        """
        context = self.get_context()
        scope = context.get("scope_boundaries", {})

        in_scope = scope.get("in_scope", [])
        out_of_scope = scope.get("out_of_scope", [])

        item_lower = item.lower()

        # Check against in_scope
        for s in in_scope:
            if item_lower in s.lower() or s.lower() in item_lower:
                return {
                    "item": item,
                    "status": "in_scope",
                    "recommendation": "Proceed with this work",
                }

        # Check against out_of_scope
        for s in out_of_scope:
            if item_lower in s.lower() or s.lower() in item_lower:
                return {
                    "item": item,
                    "status": "out_of_scope",
                    "recommendation": "DO NOT work on this. Log as technical debt.",
                }

        return {
            "item": item,
            "status": "unclear",
            "recommendation": "Not explicitly in or out of scope. Ask for clarification before proceeding.",
        }

    def log_technical_debt(self, item: str, reason: str, severity: str = "medium"):
        """
        Log an item as technical debt (something noticed but not worked on).

        Args:
            item: What was deferred
            reason: Why it was deferred
            severity: low/medium/high
        """
        debt_file = self.orchestrator.project_dir / self.project_id / "TECHNICAL_DEBT.md"

        # Create file if doesn't exist
        if not debt_file.exists():
            with open(debt_file, "w") as f:
                f.write("# Technical Debt Log\n\n")
                f.write("| Date | Agent | Item | Reason | Severity |\n")
                f.write("|------|-------|------|--------|----------|\n")

        # Append debt item
        with open(debt_file, "a") as f:
            date = datetime.now().strftime("%Y-%m-%d")
            f.write(f"| {date} | {self.agent_type.value} | {item} | {reason} | {severity} |\n")

    def ask_human(self, question: str, context: str = "") -> None:
        """
        Log a question that needs human input.
        Marks the project as needing attention.

        Args:
            question: The question
            context: Additional context
        """
        questions_file = self.orchestrator.project_dir / self.project_id / "QUESTIONS_FOR_HUMAN.md"

        # Create file if doesn't exist
        if not questions_file.exists():
            with open(questions_file, "w") as f:
                f.write("# Questions Needing Human Input\n\n")

        # Append question
        with open(questions_file, "a") as f:
            date = datetime.now().strftime("%Y-%m-%d %H:%M")
            f.write(f"\n## [{date}] From {self.agent_type.value}\n\n")
            f.write(f"**Question:** {question}\n\n")
            if context:
                f.write(f"**Context:** {context}\n\n")
            f.write("**Status:** PENDING\n\n---\n")

        print(f"[NEXUS] Question logged for human: {question}")


class AgentPromptBuilder:
    """
    Builds prompts for LLM-powered agents with full context.
    """

    def __init__(self, agent_interface: AgentInterface):
        self.interface = agent_interface

    def build_task_prompt(self, task_description: str) -> str:
        """
        Build a complete prompt for an agent to execute a task.

        Args:
            task_description: What the agent should do

        Returns:
            Complete prompt with all context
        """
        context = self.interface.get_context()

        prompt = f"""# NEXUS Agent Task

## Your Role
You are the **{context['agent_type'].upper()}** agent in NEXUS.

## Your Task
{task_description}

## Original Brief
{context['original_brief']}

## Current State
```yaml
{yaml.dump(context['current_state'], default_flow_style=False)}
```

## Previous Handoff
```yaml
{yaml.dump(context['previous_handoff'], default_flow_style=False) if context['previous_handoff'] else 'None - this is the first task'}
```

## Scope Boundaries
**In Scope (DO work on these):**
{chr(10).join('- ' + s for s in context['scope_boundaries'].get('in_scope', []))}

**Out of Scope (DO NOT work on these):**
{chr(10).join('- ' + s for s in context['scope_boundaries'].get('out_of_scope', []))}

## Recent Decisions
{chr(10).join(f"- [{d['date']}] {d['agent']}: {d['decision']} ({d['rationale']})" for d in context['recent_decisions']) if context['recent_decisions'] else 'None yet'}

{context['protocol_reminder']}

## Anti-Drift Rules
{chr(10).join(context['anti_drift_rules'])}

## Your Output
Complete your task and then produce a handoff block using this template:

```yaml
{context['template'][:2000]}...
```

Remember:
- Your work is NOT complete until you produce a valid handoff
- Restate original_intent
- Document all decisions with rationale
- Stay within scope
- If blocked or unsure, STOP and document what you need
"""
        return prompt

    def build_handoff_reminder(self) -> str:
        """Build a reminder prompt for handoff completion"""
        context = self.interface.get_context()

        return f"""
# HANDOFF REQUIRED

You must now produce your handoff block before your work is complete.

Required sections:
- summary.what_was_done
- summary.decisions_made (with rationale!)
- summary.current_state
- context_for_next_agent.must_know
- context_for_next_agent.original_intent (RESTATE from brief)
- context_for_next_agent.scope_boundaries
- status.completion
- next_steps
- verification

Template:
```yaml
{context['template'][:3000]}
```

Anti-drift checklist:
- [ ] Did I stay within scope?
- [ ] Did I document WHY for all decisions?
- [ ] Did I restate original intent?
- [ ] Did I specify what NOT to do?
- [ ] Did I explain how to verify my work?
"""


# Convenience function
def create_agent(
    project_dir: str,
    agent_type: str,
    project_id: str
) -> AgentInterface:
    """
    Create an agent interface.

    Args:
        project_dir: Base project directory
        agent_type: Type of agent
        project_id: Project ID

    Returns:
        AgentInterface instance
    """
    orchestrator = NexusOrchestrator(project_dir=project_dir)
    return AgentInterface(orchestrator, agent_type, project_id)
