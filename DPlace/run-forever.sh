#!/bin/bash
# Restarts start-server.sh whenever it exits. Usage: nohup ./run-forever.sh [port] &
cd "$(dirname "$0")"
while true; do
    bash ./start-server.sh "$@"
    echo "$(date): server exited (code $?), restarting in 3s..." >&2
    sleep 3
done
