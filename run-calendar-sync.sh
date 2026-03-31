#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://oracle-games.online/api/admin/sync-google-calendar"
USER_ID="susJrdCk7KPOGdxM5JI9WfThW1o2"
YEAR="2026"
LIMIT="80"

CURSOR=""
BATCH=1

while true; do
  echo ""
  echo "Running batch $BATCH..."

  if [ -z "$CURSOR" ]; then
    RESPONSE=$(curl -sS -X POST "$BASE_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"userId\": \"$USER_ID\",
        \"year\": $YEAR,
        \"limit\": $LIMIT
      }")
  else
    RESPONSE=$(curl -sS -X POST "$BASE_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"userId\": \"$USER_ID\",
        \"year\": $YEAR,
        \"limit\": $LIMIT,
        \"cursor\": \"$CURSOR\"
      }")
  fi

  echo "$RESPONSE"

  HAS_MORE=$(echo "$RESPONSE" | jq -r '.hasMore')
  CURSOR=$(echo "$RESPONSE" | jq -r '.nextCursor // empty')

  if [ "$HAS_MORE" != "true" ]; then
    echo ""
    echo "Sync complete."
    break
  fi

  BATCH=$((BATCH + 1))
done
