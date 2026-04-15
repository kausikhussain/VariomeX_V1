"""Optional shared Pydantic schemas.

This file is small and supports type hints across modules. It's intentionally
lightweight — most route responses are defined in the route module to keep
things explicit for beginners.
"""
from pydantic import BaseModel
from typing import Optional


class SimpleHealth(BaseModel):
    status: str
