"""Validate exported fixtures against the published contracts."""
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker
from pydantic import ValidationError

from shared import demo, models


@pytest.mark.parametrize("name,items", [
    ("Location", demo.LOCATIONS), ("Camera", demo.CAMERAS),
    ("CameraObservation", demo.OBSERVATIONS), ("Incident", demo.INCIDENTS),
    ("TransportObservation", demo.TRANSPORT),
])
def test_exported_contracts(name, items):
    schema = json.loads((Path(__file__).parent / "schemas" / f"{name}.json").read_text())
    assert schema == getattr(models, name).model_json_schema()
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    for item in items:
        validator.validate(item.model_dump(mode="json"))


def test_confidence_and_timezone_validation():
    data = demo.INCIDENTS[0].model_dump(mode="json")
    with pytest.raises(ValidationError):
        models.Incident(**(data | {"confidence": 1.5}))
    with pytest.raises(ValidationError):
        models.Incident(**(data | {"first_seen": "2026-10-04T10:00:00"}))
