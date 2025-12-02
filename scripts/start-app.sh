#!/bin/bash

# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    echo "Loading environment variables from .env.local..."
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Start agent server
echo "Starting agent server on http://localhost:8000..."
uv run start-server
