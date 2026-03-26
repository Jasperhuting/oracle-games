#!/usr/bin/env bash
# Get a document from Google Developer Documentation using the Developer Knowledge API

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

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: get_document.sh <document-name> [--output FILE]"
            echo ""
            echo "Get a document from Google Developer Documentation."
            echo ""
            echo "Arguments:"
            echo "  document-name  Document name (e.g., documents/ai.google.dev/gemini-api/docs/get-started/python)"
            echo "  --output       Save content to file"
            exit 0
            ;;
        *)
            DOC_NAME="$1"
            shift
            ;;
    esac
done

if [ -z "$DOC_NAME" ]; then
    echo "Error: Document name is required"
    echo "Usage: get_document.sh <document-name> [--output FILE]"
    exit 1
fi

# Ensure name starts with documents/
if [[ ! "$DOC_NAME" == documents/* ]]; then
    DOC_NAME="documents/$DOC_NAME"
fi

# Make request
URL="https://developerknowledge.googleapis.com/v1alpha/$DOC_NAME?key=$DEVELOPERKNOWLEDGE_API_KEY"
RESPONSE=$(curl -s "$URL")

if [ -n "$OUTPUT" ]; then
    echo "$RESPONSE" > "$OUTPUT"
    echo "Document saved to $OUTPUT"
else
    echo "$RESPONSE"
fi
