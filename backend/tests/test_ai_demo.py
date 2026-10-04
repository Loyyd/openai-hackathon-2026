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
