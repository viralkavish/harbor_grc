"""Entry point for python -m server."""
import os
import uvicorn
from .app import create_app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    host = "127.0.0.1"
    app = create_app()
    uvicorn.run(app, host=host, port=port, log_level="info")
