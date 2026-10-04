"""Local snapshot file storage plus the existing in-memory metadata adapter."""
from io import BytesIO
from pathlib import Path
import warnings

from PIL import Image, UnidentifiedImageError
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


class SnapshotFileStore(Protocol):
    def save(self, snapshot_id: str, contents: bytes) -> dict[str, Any]: ...
    def path_for(self, storage_key: str) -> Path | None: ...
    def delete(self, storage_key: str) -> None: ...


class LocalSnapshotFileStore:
    """Store image bytes under a configured persistent local directory."""

    MAX_BYTES = 10 * 1024 * 1024
    _FORMATS = (
        (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
        (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    )

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, snapshot_id: str, contents: bytes) -> dict[str, Any]:
        if not contents:
            raise ValueError("Uploaded image is empty")
        if len(contents) > self.MAX_BYTES:
            raise ValueError("Image exceeds the 10 MB upload limit")

        content_type, suffix = self._detect_format(contents)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(contents)) as image:
                    if image.width * image.height > 20_000_000:
                        raise ValueError("Image exceeds the 20 megapixel limit")
                    image.verify()
                with Image.open(BytesIO(contents)) as image:
                    image.load()
        except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError("Uploaded image is invalid or cannot be decoded") from exc
        storage_key = f"{snapshot_id}{suffix}"
        destination = self.root / storage_key
        temporary = self.root / f".{storage_key}.tmp"
        temporary.write_bytes(contents)
        temporary.replace(destination)
        return {
            "storage_key": storage_key,
            "content_type": content_type,
            "size_bytes": len(contents),
        }

    def path_for(self, storage_key: str) -> Path | None:
        candidate = (self.root / storage_key).resolve()
        if self.root not in candidate.parents or not candidate.is_file():
            return None
        return candidate

    def delete(self, storage_key: str) -> None:
        path = self.path_for(storage_key)
        if path is not None:
            path.unlink(missing_ok=True)

    @classmethod
    def _detect_format(cls, contents: bytes) -> tuple[str, str]:
        for signature, content_type, suffix in cls._FORMATS:
            if contents.startswith(signature):
                return content_type, suffix
        if len(contents) >= 12 and contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
            return "image/webp", ".webp"
        raise ValueError("Only JPEG, PNG, and WebP images are accepted")
