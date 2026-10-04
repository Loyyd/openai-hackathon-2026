def original_bbox(bbox: list[float], source_size: tuple[int, int], resized_size: tuple[int, int]) -> tuple[int, int, int, int]:
    """Scale xyxy from detector pixels to clamped original-image pixels."""
    width, height = source_size
    small_width, small_height = resized_size
    x1, y1, x2, y2 = bbox
    return (max(0, min(width, int(x1 * width / small_width))),
            max(0, min(height, int(y1 * height / small_height))),
            max(0, min(width, int(x2 * width / small_width))),
            max(0, min(height, int(y2 * height / small_height))))
