# Local 4K vehicle intelligence — Konrad

This pipeline processes the repository's `4K_Highway.mp4` locally. It does not modify the frontend, backend or shared incident contracts. The footage is highway footage, not a verified Dublin feed.

## Install and run

From the repository root, activate the existing virtualenv. CPU-only Linux installation avoids large CUDA downloads:

```sh
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r algorithms/requirements-vision.txt
python -m algorithms.vehicles.run --video 4K_Highway.mp4 \
  --sample-fps 5 --start-time 10 --end-time 20 \
  --save-video --output output/highway
```

On Apple Silicon or CUDA machines install PyTorch using its [platform instructions](https://pytorch.org/get-started/locally/), then the vision requirements. `--device auto` selects CUDA, MPS or CPU. Remove start/end options for the full video. `--display` opens an OpenCV window (skipped with a warning on headless machines). `--no-ocr` makes a faster demo; `--embedding-backend histogram` explicitly opts into a non-learned fallback. `--detection-width`, `--recognition-interval`, `--match-threshold` and `--possible-threshold` expose tuning.

First execution downloads YOLO11n (~5 MB), torchvision ResNet18 ImageNet weights (~45 MB), and optional EasyOCR English recognition/CRAFT detector weights. Subsequent inference is local. YOLO weights are ignored by Git; other weights use home-directory caches. Model download failures are logged: embeddings fall back to histogram, OCR to unavailable. YOLO is required; an unavailable detector fails clearly rather than pretending to detect vehicles.

## Architecture and integration

`VehicleProcessor.process_frame(image, camera_id, timestamp)` accepts an original-resolution BGR NumPy image and video-relative seconds. Use one instance per camera, with monotonic timestamps; identities persist for the lifetime of that processor, not across restarts. It returns a JSON-compatible camera/timestamp/vehicles object. The backend can store this output without database coupling. No backend posting is enabled by default.

1. YOLO detects car/motorcycle/bus/truck on a resized copy; ByteTrack supplies temporary track IDs.
2. Boxes are scaled/clamped to original 4K coordinates; recognition only sees high-resolution crops.
3. Throttled recognition estimates broad HSV colour, normalized ResNet18 features and best-effort OCR. Tiny/blurry embeddings are rejected. Make/model is an optional interface returning unavailable, not fabricated classifications.
4. Fingerprints aggregate colour/plate evidence and EMA embeddings. IDs are independent `VX-XXXX` values. Matching uses available, confidence-weighted evidence, plate edit distance, visual similarity, temporal/spatial plausibility and an ambiguity margin. Simultaneous tracks cannot share an identity. Possible matches get separate IDs.

`NEW` has identity confidence zero: assigning an ID is not evidence of a match. `TRACKED` preserves the original match confidence, with tracker continuity explained separately. Scores are heuristics, not calibrated probabilities. Thresholds/weights live in `MatchConfig`; `bytetrack.yaml` is tuned for sampled frames.

## Outputs

### Website demo

Generate `output/highway`, then prepare a browser-compatible H.264 replay:

```sh
ffmpeg -y -i output/highway/annotated.mp4 -c:v libx264 -pix_fmt yuv420p -movflags +faststart output/highway/browser.mp4
```

Start the backend with `AI_DEMO_DIR=output/highway` (the default) and open `/ai` in the website. The page shows playback, vehicle fingerprints and actual model/device status; refresh results after rerunning the pipeline. Assets remain local and ignored by Git. This unauthenticated demo serves footage to website viewers: keep it local/private. The API omits raw plate text from vehicle summaries even if the CLI stored it.

### macOS certificates and acceleration

For python.org Python 3.14 certificate failures, run `/Applications/Python 3.14/Install Certificates.command` on your Mac. Test HTTPS and Metal with the **same activated virtualenv Python** used for the pipeline:

```sh
python -c "import urllib.request; print(urllib.request.urlopen('https://download.pytorch.org').status)"
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
```

Do not disable TLS verification. If a download is corrupt, remove only the affected checkpoint from its documented cache and retry. `--device auto` already selects MPS when available for YOLO and ResNet; `--device mps` explicitly requests it. EasyOCR currently runs on CPU, so its CPU warning does not imply the detector/embedding model is on CPU. Check `run.json` and the website status. CPU fallback is logged for unsupported device operations.

`annotated.mp4` (when requested), `latest.jpg`, `vehicles.json`, `observations.jsonl`, `embeddings.npz`, `run.json`, and `crops/VX-XXXX/best.jpg`. MP4 contains sampled frames at the configured sample FPS with no audio. `run.json` records actual device/embedding backend. Embeddings are separate from human-readable JSON. Outputs are run-local snapshots, not a reloadable identity database; use a new output directory per run.

Raw plate text is excluded from JSON and overlays by default. Enable only when appropriate using `STORE_RAW_PLATES=true` or `--store-raw-plates`. **Images, crops and video can still contain readable plates or people**: disabling text persistence does not redact pixels. Keep artifacts private; do not commit outputs or share unredacted footage. There is no facial recognition, owner lookup or cloud inference.

## Known limitations and licences

- ResNet18 is a generic ImageNet embedding, not trained vehicle ReID; similar cars can be confused and viewpoint changes can split identities. ReID reconnection is supported but not guaranteed on this footage.
- Whole-vehicle EasyOCR is an explicitly heuristic plate-recognition attempt, not a dedicated plate detector. Text on trucks may be mistaken for plates; unreadable plates remain unavailable. A vetted plate detector is the next most valuable improvement.
- Sparse sampling can lose fast vehicles. This CPU demo is not guaranteed realtime; CUDA/MPS are supported but not tested here. Colour is approximate and affected by road, windows and lighting.
- Partial occlusion is not scored explicitly. No make/model model or frontend debug dashboard is included.
- Ultralytics code and YOLO weights: [AGPL-3.0 / commercial terms](https://www.ultralytics.com/license). Check compatibility before distributing an integrated application.
- torchvision/ResNet18: [BSD-3-Clause code](https://github.com/pytorch/vision/blob/main/LICENSE), [ImageNet weight documentation](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.resnet18.html); training-data rights are separate.
- EasyOCR: [Apache-2.0](https://github.com/JaidedAI/EasyOCR); CRAFT/recognition checkpoint sources are documented upstream. Review model/data terms for deployment.

Run `python -m pytest algorithms/tests tests` for matching and aggregation tests without downloading model weights. Vision tests skip when optional NumPy/OpenCV dependencies are absent. Managed setup can include CPU vision dependencies with `SENTINELX_VISION=true`.
