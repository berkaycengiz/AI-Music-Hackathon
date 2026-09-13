"""Pillow/OpenCV feature extraction, deliberately independent of musical mapping."""
import colorsys
import cv2
import numpy as np
from PIL import Image, ImageOps
from sklearn.cluster import KMeans
from threadpoolctl import threadpool_limits
from .models import Color, ImageFeatures, RegionFeatures
from .shape_analysis import analyze_shape


def load_grid_image(path):
    with Image.open(path) as source:
        # Honor camera orientation; composite transparency on white consistently.
        rgba = ImageOps.exif_transpose(source).convert('RGBA')
        canvas = Image.new('RGBA', rgba.size, 'white')
        canvas.alpha_composite(rgba)
        rgb = np.asarray(canvas.convert('RGB'))
    h, w = rgb.shape[:2]
    if min(w, h) < 4:
        raise ValueError('Image must be at least 4 by 4 pixels.')
    return np.pad(rgb, ((0, (-h)%4), (0, (-w)%4), (0, 0)), mode='edge'), (w, h)


def dominant_colors(rgb, sample_limit=4096):
    # Fixed, evenly distributed sample bounds runtime and preserves reproducibility.
    pixels = rgb.reshape(-1, 3)
    sample = pixels[np.linspace(0, len(pixels)-1,
                                min(sample_limit, len(pixels)), dtype=int)]
    lab = cv2.cvtColor(sample.astype(np.float32).reshape(1, -1, 3)/255,
                       cv2.COLOR_RGB2LAB).reshape(-1, 3)
    k = min(3, len(np.unique(lab, axis=0)))
    with threadpool_limits(limits=1):
        model = KMeans(n_clusters=k, random_state=0, n_init=10, algorithm='lloyd').fit(lab)
    counts = np.bincount(model.labels_, minlength=k)
    colors = []
    for center, count in zip(model.cluster_centers_, counts):
        representative = cv2.cvtColor(center.reshape(1, 1, 3), cv2.COLOR_LAB2RGB)[0, 0]
        rgb_value = tuple(int(v) for v in np.clip(np.rint(representative*255), 0, 255))
        hue, saturation, brightness = colorsys.rgb_to_hsv(*(v/255 for v in rgb_value))
        colors.append(Color(rgb_value, hue*360, saturation, brightness,
                            float(center[0]), float(count/len(sample))))
    colors.sort(key=lambda c: (-c.weight, c.rgb))
    # Uniform/bicolor images have fewer than three real clusters. Pad the palette
    # with zero-weight duplicates instead of fabricating nonexistent colors.
    while len(colors) < 3:
        c = colors[-1]
        colors.append(Color(c.rgb, c.hue, c.saturation, c.brightness, c.lightness, 0.0))
    return colors


def extract_image_features(path):
    rgb, source_size = load_grid_image(path)
    h, w = rgb.shape[:2]
    palette = dominant_colors(rgb)
    # Whole-image averages are independent of the three-color approximation.
    small = cv2.resize(rgb, (min(w, 256), min(h, 256))).astype(np.float32)/255
    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV)
    lab = cv2.cvtColor(small, cv2.COLOR_RGB2LAB)
    global_shape = analyze_shape(rgb)
    squares = {}
    for i in range(16):
        row, col = divmod(i, 4)
        x, y = col*(w//4), row*(h//4)
        region = rgb[y:y+h//4, x:x+w//4]
        squares[i] = RegionFeatures(i, (x, y, x+w//4, y+h//4),
                                    dominant_colors(region), analyze_shape(region))
    return ImageFeatures(source_size, (w, h), palette, float(hsv[..., 1].mean()),
                         float(lab[..., 0].mean()), global_shape, squares)
