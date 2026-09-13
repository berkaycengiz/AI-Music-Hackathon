"""Geometry only; measurements are normalized heuristics, not semantic recognition."""
import cv2
import numpy as np
from .models import Shape


def analyze_shape(rgb):
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    # Normalize analysis resolution to reduce dependence on input image size.
    h, w = gray.shape
    gray = cv2.resize(gray, (max(8, round(192*w/max(h,w))),
                             max(8, round(192*h/max(h,w)))))
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(gray, 50, 120)
    density = float(np.count_nonzero(edges) / edges.size)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    lengths, sharp, turns = [], 0, 0
    for c in contours:
        length = cv2.arcLength(c, False)
        if length < 5:
            continue
        lengths.append(length)
        p = cv2.approxPolyDP(c, 1.5, False).reshape(-1, 2).astype(float)
        for a, b, d in zip(p, p[1:], p[2:]):
            u, v = b-a, d-b
            norm = np.linalg.norm(u)*np.linalg.norm(v)
            if norm:
                angle = np.degrees(np.arccos(np.clip(u@v/norm, -1, 1)))
                sharp += angle > 45
                turns += 1
    long_ratio = float(sum(x for x in lengths if x > .6*max(gray.shape)) /
                       max(sum(lengths), 1))
    angularity = float(sharp/max(turns, 1))
    smoothness = 1-angularity if lengths else 0.0
    # Axial orientation: a line has no arrow. Convert y-down image coordinates
    # to y-up and interpret its slope from left to right. Vertical is neutral.
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=15,
                           minLineLength=max(6, min(gray.shape)//5), maxLineGap=4)
    orientation, strength = None, 0.0
    if lines is not None:
        lines = lines[:, 0, :].astype(float)
        dx, dy = lines[:, 2]-lines[:, 0], -(lines[:, 3]-lines[:, 1])
        weights = np.hypot(dx, dy)
        angles = np.arctan2(dy, dx)
        z = np.sum(weights*np.exp(2j*angles))/max(weights.sum(), 1)
        strength = float(abs(z))
        orientation = float(np.degrees(np.angle(z)/2))
    flow = long_ratio*smoothness
    complexity = float(np.clip(.65*min(density/.20, 1)+.35*angularity, 0, 1))
    return Shape(density, long_ratio, angularity, orientation, strength,
                 smoothness, flow, complexity)
