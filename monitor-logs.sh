#!/bin/bash

# Monitor console logs from browser in real-time
# Usage: ./monitor-logs.sh

LOG_FILE="logs/console-logs.txt"

echo "==================================="
echo "PARTICLE SYSTEM LOG MONITOR"
echo "==================================="
echo ""
echo "Watching for particle-related logs from browser..."
echo "Press Ctrl+C to stop"
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs

# Clear existing logs
curl -X DELETE http://localhost:3000/api/console-logs -s > /dev/null 2>&1

echo "✓ Logs cleared"
echo ""
echo "Now:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Navigate to Neural 3D tab"
echo "3. Click the purple 'Test Particle' button"
echo "4. Or send a chat message"
echo ""
echo "Logs will appear below..."
echo "-----------------------------------"
echo ""

# Wait for log file to be created
while [ ! -f "$LOG_FILE" ]; do
  sleep 0.5
done

# Tail the log file
tail -f "$LOG_FILE"
