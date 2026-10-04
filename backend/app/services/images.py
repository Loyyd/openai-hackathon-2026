"""Small image metadata boundary; bytes can later move to object storage."""
from typing import Any, Protocol


class ImageMetadataStore(Protocol):
    def put(self, image_id: str, metadata: dict[str, Any]) -> None: ...
    def get(self, image_id: str) -> dict[str, Any] | None: ...


class MemoryImageMetadataStore:
    def __init__(self) -> None:
        self._metadata: dict[str, dict[str, Any]] = {}

    def put(self, image_id: str, metadata: dict[str, Any]) -> None:
        self._metadata[image_id] = dict(metadata)

    def get(self, image_id: str) -> dict[str, Any] | None:
        return self._metadata.get(image_id)
