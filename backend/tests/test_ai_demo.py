import json

from fastapi.testclient import TestClient
from backend.app.main import create_app


def test_demo_missing_and_safe_artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DEMO_DIR", str(tmp_path))
    client = TestClient(create_app())
    assert client.get("/api/ai-demo").status_code == 404
    (tmp_path / "run.json").write_text(json.dumps({"device": "cpu", "source": "/private/path"}))
    (tmp_path / "vehicles.json").write_text(json.dumps([{"vehicle_id": "VX-0001", "plate_text": "PRIVATE"}]))
    result = client.get("/api/ai-demo").json()
    assert result["vehicles"] == [{"vehicle_id": "VX-0001"}]
    assert "source" not in result["run"]
    assert client.get("/api/ai-demo/media/vehicles.json").status_code == 404


def _write_demo(tmp_path, observations=None, run=None):
    (tmp_path / "run.json").write_text(json.dumps(run or {"sample_fps": 5}))
    (tmp_path / "vehicles.json").write_text(json.dumps([{"vehicle_id": "VX-0001", "plate_text": "PRIVATE"}]))
    if observations is not None:
        (tmp_path / "observations.jsonl").write_text(observations)


def test_demo_timeline_preserves_frame_order_and_sanitizes(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DEMO_DIR", str(tmp_path))
    frames = [
        {"timestamp": 1.2, "vehicles": [{
            "vehicle_id": "VX-0001", "identity_confidence": 0.91, "decision": "MATCH",
            "evidence": {"visual_similarity": 0.8, "plate_similarity": 0.9, "plate_text": "PRIVATE"},
            "bbox": [1, 2, 3, 4], "embedding": [0.1], "plate_text": "PRIVATE", "customer": "private",
        }]},
        {"timestamp": 0.5, "vehicles": []},
    ]
    _write_demo(tmp_path, "\n".join(json.dumps(frame) for frame in frames),
                {"source_fps": 30, "sample_fps": 5, "source": "/private/source.mp4"})

    result = TestClient(create_app()).get("/api/ai-demo").json()

    assert result["run"]["replay_fps"] == 5
    assert "source" not in result["run"]
    assert result["timeline"] == [
        {"timestamp": 1.2, "vehicles": [{
            "vehicle_id": "VX-0001", "identity_confidence": 0.91, "decision": "MATCH",
            "evidence": {"visual_similarity": 0.8, "plate_similarity": 0.9},
        }]},
        {"timestamp": 0.5, "vehicles": []},
    ]
    assert "PRIVATE" not in json.dumps(result["timeline"])


def test_demo_timeline_absent_and_fps_fallback(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DEMO_DIR", str(tmp_path))
    _write_demo(tmp_path, run={"sample_fps": 4})

    result = TestClient(create_app()).get("/api/ai-demo").json()

    assert result["timeline"] == []
    assert result["vehicles"] == [{"vehicle_id": "VX-0001"}]
    assert result["run"]["replay_fps"] == 4


def test_malformed_timeline_does_not_break_summary(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DEMO_DIR", str(tmp_path))
    _write_demo(tmp_path, '{"timestamp": 1, "vehicles": []}\nnot-json\n',
                {"source_fps": 24, "sample_fps": 30})

    response = TestClient(create_app()).get("/api/ai-demo")

    assert response.status_code == 200
    assert response.json()["timeline"] == []
    assert response.json()["vehicles"] == [{"vehicle_id": "VX-0001"}]
    assert response.json()["run"]["replay_fps"] == 24
