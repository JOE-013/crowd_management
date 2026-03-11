"""4-section ROI density estimation."""

from config import ROI_DEFINITIONS


def assign_to_roi(cx: int, cy: int, rois: list[dict]) -> str | None:
    """Return the name of the first ROI containing point (cx, cy), or None."""
    for roi in rois:
        if roi["x1"] <= cx <= roi["x2"] and roi["y1"] <= cy <= roi["y2"]:
            return roi["name"]
    return None


def compute_density(
    boxes: list[dict],
    rois: list[dict] = ROI_DEFINITIONS,
) -> dict[str, dict]:
    """Compute per-section people count and density (people per 10k px²)."""
    roi_counts: dict[str, int] = {roi["name"]: 0 for roi in rois}
    roi_areas: dict[str, int] = {
        roi["name"]: (roi["x2"] - roi["x1"]) * (roi["y2"] - roi["y1"])
        for roi in rois
    }

    for box in boxes:
        name = assign_to_roi(box["cx"], box["cy"], rois)
        if name is not None:
            roi_counts[name] += 1

    density_map: dict[str, dict] = {}
    for name in roi_counts:
        area = roi_areas[name]
        density = (roi_counts[name] / area * 10_000) if area > 0 else 0.0
        density_map[name] = {"count": roi_counts[name], "density": round(density, 4)}

    return density_map


def get_max_section(density_map: dict[str, dict]) -> tuple[str, float]:
    """Return the (section_name, density) of the most crowded section."""
    max_name = max(density_map, key=lambda k: density_map[k]["density"])
    return max_name, density_map[max_name]["density"]
