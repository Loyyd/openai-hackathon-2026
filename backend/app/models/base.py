"""Shared SQLAlchemy declarative base for backend models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
