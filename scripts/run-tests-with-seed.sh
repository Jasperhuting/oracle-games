#!/bin/bash

# Wait for emulators to be ready
echo "⏳ Waiting for emulators..."
npx wait-on http://127.0.0.1:4000 -t 60000

# Seed test data
echo "📦 Seeding test data..."
npm run seed:test-data

# Run playwright tests
echo "🎭 Running Playwright tests..."
npx playwright test "$@"
