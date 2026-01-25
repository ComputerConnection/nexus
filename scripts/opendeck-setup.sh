#!/bin/bash
#
# NEXUS OpenDeck/Stream Deck Setup Script
# This script helps you configure your Stream Deck to control NEXUS
#

API_BASE="http://localhost:9999/api"
WORKING_DIR="${NEXUS_WORKING_DIR:-$(pwd)}"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              NEXUS Stream Deck Setup                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if NEXUS API is running
echo -e "${YELLOW}Checking NEXUS API...${NC}"
if curl -s "$API_BASE/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ NEXUS API is running on $API_BASE${NC}"
else
    echo -e "${RED}✗ NEXUS API is not running. Please start NEXUS first.${NC}"
    exit 1
fi

# Function to create OpenDeck button config
create_button_config() {
    local name=$1
    local endpoint=$2
    local method=$3
    local body=$4
    local icon=$5
    local color=$6

    echo "
Button: $name
Icon: $icon
Color: $color
HTTP Request:
  Method: $method
  URL: ${API_BASE}${endpoint}
  Headers: Content-Type: application/json
  Body: $body
"
}

echo ""
echo -e "${CYAN}=== Available API Endpoints ===${NC}"
echo ""
echo -e "${GREEN}Agent Templates:${NC}"
curl -s "$API_BASE/templates" | jq -r '.data[] | "  • \(.name) (\(.role))"' 2>/dev/null || echo "  (couldn't fetch templates)"

echo ""
echo -e "${GREEN}Quick Actions:${NC}"
curl -s "$API_BASE/quick-actions" | jq -r '.data[] | "  • \(.name): \(.description)"' 2>/dev/null || echo "  (couldn't fetch quick actions)"

echo ""
echo -e "${CYAN}=== OpenDeck Button Configuration ===${NC}"
echo ""
echo "For each button in OpenDeck, use these settings:"
echo ""

echo -e "${YELLOW}--- Row 1: Agent Templates ---${NC}"
echo ""

create_button_config "Orchestrator" "/agents/spawn/orchestrator" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\", \"assigned_task\": \"Analyze and coordinate tasks\"}" \
    "🧠" "#00fff9"

create_button_config "Architect" "/agents/spawn/architect" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\", \"assigned_task\": \"Design system architecture\"}" \
    "🏗️" "#ff00ff"

create_button_config "Implementer" "/agents/spawn/implementer" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "💻" "#39ff14"

create_button_config "Tester" "/agents/spawn/tester" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\", \"assigned_task\": \"Write comprehensive tests\"}" \
    "🧪" "#ff6600"

echo -e "${YELLOW}--- Row 2: Quick Actions ---${NC}"
echo ""

create_button_config "Build API" "/quick-actions/build-api/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "🔌" "#39ff14"

create_button_config "Write Tests" "/quick-actions/write-tests/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "✅" "#ff6600"

create_button_config "Security Audit" "/quick-actions/security-audit/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "🛡️" "#ff0040"

create_button_config "Generate Docs" "/quick-actions/generate-docs/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "📄" "#808080"

echo -e "${YELLOW}--- Row 3: More Quick Actions ---${NC}"
echo ""

create_button_config "Refactor" "/quick-actions/refactor/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "🔄" "#ff00ff"

create_button_config "Code Review" "/quick-actions/code-review/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "🔍" "#00bfff"

create_button_config "Debug" "/quick-actions/debug/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "🐛" "#ff6600"

create_button_config "Setup CI/CD" "/quick-actions/setup-cicd/execute" "POST" \
    "{\"working_directory\": \"$WORKING_DIR\"}" \
    "🚀" "#9945ff"

echo -e "${YELLOW}--- Row 4: System Controls ---${NC}"
echo ""

create_button_config "System Status" "/status" "GET" "" "📊" "#00fff9"
create_button_config "List Agents" "/agents" "GET" "" "👥" "#39ff14"
create_button_config "Kill All Agents" "/agents" "DELETE" "" "☠️" "#ff0040"
create_button_config "Health Check" "/health" "GET" "" "💚" "#39ff14"

echo ""
echo -e "${CYAN}=== Test Commands ===${NC}"
echo ""
echo "Test the API with these curl commands:"
echo ""
echo -e "${GREEN}# Check health${NC}"
echo "curl $API_BASE/health"
echo ""
echo -e "${GREEN}# Get system status${NC}"
echo "curl $API_BASE/status"
echo ""
echo -e "${GREEN}# List all agents${NC}"
echo "curl $API_BASE/agents"
echo ""
echo -e "${GREEN}# Spawn an orchestrator${NC}"
echo "curl -X POST $API_BASE/agents/spawn/orchestrator -H 'Content-Type: application/json' -d '{\"working_directory\": \"$WORKING_DIR\", \"assigned_task\": \"Hello from Stream Deck!\"}'"
echo ""
echo -e "${GREEN}# Execute quick action${NC}"
echo "curl -X POST $API_BASE/quick-actions/write-tests/execute -H 'Content-Type: application/json' -d '{\"working_directory\": \"$WORKING_DIR\"}'"
echo ""
echo -e "${GREEN}# Kill all agents${NC}"
echo "curl -X DELETE $API_BASE/agents"
echo ""

echo -e "${CYAN}Setup complete! Configure your OpenDeck buttons using the settings above.${NC}"
