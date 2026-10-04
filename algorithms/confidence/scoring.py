def final_confidence(
    model_confidence: float,
    temporal_consistency: float = 1.0,
    data_quality: float = 1.0,
) -> float:
    """Combine independent confidence factors and clamp the result to [0, 1]."""
    factors = (model_confidence, temporal_consistency, data_quality)
    if any(not 0 <= factor <= 1 for factor in factors):
        raise ValueError("confidence factors must be between 0 and 1")
    return min(1.0, max(0.0, model_confidence * temporal_consistency * data_quality))
