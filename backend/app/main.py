"""SentinelX backend entry point. Umut can extend services without changing routes."""
import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import router
from backend.app.services.camera_pipeline import CameraPipeline
from backend.app.api.ai_demo import router as ai_demo_router
from backend.app.database.repository import Repository, make_repository
from backend.app.services.images import LocalSnapshotFileStore, MemoryImageMetadataStore
from backend.app.services.api import ResourceNotFound, SentinelXService


def create_app(repository: Repository | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app):
        if os.getenv("CAMERA_WORKER_ENABLED", "true").lower() == "true":
            app.state.pipeline.start()
        yield
        await asyncio.to_thread(app.state.pipeline.stop)

    app = FastAPI(title="SentinelX API", version="0.2.0", description="Persistent camera snapshots and incident evidence", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    app.state.repository = repository or make_repository(os.getenv("DATABASE_URL"))
    app.state.image_metadata = MemoryImageMetadataStore()
    app.state.snapshot_files = LocalSnapshotFileStore(
        os.getenv("SNAPSHOT_STORAGE_DIR", "backend/uploads")
    )
    app.state.service = SentinelXService(
        app.state.repository, app.state.image_metadata, app.state.snapshot_files
    )

    app.state.pipeline = CameraPipeline(app.state.service)

    @app.exception_handler(ResourceNotFound)
    async def resource_not_found(request: Request, exc: ResourceNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    app.include_router(router)

    app.include_router(ai_demo_router)
    return app


app = create_app()
