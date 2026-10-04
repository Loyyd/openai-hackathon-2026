from dataclasses import dataclass


@dataclass
class VideoConfig:
    sample_fps: float = 5
    detection_width: int = 1920
    confidence: float = 0.3
    recognition_interval: float = 1.0
    device: str = "auto"
    weights: str = "yolo11m.pt"
    embedding_backend: str = "resnet18"
    ocr: bool = True
    store_raw_plates: bool = False


def resolve_device(requested: str = "auto") -> str:
    import torch
    if requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda:0"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"
