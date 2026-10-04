import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("cv2")

from algorithms.vehicles.matcher import IdentityRegistry, MatchConfig, plate_similarity, visual_similarity
from algorithms.vehicles.models import (ColorResult, PlateResult, VehicleAttributes,
                                         VehicleDetection, VehicleFingerprint)
from algorithms.vehicles.recognition import EasyOCRPlateRecognizer, UnknownClassifier, dominant_color


def test_fingerprint_aggregates_evidence_and_omits_raw_plate_by_default():
    fingerprint = VehicleFingerprint("VX-0001")
    fingerprint.update(np.array([3.0, 4.0]), PlateResult("261-D-12345", .7),
                       ColorResult("blue", .8), VehicleAttributes("VW", "Golf", .6), 3.0)
    fingerprint.update(np.array([0.0, 1.0]), PlateResult("261D12345", .95),
                       ColorResult("blue", .9), VehicleAttributes("VW", "Golf", .8), 4.0)
    assert np.isclose(np.linalg.norm(fingerprint.embedding), 1)
    assert fingerprint.observation_count == 2
    assert fingerprint.first_seen == 3 and fingerprint.last_seen == 4
    assert fingerprint.plate_text == "261D12345"
    assert "plate_text" not in fingerprint.to_dict()
    assert fingerprint.to_dict(store_raw_plates=True)["plate_text"] == "261D12345"


def test_plate_and_visual_similarity():
    assert plate_similarity("261-D-12345", "261D1234S") > plate_similarity("261D12345", "241C88412")
    assert np.isclose(plate_similarity("ABC", "ADC"), 2 / 3)
    assert visual_similarity(np.array([1, 0]), np.array([1, 0])) == 1
    assert visual_similarity(None, np.array([1, 0])) is None


def test_missing_evidence_is_unknown_and_plate_conflict_vetoes():
    fingerprint = VehicleFingerprint("VX-0001")
    fingerprint.update(None, PlateResult("261D12345", .99), None, None, 1)
    fingerprint.update(None, PlateResult("261D12345", .99), None, None, 2)
    registry = IdentityRegistry()
    registry.fingerprints[fingerprint.vehicle_id] = fingerprint
    detection = VehicleDetection((0, 0, 10, 10), "car", .9)
    new, explanation = registry.assign(None, detection, plate=PlateResult("241C88412", .99), timestamp=3)
    assert new.vehicle_id != fingerprint.vehicle_id
    assert explanation["decision"] == "NEW"
    new2, explanation = registry.assign(None, detection, timestamp=4)
    assert explanation["reason"] == "no comparable evidence"
    assert new2.vehicle_id != fingerprint.vehicle_id


def test_low_confidence_plate_cannot_trigger_automatic_match():
    fingerprint = VehicleFingerprint("VX-0001")
    fingerprint.update(None, PlateResult("261D12345", .25), None, None, 1)
    registry = IdentityRegistry()
    registry.fingerprints[fingerprint.vehicle_id] = fingerprint
    assigned, explanation = registry.assign(
        None, VehicleDetection((0, 0, 10, 10), "car", .9),
        plate=PlateResult("261D12345", .25), timestamp=2,
    )
    assert assigned.vehicle_id != fingerprint.vehicle_id
    assert explanation["decision"] == "NEW"


def test_color_only_cannot_match_and_active_tracks_excluded():
    registry = IdentityRegistry(MatchConfig(match_threshold=.85, possible_threshold=.65))
    detection = VehicleDetection((0, 0, 10, 10), "car", .9)
    first, _ = registry.assign(1, detection, np.array([1., 0.]), timestamp=1)
    # Even a color agreement is insufficient without distinctive identity evidence.
    second, explanation = registry.assign(2, detection, None, color=ColorResult("blue", 1), timestamp=1.1)
    assert second.vehicle_id != first.vehicle_id
    assert explanation["decision"] in {"NEW", "POSSIBLE_MATCH_NEW_ID"}
    # Active identity 1 is not eligible for tracker 3.
    third, _ = registry.assign(3, detection, np.array([1., 0.]), timestamp=1.2)
    assert third.vehicle_id != first.vehicle_id


def test_tracker_continuity_keeps_evidence_confidence_not_perfect_score():
    registry = IdentityRegistry()
    detection = VehicleDetection((10, 10, 40, 40), "car", .9)
    fingerprint, initial = registry.assign(7, detection, np.array([1., 0.]), timestamp=1)
    _, tracked = registry.assign(7, detection, np.array([1., 0.]), timestamp=1.2)
    assert tracked["decision"] == "TRACKED"
    assert tracked["confidence"] == initial["confidence"] < 1.0
    assert fingerprint.observation_count == 2


def test_frame_occupied_ids_prevent_unknown_tracker_detections_from_merging():
    registry = IdentityRegistry()
    frame_occupied = set()
    embedding = np.array([1., 0.])
    first, first_explanation = registry.assign(
        None, VehicleDetection((0, 0, 30, 30), "car", .9), embedding,
        timestamp=1.0, occupied=frame_occupied,
    )
    second, second_explanation = registry.assign(
        None, VehicleDetection((50, 0, 80, 30), "car", .9), embedding,
        timestamp=1.0, occupied=frame_occupied,
    )
    assert first.vehicle_id != second.vehicle_id
    assert first_explanation["confidence"] == 0.0
    assert second_explanation["confidence"] == 0.0
    assert second_explanation["candidate_score"] == 0.0
    assert frame_occupied == {first.vehicle_id, second.vehicle_id}


def test_recognition_fallbacks():
    assert UnknownClassifier().classify(np.zeros((2, 2, 3))).make is None
    class Reader:
        def readtext(self, crop):
            return []

    recognizer = EasyOCRPlateRecognizer(reader=Reader(), max_attempts=1)
    assert recognizer.recognize(np.zeros((10, 10, 3), dtype=np.uint8)) is None
    assert recognizer.recognize(np.zeros((10, 10, 3), dtype=np.uint8)) is None
    assert dominant_color(np.zeros((40, 80, 3), dtype=np.uint8)).color == "black"


def test_reconnects_lost_track_with_explainable_available_evidence():
    registry = IdentityRegistry()
    detection = VehicleDetection((10, 10, 50, 50), "car", .9)
    first, _ = registry.assign(1, detection, np.array([1., 0.]), timestamp=1)
    recovered, explanation = registry.assign(2, detection, np.array([1., 0.]), timestamp=4)
    assert recovered.vehicle_id == first.vehicle_id
    assert explanation["decision"] == "MATCH"
    assert explanation["evidence"]["visual_similarity"] == 1
    assert recovered.observation_count == 2


def test_reliable_plate_matches_without_missing_visual_penalty():
    registry = IdentityRegistry()
    detection = VehicleDetection((10, 10, 50, 50), "car", .9)
    first, _ = registry.assign(1, detection, plate=PlateResult("261D12345", .93), timestamp=1)
    recovered, explanation = registry.assign(2, detection, plate=PlateResult("261-D-12345", .91), timestamp=4)
    assert recovered.vehicle_id == first.vehicle_id
    assert explanation["decision"] == "MATCH"


def test_original_resolution_geometry():
    from algorithms.vehicles.geometry import original_bbox
    assert original_bbox([100, 50, 200, 100], (3840, 2160), (1280, 720)) == (300, 150, 600, 300)
    assert original_bbox([-10, -10, 1400, 900], (3840, 2160), (1280, 720)) == (0, 0, 3840, 2160)
