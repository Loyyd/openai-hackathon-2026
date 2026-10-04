"""Vehicle appearance embeddings using ImageNet ResNet18 or a histogram fallback.

ResNet18 uses torchvision ImageNet-1K V1 weights; torchvision code is BSD-3-Clause.
Review upstream weight and training-data terms separately before deployment.
Weights are downloaded and cached by torchvision on first use. The histogram
backend is a lightweight HSV appearance descriptor, not a learned ReID model.
"""

import logging

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class EmbeddingEncoder:
    """Encode BGR vehicle crops into normalized float32 appearance vectors."""

    def __init__(self, device: str = "cpu", backend: str = "resnet18"):
        if backend not in {"resnet18", "histogram"}:
            raise ValueError("backend must be 'resnet18' or 'histogram'")
        self.device = device
        self.backend = backend
        self._model = None
        self._preprocess = None
        self._torch = None
        if backend == "resnet18":
            try:
                self._load_resnet()
            except Exception as exc:
                logger.warning(
                    "Unable to load pretrained ResNet18 embeddings (%s); "
                    "using HSV histogram fallback (not learned ReID).",
                    exc,
                )
                self.backend = "histogram"

    def _load_resnet(self) -> None:
        import torch
        from torchvision.models import ResNet18_Weights, resnet18

        if self.device == "auto":
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
        elif self.device.startswith("cuda") and not torch.cuda.is_available():
            logger.warning("CUDA requested but unavailable; using CPU for embeddings.")
            device = "cpu"
        elif self.device == "mps" and not (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        ):
            logger.warning("MPS requested but unavailable; using CPU for embeddings.")
            device = "cpu"
        else:
            device = self.device

        weights = ResNet18_Weights.DEFAULT
        model = resnet18(weights=weights)
        model.fc = torch.nn.Identity()
        model.eval().to(device)
        self.device = device
        self._torch = torch
        self._model = model
        self._preprocess = weights.transforms()

    def encode(self, crop: np.ndarray, blur_threshold: float = 15) -> np.ndarray | None:
        """Return an L2-normalized feature vector, or None for unusable crops.

        ``crop`` is an OpenCV-style BGR image. Crops smaller than 32x32 or with
        Laplacian variance below ``blur_threshold`` are rejected.
        """
        if not isinstance(crop, np.ndarray) or crop.ndim != 3 or crop.shape[2] < 3:
            return None
        height, width = crop.shape[:2]
        if height < 32 or width < 32:
            return None
        bgr = np.ascontiguousarray(crop[:, :, :3])
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        if cv2.Laplacian(gray, cv2.CV_64F).var() < blur_threshold:
            return None

        if self.backend == "histogram":
            return self._histogram(bgr)

        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        image = Image.fromarray(rgb)
        tensor = self._preprocess(image).unsqueeze(0).to(self.device)
        try:
            with self._torch.inference_mode():
                features = self._model(tensor).flatten(1)[0].detach().cpu().numpy()
        except (RuntimeError, NotImplementedError):
            if self.device == "cpu":
                raise
            logger.warning("Embedding device failed; retrying on CPU", exc_info=True)
            self.device = "cpu"
            self._model.to("cpu")
            with self._torch.inference_mode():
                features = self._model(tensor.to("cpu")).flatten(1)[0].detach().numpy()
        return self._normalize(features)

    @staticmethod
    def _histogram(bgr: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        cells = []
        height, width = hsv.shape[:2]
        for y0, y1 in ((0, height // 2), (height // 2, height)):
            for x0, x1 in ((0, width // 2), (width // 2, width)):
                cell = hsv[y0:y1, x0:x1]
                hist = cv2.calcHist([cell], [0, 1], None, [16, 8], [0, 180, 0, 256])
                hist = cv2.normalize(hist, None).flatten()
                cells.append(hist)
        return EmbeddingEncoder._normalize(np.concatenate(cells))

    @staticmethod
    def _normalize(vector: np.ndarray) -> np.ndarray:
        vector = np.asarray(vector, dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if norm > 0:
            vector /= norm
        return vector.astype(np.float32, copy=False)
