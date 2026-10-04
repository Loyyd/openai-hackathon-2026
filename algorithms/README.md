# Algorithms

For real local-video detection, tracking and pseudonymous vehicle matching, see [vehicles/README.md](vehicles/README.md). Run `python -m algorithms.vehicles.run --video 4K_Highway.mp4 --sample-fps 5 --save-video --output output/highway` after installing its optional vision dependencies. The original observation-to-incident mock pipeline remains unchanged.

Run from the repository root with `python -m algorithms.run` for deterministic **DEMO DATA**, offline. Add `--post` to submit detections/incidents to `BACKEND_URL`; `--dry-run` is equivalent to the default. The mock analyzer emits predetermined signals and does not fetch or analyze images. No keys or model dependencies are needed.

`analyze_observation` turns a canonical observation into detections. Correlation takes the same observation, detections, optional prior incidents, and nearby transport observations. Confidence factors are bounded and multiplied; event matching is a small non-biometric heuristic. Extend `vision/` with actual analysis and `correlation/` with richer temporal/spatial logic without changing API contracts.

Konrad owns `algorithms/`. The standalone CLI uses `shared/demo.py` observations, not ingestion providers, and works without the backend. `vision/images.py` loads the local synthetic image; implement `VisionAnalyzer` for OpenAI vision later, supplying credentials through environment configuration rather than source code. The default analyzer does not inspect pixels.
