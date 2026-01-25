# NEXUS Stream Deck Plugin

Control your NEXUS multi-agent AI system directly from your Stream Deck!

## Features

- **Spawn Agents**: One-button spawning for all agent types
  - Orchestrator, Architect, Implementer, Tester, Security Auditor, DevOps

- **Quick Actions**: Pre-configured tasks
  - Build API, Write Tests, Security Audit, Refactor, Generate Docs, Code Review

- **System Controls**
  - Live status display with agent count
  - Kill all agents button

- **Auto-updating Status**: Agent count updates every 5 seconds

## Installation

### For OpenDeck (Linux)

1. Copy the plugin folder to OpenDeck's plugin directory:
   ```bash
   cp -r me.nexus.streamdeck.sdPlugin ~/.local/share/OpenDeck/Plugins/
   ```

2. Restart OpenDeck

3. The "NEXUS AI" category should appear in your action list

### For Elgato Stream Deck (Windows/Mac)

1. Double-click `me.nexus.streamdeck.streamDeckPlugin` to install

2. The plugin will appear in the Stream Deck software

## Configuration

Each button can be configured with:

- **Working Directory**: The path where agents will work
- **Task**: Optional custom task (overrides default)

## Requirements

- NEXUS must be running with the API server enabled
- API available at `http://localhost:9999/api`

## API Endpoints Used

| Action | Endpoint |
|--------|----------|
| Spawn Agent | `POST /api/agents/spawn/{template}` |
| Quick Action | `POST /api/quick-actions/{action}/execute` |
| System Status | `GET /api/status` |
| Kill All | `DELETE /api/agents` |

## Troubleshooting

**Button shows "Offline"**
- Make sure NEXUS is running
- Check that the API server started (look for "NEXUS API server on http://127.0.0.1:9999")

**Agent doesn't spawn**
- Verify the working directory exists
- Check NEXUS logs for errors

## License

MIT - Part of the NEXUS project
