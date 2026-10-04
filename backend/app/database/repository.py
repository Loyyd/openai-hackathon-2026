"""Repository implementations; routes depend only on the storage protocol."""
from typing import Any, Protocol

from sqlalchemy import JSON, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool

from shared.demo import CAMERAS, INCIDENTS, OBSERVATIONS, TRANSPORT
from shared.models import Camera, CameraObservation, Detection, Incident, TransportObservation

Model = Camera | CameraObservation | Detection | Incident | TransportObservation


class Repository(Protocol):
    def list(self, kind: str) -> list[dict[str, Any]]: ...
    def get(self, kind: str, item_id: str) -> dict[str, Any] | None: ...
    def upsert(self, kind: str, item: Model) -> dict[str, Any]: ...


class MemoryRepository:
    def __init__(self, seed: bool = True) -> None:
        self._items: dict[str, dict[str, dict[str, Any]]] = {}
        if seed:
            for kind, records in (("cameras", CAMERAS), ("observations", OBSERVATIONS), ("incidents", INCIDENTS), ("transport", TRANSPORT)):
                for record in records:
                    self.upsert(kind, record)

    def list(self, kind: str) -> list[dict[str, Any]]:
        return list(self._items.get(kind, {}).values())

    def get(self, kind: str, item_id: str) -> dict[str, Any] | None:
        return self._items.get(kind, {}).get(item_id)

    def upsert(self, kind: str, item: Model) -> dict[str, Any]:
        payload = item.model_dump(mode="json")
        self._items.setdefault(kind, {})[payload["id"]] = payload
        return payload


class Base(DeclarativeBase):
    pass


class JSONRecord(Base):
    """Hackathon-friendly JSON row; replace with normalized models as needed."""
    __tablename__ = "sentinelx_records"
    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class SQLAlchemyRepository:
    def __init__(self, database_url: str) -> None:
        options: dict[str, Any] = {"pool_pre_ping": True}
        if database_url in ("sqlite://", "sqlite:///:memory:"):
            options.update(connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.engine = create_engine(database_url, **options)
        Base.metadata.create_all(self.engine)
        self._seed()

    def _seed(self) -> None:
        with Session(self.engine) as session:
            existing = session.scalar(select(JSONRecord.id).limit(1))
            if existing is not None:
                return
        for kind, records in (("cameras", CAMERAS), ("observations", OBSERVATIONS), ("incidents", INCIDENTS), ("transport", TRANSPORT)):
            for record in records:
                self.upsert(kind, record)

    def list(self, kind: str) -> list[dict[str, Any]]:
        with Session(self.engine) as session:
            rows = session.scalars(select(JSONRecord).where(JSONRecord.kind == kind)).all()
            return [row.payload for row in rows]

    def get(self, kind: str, item_id: str) -> dict[str, Any] | None:
        with Session(self.engine) as session:
            row = session.get(JSONRecord, (kind, item_id))
            return row.payload if row else None

    def upsert(self, kind: str, item: Model) -> dict[str, Any]:
        payload = item.model_dump(mode="json")
        with Session(self.engine) as session, session.begin():
            row = session.get(JSONRecord, (kind, payload["id"]))
            if row is None:
                row = JSONRecord(kind=kind, id=payload["id"], payload=payload)
                session.add(row)
            else:
                row.payload = payload
        return payload


def make_repository(database_url: str | None = None) -> Repository:
    """Unset DATABASE_URL selects isolated in-memory demo storage."""
    return SQLAlchemyRepository(database_url) if database_url else MemoryRepository()
