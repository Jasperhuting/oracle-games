#!/bin/bash

# List of specific users to sync
USER_IDS=(
  "0zCYsE5gzlWDzE7UTXT2VpAumXD2"  # Ronde van de Streek
  "HkMFC7bYPEQW2DPS4K6J6fX3wNh2"  # Pier Tol  
  "JzWMUrjd6ERpNNEUPLdFFBtXa2i2"  # Gouwe Kouwie
  "6XyysJl9AmU6GsuX8S1IXGeGPGP2"  # Zwarte Wout
  "VUbGerNXjwMZ8xaH66Oer5DTos32"  # TI Reppie
  "nib55ZNOsWhhWui4yogk4X5EG6A3"  # BrackenRidgeCycling
  "lGyDhYWizqckZKm9mJwgJA0lUlf1"  # Sies
  "DdY5htVQl7Pvqqv2wR7mlZdoECI2"  # BaDo
  "aeNL9FQBTrb9VMZEWQ5O2wUSHa53"  # Mithrandir
  "2IBY1KopZPSEsJZcQmHFI0bf9I63"  # Erveedeeee
  "pJjy6Ho3SIPcGtjWLgPwCSQ3Htz2"  # Ike Simoncini
  "w2KQB0CSq7Vgn5kGE6Xsi97FqPo2"  # BXMR
  "EzHyFrJTHDTpvlQ3t4a9eFWu6Ye2"  # Fieljepper
  "gOZJ7HGAs3bDEK2kcdu2tSjrxcP2"  # Arno
  "IwzfrOk53nfa4dRHNt5FJsnb0E72"  # Noordbiker
  "0U9n9bYEpuaIB0Ti2LBgYxCqkex1"  # Pirazzi
  "zBHRzxrD9MS2cuB1VxtV1zrar1x1"  # Alle begin is moeilijk voor Max
  "pJmveXFi0QPXEqy4L6FvBxNOtUU2"  # Ronde van Westfriesland
  "FjaSVlxmoog9vBQNv4XFwoOL2bH2"  # VincentK
  "vr1CRFaSggb2IUSaigkOlaajpVM2"  # Meewind
)

GAME_ID="mGzPZfIOb2gAyEu0i6t6"
ADMIN_USER_ID="susJrdCk7KPOGdxM5JI9WfThW1o2"

echo "Starting sync for specific users..."
echo "Game ID: $GAME_ID"
echo "Admin User ID: $ADMIN_USER_ID"
echo ""

for USER_ID in "${USER_IDS[@]}"; do
  echo "Syncing user: $USER_ID"
  
  # Get current discrepancy info first
  DISCREPANCY=$(curl -s "http://localhost:3210/api/admin/sync-team-to-playerteams?gameId=$GAME_ID&adminUserId=$ADMIN_USER_ID" | jq --arg user_id "$USER_ID" '.discrepancies[] | select(.userId == $user_id)')
  
  if [ -n "$DISCREPANCY" ]; then
    PLAYERNAME=$(echo "$DISCREPANCY" | jq -r '.playername')
    MISSING_COUNT=$(echo "$DISCREPANCY" | jq -r '.missingCount')
    EXTRA_COUNT=$(echo "$DISCREPANCY" | jq -r '.extraCount')
    
    echo "  Player: $PLAYERNAME"
    echo "  Missing: $MISSING_COUNT, Extra: $EXTRA_COUNT"
    
    if [ "$MISSING_COUNT" -gt 0 ] || [ "$EXTRA_COUNT" -gt 0 ]; then
      echo "  Syncing..."
      
      # Use PUT endpoint for complete sync (add missing + remove extra)
      RESULT=$(curl -s -X PUT http://localhost:3210/api/admin/sync-team-to-playerteams \
        -H "Content-Type: application/json" \
        -d "{\"gameId\": \"$GAME_ID\", \"adminUserId\": \"$ADMIN_USER_ID\", \"dryRun\": false, \"targetUserId\": \"$USER_ID\"}")
      
      SUCCESS=$(echo "$RESULT" | jq -r '.success // false')
      if [ "$SUCCESS" = "true" ]; then
        echo "  ✓ Sync completed successfully"
      else
        echo "  ✗ Sync failed: $(echo "$RESULT" | jq -r '.error // Unknown error')"
      fi
    else
      echo "  ✓ No discrepancies found"
    fi
  else
    echo "  No discrepancies found for this user"
  fi
  
  echo ""
done

echo "Sync completed for all specified users!"
