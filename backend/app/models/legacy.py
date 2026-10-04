"""Temporary generic JSON persistence model retained during repository migration."""

from typing import Any

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base


class JSONRecord(Base):
    """Hackathon-friendly JSON row; replaced by the typed models over time."""

    __tablename__ = "sentinelx_records"

    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
