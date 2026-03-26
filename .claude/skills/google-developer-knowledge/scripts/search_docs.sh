#!/usr/bin/env bash
# Search Google Developer Documentation using the Developer Knowledge API

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

# Defaults
PAGE_SIZE=5
PAGE_TOKEN=""
OUTPUT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --page-size)
            PAGE_SIZE="$2"
            shift 2
            ;;
        --page-token)
            PAGE_TOKEN="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: search_docs.sh <query> [--page-size N] [--page-token TOKEN] [--output FILE]"
            echo ""
            echo "Search Google Developer Documentation."
            echo ""
            echo "Arguments:"
            echo "  query         The search query"
            echo "  --page-size   Number of results (1-20, default: 5)"
            echo "  --page-token  Token for next page of results"
            echo "  --output      Save results to JSON file"
            exit 0
            ;;
        *)
            QUERY="$1"
            shift
            ;;
    esac
done

if [ -z "$QUERY" ]; then
    echo "Error: Query is required"
    echo "Usage: search_docs.sh <query> [--page-size N] [--page-token TOKEN] [--output FILE]"
    exit 1
fi

# Build URL
URL="https://developerknowledge.googleapis.com/v1alpha/documents:searchDocumentChunks?query=$(echo "$QUERY" | sed 's/ /%20/g')&pageSize=$PAGE_SIZE&key=$DEVELOPERKNOWLEDGE_API_KEY"

if [ -n "$PAGE_TOKEN" ]; then
    URL="${URL}&pageToken=$PAGE_TOKEN"
fi

# Make request
RESPONSE=$(curl -s "$URL")

if [ -n "$OUTPUT" ]; then
    echo "$RESPONSE" > "$OUTPUT"
    echo "Results saved to $OUTPUT"
else
    echo "$RESPONSE"
fi
