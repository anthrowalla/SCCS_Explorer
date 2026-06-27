#!/bin/bash
# Simple HTTP server launcher for the EthnoAtlas Crosstab application
SERVER=$1
if test -z "$SERVER"
then
SERVER=8000
fi

echo "Starting EthnoAtlas Crosstabulation Server..."
echo ""
echo "The application will be available at: http://localhost:$SERVER"
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"

python3 -m http.server $SERVER
