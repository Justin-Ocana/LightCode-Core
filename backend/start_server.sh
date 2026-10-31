#!/bin/bash
# Start lightcode Backend with WebSocket Support
# Uses Daphne ASGI server for real-time notifications

echo "🚀 Starting lightcode Backend with WebSocket support..."
echo ""

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  Warning: Virtual environment not detected"
    echo "   Consider activating your venv first"
    echo ""
fi

# Start Daphne
echo "📡 Starting Daphne ASGI server on http://0.0.0.0:8000"
echo "   WebSocket endpoint: ws://localhost:8000/ws/notifications/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application
