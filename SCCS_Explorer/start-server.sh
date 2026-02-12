#!/bin/bash
# Simple HTTP server launcher for the EthnoAtlas Crosstab application

echo "Starting EthnoAtlas Crosstabulation Server..."
echo ""
echo "The application will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8000
