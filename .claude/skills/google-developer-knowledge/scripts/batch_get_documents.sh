#!/usr/bin/env bash
# Batch get documents from Google Developer Documentation using the Developer Knowledge API

set -e

# Check for API key
if [ -z "$DEVELOPERKNOWLEDGE_API_KEY" ]; then
    echo "============================================================"
    echo "AGENT ERROR: Missing Developer Knowledge API key!"
    echo "============================================================"
    echo ""
    echo "To use the Developer Knowledge API, the user must:"
    echo ""
    echo "1. Enable the Developer Knowledge API in Google Cloud:"
    echo "   https://console.cloud.google.com/apis/library/developerknowledge.googleapis.com"
    echo ""
    echo "2. Create an API key restricted to Developer Knowledge API:"
    echo "   https://console.cloud.google.com/apis/credentials"
    echo ""
    echo "3. Add to .env file:"
    echo "   DEVELOPERKNOWLEDGE_API_KEY=<your-api-key>"
    echo ""
    echo "Please ask the user to configure their API key before retrying."
    echo "============================================================"
    exit 1
fi

OUTPUT=""
NAMES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: batch_get_documents.sh <name1> [name2] ... [--output DIR]"
            echo ""
            echo "Batch get documents from Google Developer Documentation."
            echo ""
            echo "Arguments:"
            echo "  names     Document names (up to 20)"
            echo "  --output  Save documents to directory"
            exit 0
            ;;
        *)
            NAMES+=("$1")
            shift
            ;;
    esac
done

if [ ${#NAMES[@]} -eq 0 ]; then
    echo "Error: At least one document name is required"
    echo "Usage: batch_get_documents.sh <name1> [name2] ... [--output DIR]"
    exit 1
fi

if [ ${#NAMES[@]} -gt 20 ]; then
    echo "Error: Maximum 20 documents can be retrieved in a batch"
    exit 1
fi

# Build URL with names parameters
URL="https://developerknowledge.googleapis.com/v1alpha/documents:batchGet?key=$DEVELOPERKNOWLEDGE_API_KEY"

for name in "${NAMES[@]}"; do
    # Ensure name starts with documents/
    if [[ ! "$name" == documents/* ]]; then
        name="documents/$name"
    fi
    URL="${URL}&names=$name"
done

# Make request
RESPONSE=$(curl -s "$URL")

if [ -n "$OUTPUT" ]; then
    mkdir -p "$OUTPUT"
    echo "$RESPONSE" > "$OUTPUT/batch_result.json"
    echo "Results saved to $OUTPUT/batch_result.json"
else
    echo "$RESPONSE"
fi
