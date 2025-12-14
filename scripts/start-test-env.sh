#!/bin/bash

# Script om test environment te starten met Firebase emulators en Next.js dev server
# Dit is handig voor lokale development met Cypress

set -e

echo "🔧 Starting test environment..."

# Kleuren voor output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup functie voor graceful shutdown
cleanup() {
  echo -e "\n${YELLOW}Shutting down test environment...${NC}"

  # Stop Firebase emulators
  if [ ! -z "$EMULATOR_PID" ]; then
    echo "Stopping Firebase Emulators (PID: $EMULATOR_PID)..."
    kill $EMULATOR_PID 2>/dev/null || true
  fi

  # Stop Next.js dev server
  if [ ! -z "$NEXTJS_PID" ]; then
    echo "Stopping Next.js dev server (PID: $NEXTJS_PID)..."
    kill $NEXTJS_PID 2>/dev/null || true
  fi

  echo -e "${GREEN}Test environment stopped${NC}"
  exit 0
}

# Registreer cleanup functie voor SIGINT en SIGTERM
trap cleanup SIGINT SIGTERM

# Controleer of Firebase CLI geïnstalleerd is
if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI not found. Install it with: npm install -g firebase-tools"
  exit 1
fi

# Start Firebase Emulators
echo -e "${YELLOW}Starting Firebase Emulators...${NC}"
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
firebase emulators:start --import=./emulator-data --export-on-exit &
EMULATOR_PID=$!

# Wacht tot emulators ready zijn
echo "Waiting for Firebase Emulators to be ready..."
npx wait-on http://127.0.0.1:4000 -t 60000

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Firebase Emulators ready${NC}"
else
  echo "❌ Firebase Emulators failed to start"
  cleanup
  exit 1
fi

# Start Next.js dev server
echo -e "${YELLOW}Starting Next.js dev server...${NC}"
npm run dev:emulator &
NEXTJS_PID=$!

# Wacht tot Next.js server ready is
echo "Waiting for Next.js to be ready..."
npx wait-on http://localhost:3210 -t 120000

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Next.js dev server ready${NC}"
else
  echo "❌ Next.js dev server failed to start"
  cleanup
  exit 1
fi

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Test environment is ready!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Firebase Emulator UI: http://127.0.0.1:4000"
echo "Next.js dev server: http://localhost:3210"
echo ""
echo "Run tests with: npm run cypress (interactive) or npm run cypress:headless"
echo ""
echo "Press Ctrl+C to stop the test environment"

# Wacht totdat het script gestopt wordt
wait
