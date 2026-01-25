/**
 * NEXUS Stream Deck Plugin
 * Controls NEXUS multi-agent AI system from Stream Deck
 */

const NEXUS_API_BASE = 'http://localhost:9999/api';
const POLL_INTERVAL = 5000; // 5 seconds

// Action to template/quick-action mapping
const ACTION_MAP = {
  'me.nexus.streamdeck.spawn-orchestrator': { type: 'spawn', template: 'orchestrator' },
  'me.nexus.streamdeck.spawn-architect': { type: 'spawn', template: 'architect' },
  'me.nexus.streamdeck.spawn-implementer': { type: 'spawn', template: 'implementer' },
  'me.nexus.streamdeck.spawn-tester': { type: 'spawn', template: 'tester' },
  'me.nexus.streamdeck.spawn-security': { type: 'spawn', template: 'security' },
  'me.nexus.streamdeck.spawn-devops': { type: 'spawn', template: 'devops' },
  'me.nexus.streamdeck.quick-build-api': { type: 'quick', action: 'build-api' },
  'me.nexus.streamdeck.quick-write-tests': { type: 'quick', action: 'write-tests' },
  'me.nexus.streamdeck.quick-security-audit': { type: 'quick', action: 'security-audit' },
  'me.nexus.streamdeck.quick-refactor': { type: 'quick', action: 'refactor' },
  'me.nexus.streamdeck.quick-docs': { type: 'quick', action: 'generate-docs' },
  'me.nexus.streamdeck.quick-code-review': { type: 'quick', action: 'code-review' },
  'me.nexus.streamdeck.status': { type: 'status' },
  'me.nexus.streamdeck.kill-all': { type: 'kill-all' },
};

// Store for action contexts and settings
const actionContexts = new Map();
let websocket = null;
let pluginUUID = null;
let statusPollTimer = null;

// ============================================================================
// Stream Deck WebSocket Communication
// ============================================================================

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
  pluginUUID = inPluginUUID;

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    // Register plugin with Stream Deck
    const json = {
      event: inRegisterEvent,
      uuid: inPluginUUID,
    };
    websocket.send(JSON.stringify(json));
    console.log('[NEXUS] Connected to Stream Deck');

    // Start status polling
    startStatusPolling();
  };

  websocket.onmessage = (evt) => {
    const jsonObj = JSON.parse(evt.data);
    const { event, action, context, payload } = jsonObj;

    switch (event) {
      case 'keyDown':
        handleKeyDown(action, context, payload);
        break;
      case 'keyUp':
        // Optional: handle key up
        break;
      case 'willAppear':
        handleWillAppear(action, context, payload);
        break;
      case 'willDisappear':
        handleWillDisappear(action, context);
        break;
      case 'didReceiveSettings':
        handleDidReceiveSettings(action, context, payload);
        break;
      case 'propertyInspectorDidConnect':
        handlePropertyInspectorDidConnect(action, context);
        break;
      case 'sendToPlugin':
        handleSendToPlugin(action, context, payload);
        break;
    }
  };

  websocket.onclose = () => {
    console.log('[NEXUS] Disconnected from Stream Deck');
    stopStatusPolling();
  };
}

// ============================================================================
// Event Handlers
// ============================================================================

function handleKeyDown(action, context, payload) {
  const settings = payload?.settings || {};
  const actionConfig = ACTION_MAP[action];

  if (!actionConfig) {
    console.error(`[NEXUS] Unknown action: ${action}`);
    showAlert(context);
    return;
  }

  switch (actionConfig.type) {
    case 'spawn':
      spawnAgent(context, actionConfig.template, settings);
      break;
    case 'quick':
      executeQuickAction(context, actionConfig.action, settings);
      break;
    case 'status':
      refreshStatus(context);
      break;
    case 'kill-all':
      killAllAgents(context);
      break;
  }
}

function handleWillAppear(action, context, payload) {
  const settings = payload?.settings || {};
  actionContexts.set(context, { action, settings });

  // Update status button immediately
  if (action === 'me.nexus.streamdeck.status') {
    refreshStatus(context);
  }
}

function handleWillDisappear(action, context) {
  actionContexts.delete(context);
}

function handleDidReceiveSettings(action, context, payload) {
  const settings = payload?.settings || {};
  const stored = actionContexts.get(context);
  if (stored) {
    stored.settings = settings;
  }
}

function handlePropertyInspectorDidConnect(action, context) {
  // Send current settings to property inspector
  const stored = actionContexts.get(context);
  if (stored) {
    sendToPropertyInspector(context, {
      event: 'sendToPropertyInspector',
      settings: stored.settings,
    });
  }
}

function handleSendToPlugin(action, context, payload) {
  // Handle messages from property inspector
  if (payload?.event === 'saveSettings') {
    setSettings(context, payload.settings);
  }
}

// ============================================================================
// NEXUS API Functions
// ============================================================================

async function spawnAgent(context, template, settings) {
  const workingDirectory = settings.workingDirectory || '/tmp';
  const task = settings.task || '';

  try {
    const response = await fetch(`${NEXUS_API_BASE}/agents/spawn/${template}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        working_directory: workingDirectory,
        assigned_task: task || undefined,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showOk(context);
      setTitle(context, `${template}\n✓`);
      // Reset title after 2 seconds
      setTimeout(() => setTitle(context, ''), 2000);
    } else {
      showAlert(context);
      console.error('[NEXUS] Spawn failed:', data.error);
    }
  } catch (error) {
    showAlert(context);
    console.error('[NEXUS] API error:', error);
  }
}

async function executeQuickAction(context, actionId, settings) {
  const workingDirectory = settings.workingDirectory || '/tmp';
  const taskOverride = settings.taskOverride || '';

  try {
    const response = await fetch(`${NEXUS_API_BASE}/quick-actions/${actionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        working_directory: workingDirectory,
        task_override: taskOverride || undefined,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showOk(context);
    } else {
      showAlert(context);
      console.error('[NEXUS] Quick action failed:', data.error);
    }
  } catch (error) {
    showAlert(context);
    console.error('[NEXUS] API error:', error);
  }
}

async function killAllAgents(context) {
  try {
    const response = await fetch(`${NEXUS_API_BASE}/agents`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      showOk(context);
      setTitle(context, `Killed\n${data.data}`);
      setTimeout(() => setTitle(context, ''), 2000);
    } else {
      showAlert(context);
    }
  } catch (error) {
    showAlert(context);
    console.error('[NEXUS] API error:', error);
  }
}

async function refreshStatus(context) {
  try {
    const response = await fetch(`${NEXUS_API_BASE}/status`);
    const data = await response.json();

    if (data.success) {
      const status = data.data;
      const agentCount = status.agents_running;
      const dbConnected = status.database_connected;

      // Update button title with agent count
      setTitle(context, `${agentCount}\nAgents`);

      // Set state (0 = ok, 1 = error)
      setState(context, dbConnected ? 0 : 1);
    } else {
      setTitle(context, 'Error');
      setState(context, 1);
    }
  } catch (error) {
    setTitle(context, 'Offline');
    setState(context, 1);
  }
}

// ============================================================================
// Status Polling
// ============================================================================

function startStatusPolling() {
  stopStatusPolling();
  statusPollTimer = setInterval(() => {
    // Update all status buttons
    for (const [context, data] of actionContexts) {
      if (data.action === 'me.nexus.streamdeck.status') {
        refreshStatus(context);
      }
    }
  }, POLL_INTERVAL);
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

// ============================================================================
// Stream Deck Helper Functions
// ============================================================================

function setTitle(context, title) {
  sendToStreamDeck({
    event: 'setTitle',
    context: context,
    payload: { title: title, target: 0 },
  });
}

function setState(context, state) {
  sendToStreamDeck({
    event: 'setState',
    context: context,
    payload: { state: state },
  });
}

function setSettings(context, settings) {
  sendToStreamDeck({
    event: 'setSettings',
    context: context,
    payload: settings,
  });
}

function showOk(context) {
  sendToStreamDeck({
    event: 'showOk',
    context: context,
  });
}

function showAlert(context) {
  sendToStreamDeck({
    event: 'showAlert',
    context: context,
  });
}

function sendToPropertyInspector(context, payload) {
  sendToStreamDeck({
    event: 'sendToPropertyInspector',
    context: context,
    payload: payload,
  });
}

function sendToStreamDeck(payload) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(payload));
  }
}

// ============================================================================
// Export for Stream Deck
// ============================================================================

// This is called by Stream Deck when the plugin loads
window.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket;
