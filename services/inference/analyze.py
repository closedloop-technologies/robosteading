from __future__ import annotations

import math
from collections import deque


def point_in_polygon(point, polygon):
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersects = (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def assign_zone(centroid, zones):
    for zone in zones:
        if zone.get("active") is False or zone.get("assign_chicks") is False:
            continue
        if point_in_polygon(centroid, zone["polygon"]):
            return zone["name"]
    return "unknown"


def distance(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


class ActivityTracker:
    def __init__(self, maxlen=200):
        self.previous = {}
        self.history = deque(maxlen=maxlen)

    def label(self, track_id, centroid):
        previous = self.previous.get(track_id)
        self.previous[track_id] = centroid
        if previous is None:
            return "shifting", 0.0
        delta = distance(previous, centroid)
        if delta < 8:
            activity = "resting"
        elif delta < 35:
            activity = "shifting"
        else:
            activity = "active"
        self.history.append(delta)
        return activity, delta

    def movement_score(self):
        if not self.history:
            return 0.0
        return min(sum(self.history) / len(self.history) / 80, 1.0)


def comfort_score(detections, heater_zone_pct, movement_score):
    score = 4
    if not detections:
        score -= 1
    if heater_zone_pct > 0.8:
        score -= 1
    if heater_zone_pct < 0.05 and detections:
        score -= 1
    if movement_score < 0.03 and detections:
        score -= 1
    if 0.15 <= heater_zone_pct <= 0.75 and movement_score >= 0.05:
        score += 1
    return max(1, min(5, score))
