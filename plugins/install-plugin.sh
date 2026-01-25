#!/bin/bash
#
# NEXUS Stream Deck Plugin Installer
#

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PLUGIN_DIR="me.nexus.streamdeck.sdPlugin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         NEXUS Stream Deck Plugin Installer                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detect platform and plugin directory
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - check for OpenDeck
    OPENDECK_DIR="$HOME/.local/share/OpenDeck/Plugins"
    FLATPAK_DIR="$HOME/.var/app/me.amankhanna.opendeck/data/OpenDeck/Plugins"

    if [ -d "$FLATPAK_DIR" ]; then
        INSTALL_DIR="$FLATPAK_DIR"
        echo -e "${GREEN}Detected: OpenDeck (Flatpak)${NC}"
    elif [ -d "$OPENDECK_DIR" ]; then
        INSTALL_DIR="$OPENDECK_DIR"
        echo -e "${GREEN}Detected: OpenDeck (Native)${NC}"
    else
        echo -e "${YELLOW}OpenDeck directory not found. Creating...${NC}"
        mkdir -p "$OPENDECK_DIR"
        INSTALL_DIR="$OPENDECK_DIR"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    INSTALL_DIR="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins"
    echo -e "${GREEN}Detected: macOS${NC}"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    INSTALL_DIR="$APPDATA/Elgato/StreamDeck/Plugins"
    echo -e "${GREEN}Detected: Windows${NC}"
else
    echo -e "${RED}Unknown platform: $OSTYPE${NC}"
    exit 1
fi

echo ""
echo -e "Install directory: ${YELLOW}$INSTALL_DIR${NC}"
echo ""

# Check if plugin source exists
if [ ! -d "$SCRIPT_DIR/$PLUGIN_DIR" ]; then
    echo -e "${RED}Error: Plugin directory not found at $SCRIPT_DIR/$PLUGIN_DIR${NC}"
    exit 1
fi

# Remove existing installation
if [ -d "$INSTALL_DIR/$PLUGIN_DIR" ]; then
    echo -e "${YELLOW}Removing existing installation...${NC}"
    rm -rf "$INSTALL_DIR/$PLUGIN_DIR"
fi

# Copy plugin
echo -e "${CYAN}Installing plugin...${NC}"
cp -r "$SCRIPT_DIR/$PLUGIN_DIR" "$INSTALL_DIR/"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Installation Successful!                     ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Plugin installed to: ${CYAN}$INSTALL_DIR/$PLUGIN_DIR${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Restart OpenDeck/Stream Deck software"
    echo "2. Look for 'NEXUS AI' category in actions"
    echo "3. Drag buttons to your deck"
    echo "4. Configure working directory in button settings"
    echo ""
    echo -e "${CYAN}Make sure NEXUS is running with the API server!${NC}"
else
    echo -e "${RED}Installation failed!${NC}"
    exit 1
fi
