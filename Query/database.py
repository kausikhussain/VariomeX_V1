"""
database.py

Provides a small MongoDB helper for FastAPI using pymongo.
Creates a single MongoClient and exposes a get_db() helper for dependency injection.
"""
from functools import lru_cache
"""
database.py

Small MongoDB helper used by FastAPI routes. Exposes init_db(), get_db()
and close_db() helpers. Keeps a single MongoClient for the process lifetime.
"""
from functools import lru_cache
from typing import Optional
import logging
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

LOGGER = logging.getLogger("variomex.db")


# Connection configuration - override by environment variables if needed
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "variomex"


# Module-scoped client and db
_client: Optional[MongoClient] = None
_db = None


def init_db() -> None:
    """Initialize the MongoDB client and test the connection.

    Idempotent — safe to call multiple times. Will raise on failure so
    FastAPI startup can fail fast in development.
    """
    global _client, _db
    if _client is not None:
        return

    try:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # trigger server selection
        _client.server_info()
        _db = _client[DB_NAME]
        LOGGER.info("Connected to MongoDB %s", MONGO_URI)
    except ServerSelectionTimeoutError as exc:
        _client = None
        _db = None
        LOGGER.exception("Could not connect to MongoDB: %s", exc)
        raise


def get_db():
    """Return the database instance. Lazily initializes if needed."""
    if _db is None:
        init_db()
    return _db


def close_db() -> None:
    """Close the MongoClient cleanly on shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        LOGGER.info("Closed MongoDB client")
