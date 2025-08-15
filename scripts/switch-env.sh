#!/bin/bash

# Environment Switcher Script for ePharmacy Project
# Usage: ./scripts/switch-env.sh [local|railway]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_JSON="$PROJECT_ROOT/epharmacy-mobile/app.json"
ENV_FILE="$HOME/epharmacy-config/environments.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo -e "${BLUE}Usage: $0 [local|railway]${NC}"
    echo ""
    echo "Switches the mobile app to use different backend environments:"
    echo "  local   - Use local backend (http://localhost:8000)"
    echo "  railway - Use Railway backend (https://epharmacy-production.up.railway.app)"
    echo ""
    echo "Examples:"
    echo "  $0 local    # Switch to local development"
    echo "  $0 railway  # Switch to production Railway"
    exit 1
}

check_files() {
    if [[ ! -f "$APP_JSON" ]]; then
        echo -e "${RED}Error: app.json not found at $APP_JSON${NC}"
        exit 1
    fi
    
    if [[ ! -f "$ENV_FILE" ]]; then
        echo -e "${YELLOW}Warning: environments.local not found at $ENV_FILE${NC}"
        echo -e "${RED}Please create ~/epharmacy-config/environments.local first with your configuration.${NC}"
        echo -e "${BLUE}You can copy the template from the project directory if it exists.${NC}"
        exit 1
    fi
}

switch_to_local() {
    echo -e "${BLUE}🔄 Switching to LOCAL environment...${NC}"
    
    # Update app.json
    sed -i '' 's|"apiBaseUrl": "https://epharmacy-production.up.railway.app"|"apiBaseUrl": "http://localhost:8000"|g' "$APP_JSON"
    
    echo -e "${GREEN}✅ Updated app.json to use local backend${NC}"
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "   1. Start local backend: cd backend && npm start"
    echo "   2. Rebuild mobile app: cd epharmacy-mobile && npm run android"
    echo "   3. Ensure MongoDB is running locally"
}

switch_to_railway() {
    echo -e "${BLUE}🔄 Switching to RAILWAY environment...${NC}"
    
    # Update app.json
    sed -i '' 's|"apiBaseUrl": "http://localhost:8000"|"apiBaseUrl": "https://epharmacy-production.up.railway.app"|g' "$APP_JSON"
    
    echo -e "${GREEN}✅ Updated app.json to use Railway backend${NC}"
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "   1. Rebuild mobile app: cd epharmacy-mobile && npm run android"
    echo "   2. For release: cd epharmacy-mobile/android && ./gradlew assembleRelease"
    echo "   3. Test connectivity: curl https://epharmacy-production.up.railway.app/api/products"
}

show_current_config() {
    echo -e "${BLUE}📋 Current Configuration:${NC}"
    current_url=$(grep -o '"apiBaseUrl": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)
    echo "   API Base URL: $current_url"
    
    if [[ "$current_url" == "http://localhost:8000" ]]; then
        echo -e "   Environment: ${GREEN}LOCAL${NC}"
    elif [[ "$current_url" == "https://epharmacy-production.up.railway.app" ]]; then
        echo -e "   Environment: ${GREEN}RAILWAY${NC}"
    else
        echo -e "   Environment: ${RED}UNKNOWN${NC}"
    fi
    echo ""
}

main() {
    check_files
    show_current_config
    
    case "${1:-}" in
        "local")
            switch_to_local
            ;;
        "railway")
            switch_to_railway
            ;;
        "status")
            # Just show current config (already displayed above)
            ;;
        *)
            usage
            ;;
    esac
    
    echo ""
    show_current_config
}

main "$@"
