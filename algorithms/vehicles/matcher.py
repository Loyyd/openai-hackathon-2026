"""Explainable, evidence-weighted matching for vehicle fingerprints."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .models import (ColorResult, PlateResult, VehicleAttributes, VehicleDetection,
                     VehicleFingerprint, normalize_embedding, normalize_plate)


def visual_similarity(vehicle_a: np.ndarray | None, vehicle_b: np.ndarray | None) -> float | None:
    a, b = normalize_embedding(vehicle_a), normalize_embedding(vehicle_b)
    if a is None or b is None or a.shape != b.shape:
        return None
    return float(np.clip((np.dot(a, b) + 1.0) / 2.0, 0.0, 1.0))


def plate_similarity(plate_a: str, plate_b: str) -> float:
    a, b = normalize_plate(plate_a), normalize_plate(plate_b)
    if not a or not b:
        return 0.0
    previous = list(range(len(b) + 1))
    for index_a, char_a in enumerate(a, start=1):
        current = [index_a]
        for index_b, char_b in enumerate(b, start=1):
            current.append(min(current[-1] + 1, previous[index_b] + 1,
                               previous[index_b - 1] + (char_a != char_b)))
        previous = current
    return 1.0 - previous[-1] / max(len(a), len(b))


@dataclass
class MatchConfig:
    weights: dict[str, float] = field(default_factory=lambda: {
        "plate": 0.55, "visual": 0.30, "color": 0.08, "make_model": 0.07,
    })
    match_threshold: float = 0.85
    possible_threshold: float = 0.65
    max_track_gap: float = 2.0
    max_temporal_boost: float = 0.05
    ambiguity_margin: float = 0.08


def score_fingerprint(candidate: VehicleFingerprint, embedding: np.ndarray | None,
                      plate: PlateResult | None, color: ColorResult | None,
                      attributes: VehicleAttributes | None, timestamp: float,
                      config: MatchConfig | None = None,
                      bbox: tuple[int, int, int, int] | None = None) -> dict:
    config = config or MatchConfig()
    evidence: dict[str, float] = {}
    weighted: list[tuple[float, float]] = []
    if plate and plate.text and candidate.plate_text:
        similarity = plate_similarity(plate.text, candidate.plate_text)
        quality = min(1.0, plate.confidence) * candidate.plate_confidence
        evidence["plate_similarity"] = similarity
        evidence["plate_confidence"] = quality
        # A confident disagreement is a hard veto, not just a low score.
        if quality >= 0.55 and similarity < 0.65:
            return {"score": 0.0, "decision": "NEW", "evidence": evidence,
                    "reason": "reliable contradictory plate"}
        weighted.append((config.weights["plate"] * quality, similarity))
    visual = visual_similarity(embedding, candidate.embedding)
    if visual is not None:
        evidence["visual_similarity"] = visual
        weighted.append((config.weights["visual"], visual))
    if color and color.color not in {None, "unknown", "other"} and candidate.color not in {None, "unknown", "other"}:
        similarity = 1.0 if color.color.lower() == candidate.color else 0.0
        evidence["color_similarity"] = similarity
        reliability = min(color.confidence, candidate.color_confidence)
        weighted.append((config.weights["color"] * reliability, similarity))
    if attributes and (attributes.make or attributes.model):
        prior = candidate.attributes
        if prior.make or prior.model:
            parts = [int(a.lower() == b.lower()) for a, b in
                     ((attributes.make, prior.make), (attributes.model, prior.model)) if a and b]
            if parts:
                similarity = sum(parts) / len(parts)
                evidence["make_model_similarity"] = similarity
                reliability = attributes.confidence * prior.confidence
                weighted.append((config.weights["make_model"] * reliability, similarity))
    denominator = sum(weight for weight, _ in weighted)
    if denominator <= 0:
        return {"score": 0.0, "decision": "NEW", "evidence": evidence,
                "reason": "no comparable evidence"}
    score = sum(weight * value for weight, value in weighted) / denominator
    temporal = 0.0
    if bbox is not None and candidate.last_bbox is not None and candidate.last_seen is not None:
        gap = max(0.0, timestamp - candidate.last_seen)
        if config.max_track_gap > 0 and gap <= config.max_track_gap:
            old = candidate.last_bbox
            old_center = ((old[0] + old[2]) / 2, (old[1] + old[3]) / 2)
            new_center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
            old_scale = max(1.0, ((old[2] - old[0]) ** 2 + (old[3] - old[1]) ** 2) ** .5)
            distance = ((old_center[0] - new_center[0]) ** 2 + (old_center[1] - new_center[1]) ** 2) ** .5
            temporal = max(0.0, 1.0 - distance / (old_scale * 4)) * (1.0 - gap / config.max_track_gap)
    boost = min(config.max_temporal_boost, config.max_temporal_boost * temporal)
    evidence["temporal_plausibility"] = temporal
    score = min(1.0, score + boost)
    decision = "MATCH" if score >= config.match_threshold else (
        "POSSIBLE_MATCH" if score >= config.possible_threshold else "NEW")
    reliable_plate = "plate_confidence" in evidence and evidence["plate_confidence"] >= 0.55
    if not reliable_plate and "visual_similarity" not in evidence:
        decision = "NEW" if "plate_confidence" in evidence else "POSSIBLE_MATCH"
    return {"score": score, "decision": decision, "evidence": evidence, "reason": "weighted available evidence"}


class IdentityRegistry:
    def __init__(self, config: MatchConfig | None = None):
        self.config = config or MatchConfig()
        self.fingerprints: dict[str, VehicleFingerprint] = {}
        self.track_to_vehicle: dict[int, str] = {}
        self.track_confidence: dict[int, float] = {}
        self._next_id = 1

    def assign(self, tracker_id: int | None, detection: VehicleDetection,
               embedding: np.ndarray | None = None, plate: PlateResult | None = None,
               color: ColorResult | None = None, attributes: VehicleAttributes | None = None,
               timestamp: float = 0.0, occupied: set[str] | None = None) -> tuple[VehicleFingerprint, dict]:
        self._expire(timestamp)
        occupied_ids = set(occupied or ())
        occupied_ids.update(vehicle_id for track, vehicle_id in self.track_to_vehicle.items()
                            if tracker_id is None or track != tracker_id)
        current = self.track_to_vehicle.get(tracker_id) if tracker_id is not None else None
        if current in self.fingerprints:
            fingerprint = self.fingerprints[current]
            fingerprint.update(embedding, plate, color, attributes, timestamp)
            fingerprint.last_bbox = detection.bbox
            confidence = self.track_confidence.get(tracker_id, 0.0)
            if occupied is not None:
                occupied.add(current)
            return fingerprint, {"vehicle_id": current, "decision": "TRACKED", "confidence": confidence,
                                 "evidence": {"tracker_id": tracker_id, "identity_confidence": confidence},
                                 "reason": "tracker continuity; confidence retains original identity evidence"}
        scored = [(score_fingerprint(item, embedding, plate, color, attributes, timestamp,
                                     self.config, detection.bbox), item)
                  for item in self.fingerprints.values() if item.vehicle_id not in occupied_ids]
        scored.sort(key=lambda pair: pair[0]["score"], reverse=True)
        result, chosen = scored[0] if scored else ({"score": 0.0, "decision": "NEW", "evidence": {}, "reason": "no candidates"}, None)
        # Ambiguous candidates are reported, never merged.
        if result["decision"] != "MATCH":
            chosen = None
        elif len(scored) > 1 and result["score"] - scored[1][0]["score"] < self.config.ambiguity_margin:
            result = dict(result, decision="POSSIBLE_MATCH", reason="top candidate is ambiguous")
            chosen = None
        if chosen is None:
            while f"VX-{self._next_id:04d}" in self.fingerprints:
                self._next_id += 1
            vehicle_id = f"VX-{self._next_id:04d}"
            self._next_id += 1
            chosen = VehicleFingerprint(vehicle_id)
            self.fingerprints[vehicle_id] = chosen
            decision = "NEW" if result["decision"] != "POSSIBLE_MATCH" else "POSSIBLE_MATCH_NEW_ID"
        else:
            decision = "MATCH"
        chosen.update(embedding, plate, color, attributes, timestamp)
        chosen.last_bbox = detection.bbox
        if tracker_id is not None:
            # Never let active tracker IDs share a persistent identity.
            if chosen.vehicle_id not in {v for k, v in self.track_to_vehicle.items() if k != tracker_id}:
                self.track_to_vehicle[tracker_id] = chosen.vehicle_id
                self.track_confidence[tracker_id] = result["score"] if decision == "MATCH" else 0.0
        if occupied is not None:
            occupied.add(chosen.vehicle_id)
        explanation = {"vehicle_id": chosen.vehicle_id, "decision": decision,
                       "confidence": result["score"] if decision == "MATCH" else 0.0,
                       "candidate_score": result["score"], "evidence": result["evidence"],
                       "reason": result["reason"]}
        return chosen, explanation

    def _expire(self, timestamp: float) -> None:
        self.track_to_vehicle = {track: vehicle for track, vehicle in self.track_to_vehicle.items()
                                 if vehicle in self.fingerprints and self.fingerprints[vehicle].last_seen is not None
                                 and timestamp - self.fingerprints[vehicle].last_seen <= self.config.max_track_gap}
        self.track_confidence = {track: confidence for track, confidence in self.track_confidence.items()
                                 if track in self.track_to_vehicle}
