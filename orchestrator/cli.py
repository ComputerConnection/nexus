#!/usr/bin/env python3
"""
NEXUS CLI

Command-line interface for NEXUS orchestrator operations.

Usage:
    python cli.py create-project <project_id> --brief <brief_file>
    python cli.py list-projects
    python cli.py project-status <project_id>
    python cli.py validate-handoff <handoff_file> --from <agent>
    python cli.py assign-task <project_id> --agent <agent> --task "description"
"""

import argparse
import sys
import yaml
from pathlib import Path

from orchestrator import NexusOrchestrator
from agent_interface import AgentInterface, AgentPromptBuilder


def create_project(args):
    """Create a new project"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)

    # Read brief file
    brief_path = Path(args.brief)
    if not brief_path.exists():
        print(f"Error: Brief file not found: {args.brief}")
        sys.exit(1)

    with open(brief_path) as f:
        brief = f.read()

    try:
        result = orchestrator.create_project(
            project_id=args.project_id,
            brief=brief
        )
        print(f"Created project: {result['project_id']}")
        print(f"Path: {result['path']}")
        print(f"Brief: {result['brief_path']}")
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


def list_projects(args):
    """List all projects"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)
    projects = orchestrator.list_projects()

    if not projects:
        print("No projects found.")
        return

    print(f"{'Project ID':<30} {'Status':<15} {'Current Agent':<15} {'Updated'}")
    print("-" * 80)
    for p in projects:
        print(f"{p['project_id']:<30} {p['status']:<15} {p.get('current_agent', '-'):<15} {p.get('updated_at', '-')[:19]}")


def project_status(args):
    """Show project status"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)

    try:
        state = orchestrator.get_project_state(args.project_id)
        print(f"Project: {state.project_id}")
        print(f"Status: {state.status.value}")
        print(f"Current Agent: {state.current_agent or 'None'}")
        print(f"Last Handoff: {state.last_handoff or 'None'}")
        print(f"Created: {state.created_at}")
        print(f"Updated: {state.updated_at}")

        if state.blockers:
            print(f"\nBlockers:")
            for b in state.blockers:
                print(f"  - {b}")

        # Show recent history
        history = orchestrator.get_project_history(args.project_id)
        if history:
            print(f"\nRecent Handoffs ({len(history)} total):")
            for h in history[-5:]:
                handoff = h.get("handoff", {})
                print(f"  - {handoff.get('from_agent', '?')} -> {handoff.get('to_agent', '?')}: {h.get('validation', {}).get('is_valid', '?')}")

    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


def validate_handoff(args):
    """Validate a handoff file"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)

    # Read handoff file
    handoff_path = Path(args.handoff)
    if not handoff_path.exists():
        print(f"Error: Handoff file not found: {args.handoff}")
        sys.exit(1)

    with open(handoff_path) as f:
        handoff_data = yaml.safe_load(f)

    # Validate
    from handoff_validator import HandoffValidator
    validator = HandoffValidator(strict_mode=args.strict)
    result = validator.validate(handoff_data, args.from_agent, args.to_agent)

    print(f"Valid: {result.is_valid}")
    print(f"Handoff ID: {result.handoff_id}")

    if result.errors:
        print(f"\nErrors ({len(result.errors)}):")
        for e in result.errors:
            print(f"  [ERROR] {e}")

    if result.warnings:
        print(f"\nWarnings ({len(result.warnings)}):")
        for w in result.warnings:
            print(f"  [WARN] {w}")

    if result.is_valid:
        print("\nHandoff is valid and ready to submit.")
    else:
        print("\nHandoff is INVALID. Fix errors before submitting.")
        sys.exit(1)


def process_handoff(args):
    """Process a handoff through the orchestrator"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)

    # Read handoff file
    handoff_path = Path(args.handoff)
    if not handoff_path.exists():
        print(f"Error: Handoff file not found: {args.handoff}")
        sys.exit(1)

    with open(handoff_path) as f:
        handoff_data = yaml.safe_load(f)

    # Process
    result = orchestrator.process_handoff(
        project_id=args.project_id,
        handoff_data=handoff_data,
        from_agent=args.from_agent,
        to_agent=args.to_agent
    )

    print(f"Valid: {result['is_valid']}")
    print(f"Handoff ID: {result['handoff_id']}")
    print(f"Log: {result['log_path']}")
    print(f"Next Agent: {result['next_agent']}")

    if result['drift_check']['has_drift']:
        print(f"\nDrift Detected:")
        for issue in result['drift_check']['issues']:
            print(f"  [DRIFT] {issue}")

    if result['errors']:
        print(f"\nErrors:")
        for e in result['errors']:
            print(f"  [ERROR] {e}")

    if result['is_valid']:
        print("\nHandoff processed successfully.")
    else:
        print("\nHandoff REJECTED. Fix errors and resubmit.")
        sys.exit(1)


def assign_task(args):
    """Generate task assignment for an agent"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)
    interface = AgentInterface(orchestrator, args.agent, args.project_id)
    builder = AgentPromptBuilder(interface)

    prompt = builder.build_task_prompt(args.task)

    if args.output:
        with open(args.output, "w") as f:
            f.write(prompt)
        print(f"Task prompt written to: {args.output}")
    else:
        print(prompt)


def show_template(args):
    """Show handoff template for an agent type"""
    template_dir = Path(__file__).parent.parent / "templates"
    template_file = template_dir / f"{args.agent}_handoff.yaml"

    if not template_file.exists():
        print(f"Error: Template not found for agent type: {args.agent}")
        print(f"Available: architect, implementer, security, tester, devops")
        sys.exit(1)

    with open(template_file) as f:
        print(f.read())


def blocked_projects(args):
    """Show projects that need human input"""
    orchestrator = NexusOrchestrator(project_dir=args.project_dir)
    blocked = orchestrator.get_blocked_projects()

    if not blocked:
        print("No blocked projects.")
        return

    print("Blocked Projects Needing Human Input:")
    print("-" * 50)
    for p in blocked:
        print(f"\nProject: {p['project_id']}")
        print(f"Current Agent: {p['current_agent']}")
        print("Blockers:")
        for b in p['blockers']:
            print(f"  - {b}")


def main():
    parser = argparse.ArgumentParser(
        description="NEXUS Orchestrator CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--project-dir",
        default="./projects",
        help="Base directory for projects (default: ./projects)"
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # create-project
    create_parser = subparsers.add_parser("create-project", help="Create a new project")
    create_parser.add_argument("project_id", help="Unique project identifier")
    create_parser.add_argument("--brief", required=True, help="Path to ORIGINAL_BRIEF.md file")
    create_parser.set_defaults(func=create_project)

    # list-projects
    list_parser = subparsers.add_parser("list-projects", help="List all projects")
    list_parser.set_defaults(func=list_projects)

    # project-status
    status_parser = subparsers.add_parser("project-status", help="Show project status")
    status_parser.add_argument("project_id", help="Project ID")
    status_parser.set_defaults(func=project_status)

    # validate-handoff
    validate_parser = subparsers.add_parser("validate-handoff", help="Validate a handoff file")
    validate_parser.add_argument("handoff", help="Path to handoff YAML file")
    validate_parser.add_argument("--from", dest="from_agent", required=True, help="From agent type")
    validate_parser.add_argument("--to", dest="to_agent", help="To agent type (optional)")
    validate_parser.add_argument("--strict", action="store_true", help="Strict mode (warnings become errors)")
    validate_parser.set_defaults(func=validate_handoff)

    # process-handoff
    process_parser = subparsers.add_parser("process-handoff", help="Process a handoff")
    process_parser.add_argument("project_id", help="Project ID")
    process_parser.add_argument("handoff", help="Path to handoff YAML file")
    process_parser.add_argument("--from", dest="from_agent", required=True, help="From agent type")
    process_parser.add_argument("--to", dest="to_agent", help="To agent type (optional)")
    process_parser.set_defaults(func=process_handoff)

    # assign-task
    assign_parser = subparsers.add_parser("assign-task", help="Generate task assignment prompt")
    assign_parser.add_argument("project_id", help="Project ID")
    assign_parser.add_argument("--agent", required=True, help="Agent type to assign to")
    assign_parser.add_argument("--task", required=True, help="Task description")
    assign_parser.add_argument("--output", help="Output file (default: stdout)")
    assign_parser.set_defaults(func=assign_task)

    # show-template
    template_parser = subparsers.add_parser("show-template", help="Show handoff template")
    template_parser.add_argument("agent", help="Agent type (architect, implementer, etc.)")
    template_parser.set_defaults(func=show_template)

    # blocked
    blocked_parser = subparsers.add_parser("blocked", help="Show blocked projects")
    blocked_parser.set_defaults(func=blocked_projects)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
