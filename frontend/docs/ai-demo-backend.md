# AI replay: small backend contract

## Endpoints (already implemented)

| Method | Backend path | Response |
| --- | --- | --- |
| GET | `/api/ai-demo` | JSON metadata, unique vehicles and per-frame timeline |
| GET | `/api/ai-demo/media/browser.mp4` | H.264 MP4; support byte-range requests for seeking |
| GET | `/api/ai-demo/media/latest.jpg` | Optional JPEG snapshot |

The website calls these through `/backend/api/ai-demo...` (same-origin proxy).
No inference runs inside these requests; they serve saved pipeline output.

## Files to store

Set `AI_DEMO_DIR` to a directory containing:

```text
run.json             # Required: run metadata, including sample_fps
vehicles.json        # Required: array of unique vehicle fingerprints
observations.jsonl   # One JSON object per replay frame, including empty frames
browser.mp4          # Browser-compatible annotated replay
latest.jpg           # Optional snapshot
```

Keep the video and JSON files from the same pipeline run. Generated artifacts
are private and should not be committed. Crops and embeddings are not needed
by the website. Video pixels may contain readable plates even when text is omitted.

## Example GET /api/ai-demo response (synthetic)

```json
{
  "run": {
    "width": 1280,
    "height": 720,
    "frames": 2,
    "sample_fps": 5,
    "replay_fps": 5,
    "embedding_backend": "resnet18",
    "device": "cpu",
    "detector": "yolo11m.pt",
    "detection_width": 1280,
    "ocr_status": "disabled"
  },
  "vehicles": [
    {
      "vehicle_id": "VX-0001",
      "color": "Blue",
      "first_seen": 10.2,
      "last_seen": 10.2,
      "observation_count": 1,
      "identity_confidence": 0,
      "decision": "NEW",
      "evidence": {}
    }
  ],
  "timeline": [
    {"timestamp": 10.0, "vehicles": []},
    {
      "timestamp": 10.2,
      "vehicles": [
        {"vehicle_id": "VX-0001", "identity_confidence": 0, "decision": "NEW", "evidence": {}}
      ]
    }
  ],
  "video_available": true
}
```

`run.json` stores the metadata above except `replay_fps`, which the API derives
from the minimum of positive `source_fps` and `sample_fps` (or whichever exists).
`vehicles.json` stores the `vehicles` array. `observations.jsonl` stores each
`timeline` entry as a separate line, in the exact order frames were written.

## Timing and safety

- Replay frame index = `floor(video.currentTime * run.replay_fps)`, capped at the last frame.
- Timeline timestamps are **source-video seconds**, not replay seconds. A clip
  beginning at source time 10s still starts at replay time 0s. Do not sort or
  omit empty frames: array position defines synchronization.
- Reveal a vehicle on its first occurrence; deduplicate by `vehicle_id`.
  Current-frame IDs are “In frame”; earlier IDs remain “Previously seen”.
- On seek, rebuild counts and latest matching evidence only through that frame.
- Timeline vehicles expose only `vehicle_id`, optional `identity_confidence`,
  `decision`, and numeric `evidence`. Evidence keys allowed by the API:
  `tracker_id`, `identity_confidence`, `plate_similarity`, `plate_confidence`,
  `visual_similarity`, `color_similarity`, `make_model_similarity`,
  `temporal_plausibility`. Never return raw plate text or embeddings.
- Missing/malformed required metadata returns 404. Missing/malformed
  `observations.jsonl` returns `timeline: []`; the UI shows full results and
  labels playback timing unavailable. Missing media returns 404.

Implementation: `backend/app/api/ai_demo.py`.
