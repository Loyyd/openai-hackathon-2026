"""Process a local video into vehicle fingerprints, JSONL and annotated frames."""
import argparse
import json
import logging
import math
import os
from pathlib import Path

import cv2
import numpy as np

from algorithms.vehicles.config import VideoConfig
from algorithms.vehicles.matcher import MatchConfig
from algorithms.vehicles.processor import VehicleProcessor, annotate


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("output/highway"))
    parser.add_argument("--sample-fps", type=float, default=5)
    parser.add_argument("--start-time", type=float, default=0, help="Seconds into source video")
    parser.add_argument("--end-time", type=float, help="Exclusive end in source seconds")
    parser.add_argument("--detection-width", type=int, default=1280)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--weights", default="yolo11n.pt")
    parser.add_argument("--embedding-backend", choices=["resnet18", "histogram"], default="resnet18")
    parser.add_argument("--recognition-interval", type=float, default=1)
    parser.add_argument("--match-threshold", type=float, default=0.85)
    parser.add_argument("--possible-threshold", type=float, default=0.65)
    parser.add_argument("--no-ocr", action="store_true")
    parser.add_argument("--save-video", action="store_true")
    parser.add_argument("--display", action="store_true")
    parser.add_argument("--store-raw-plates", action="store_true", default=os.getenv("STORE_RAW_PLATES", "false").lower() == "true")
    args = parser.parse_args()
    if not math.isfinite(args.sample_fps) or args.sample_fps <= 0 or args.start_time < 0 or args.detection_width < 64 or args.recognition_interval <= 0:
        parser.error("FPS, width and recognition interval must be positive; start time must be nonnegative")
    if args.end_time is not None and args.end_time <= args.start_time:
        parser.error("end time must follow start time")
    if not 0 <= args.possible_threshold <= args.match_threshold <= 1:
        parser.error("thresholds must satisfy 0 <= possible <= match <= 1")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        parser.error(f"Cannot open video {args.video}")
    source_fps = cap.get(cv2.CAP_PROP_FPS)
    if not source_fps or not math.isfinite(source_fps):
        cap.release()
        parser.error("Video has no valid frame rate")
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    config = VideoConfig(sample_fps=args.sample_fps, detection_width=args.detection_width, device=args.device,
                         weights=args.weights, embedding_backend=args.embedding_backend, ocr=not args.no_ocr,
                         recognition_interval=args.recognition_interval, store_raw_plates=args.store_raw_plates)
    processor = VehicleProcessor(config, MatchConfig(match_threshold=args.match_threshold, possible_threshold=args.possible_threshold))
    args.output.mkdir(parents=True, exist_ok=True)
    writer = None
    sampled_fps = min(source_fps, args.sample_fps)
    if args.save_video:
        writer = cv2.VideoWriter(str(args.output / "annotated.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), sampled_fps, (width, height))
        if not writer.isOpened():
            cap.release()
            parser.error("Cannot create annotated MP4")
    frame_index = math.ceil(args.start_time * source_fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    next_sample = frame_index / source_fps
    frames = 0
    best_sizes: dict[str, int] = {}
    last_evidence: dict[str, dict] = {}
    display = args.display
    if display and os.name != "nt" and not os.getenv("DISPLAY") and not os.getenv("WAYLAND_DISPLAY"):
        import sys
        if sys.platform != "darwin":
            logging.warning("No graphical display available; annotated video and JSON remain enabled")
            display = False
    try:
        with (args.output / "observations.jsonl").open("w") as log:
            while True:
                timestamp = frame_index / source_fps
                if args.end_time is not None and timestamp >= args.end_time:
                    break
                ok = cap.grab()
                frame_index += 1
                if not ok:
                    break
                if timestamp + 1e-6 < next_sample:
                    continue
                ok, image = cap.retrieve()
                if not ok:
                    break
                next_sample += 1 / sampled_fps
                result = processor.process_frame(image, timestamp=timestamp)
                log.write(json.dumps(result, allow_nan=False) + "\n")
                for item in result["vehicles"]:
                    last_evidence[item["vehicle_id"]] = {key: item[key] for key in ("identity_confidence", "decision", "evidence")}
                    x1, y1, x2, y2 = item["bbox"]
                    area = (x2 - x1) * (y2 - y1)
                    if area > best_sizes.get(item["vehicle_id"], 0):
                        path = args.output / "crops" / item["vehicle_id"]
                        path.mkdir(parents=True, exist_ok=True)
                        cv2.imwrite(str(path / "best.jpg"), image[y1:y2, x1:x2])
                        best_sizes[item["vehicle_id"]] = area
                annotated = annotate(image, result)
                if writer:
                    writer.write(annotated)
                cv2.imwrite(str(args.output / "latest.jpg"), annotated)
                if display:
                    cv2.imshow("SentinelX vehicles", cv2.resize(annotated, (1280, round(height * 1280 / width))))
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                frames += 1
                logging.info("%.2fs: %d vehicles, %d identities", timestamp, len(result["vehicles"]), len(processor.registry.fingerprints))
    finally:
        cap.release()
        if writer:
            writer.release()
        if display:
            cv2.destroyAllWindows()
        fingerprints = processor.registry.fingerprints
        (args.output / "vehicles.json").write_text(json.dumps([v.to_dict(args.store_raw_plates) | last_evidence.get(v.vehicle_id, {}) for v in fingerprints.values()], indent=2))
        vectors = {key: value.embedding for key, value in fingerprints.items() if value.embedding is not None}
        np.savez_compressed(args.output / "embeddings.npz", **vectors)
        (args.output / "run.json").write_text(json.dumps({"source": str(args.video), "width": width, "height": height,
            "source_fps": source_fps, "sample_fps": sampled_fps, "frames": frames,
            "embedding_backend": processor.encoder.backend, "device": processor.detector.device,
            "ocr_status": "disabled" if not processor.plate_recognizer else "unavailable" if processor.plate_recognizer._initialization_failed else "attempted (readability not guaranteed)",
            "raw_plates_stored": args.store_raw_plates}, indent=2))
    print(f"Processed {frames} sampled frames; output: {args.output}")


if __name__ == "__main__":
    main()
