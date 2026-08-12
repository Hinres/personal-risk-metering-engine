#!/usr/bin/env python3
"""Generate a polished PRME share card PNG using only stdlib."""
import struct
import zlib
import os
import math

OUT_PATH = "miniprogram/assets/share-risk.png"
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

WIDTH, HEIGHT = 500, 400

# Brand colors
BG = (26, 26, 46)
GRID = (40, 40, 70)
ACCENT = (7, 193, 96)
WHITE = (255, 255, 255)


def png_chunk(chunk_type, data):
    chunk = chunk_type + data
    crc = zlib.crc32(chunk) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)


def clamp(v):
    return max(0, min(255, int(v)))


def blend(upper, lower, alpha):
    return tuple(clamp(upper[i] * alpha + lower[i] * (1 - alpha)) for i in range(3))


def build_png():
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = png_chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0))

    pixel_map = []
    for y in range(HEIGHT):
        row = []
        for x in range(WIDTH):
            # Background with subtle vignette
            cx, cy = x - WIDTH / 2, y - HEIGHT / 2
            dist = math.sqrt(cx * cx + cy * cy) / (WIDTH / 2)
            vignette = 1 - dist * 0.25
            r = clamp(BG[0] * vignette)
            g = clamp(BG[1] * vignette)
            b = clamp(BG[2] * vignette)
            # Grid lines
            if x % 50 == 0 or y % 50 == 0:
                r, g, b = blend(GRID, (r, g, b), 0.3)
            row.append((r, g, b))
        pixel_map.append(row)

    # Draw a line chart in the center area
    chart_points = [
        (80, 270), (140, 250), (200, 280), (260, 220), (320, 240), (380, 180), (440, 200)
    ]

    for x in range(WIDTH):
        line_y = None
        for i in range(len(chart_points) - 1):
            x1, y1 = chart_points[i]
            x2, y2 = chart_points[i + 1]
            if x1 <= x <= x2:
                t = (x - x1) / (x2 - x1) if x2 != x1 else 0
                line_y = y1 + (y2 - y1) * t
                break
        if line_y is not None:
            fill_y = int(line_y)
            for y in range(fill_y, 310):
                alpha = 0.12 * (1 - (y - fill_y) / (310 - fill_y))
                pixel_map[y][x] = blend(ACCENT, pixel_map[y][x], alpha)
            # Line itself
            for dy in range(-2, 3):
                yy = fill_y + dy
                if 0 <= yy < HEIGHT:
                    a = max(0, 1 - abs(dy) / 2.5)
                    pixel_map[yy][x] = blend(WHITE, pixel_map[yy][x], a)

    # Draw data points as circles
    for px, py in chart_points:
        for dy in range(-6, 7):
            for dx in range(-6, 7):
                d = math.sqrt(dx * dx + dy * dy)
                if d <= 6:
                    yy, xx = py + dy, px + dx
                    if 0 <= yy < HEIGHT and 0 <= xx < WIDTH:
                        a = 1 - d / 6
                        pixel_map[yy][xx] = blend(WHITE, pixel_map[yy][xx], a)

    # Subtle abstract bars on top right
    for bx, bw, bh in [(350, 15, 40), (375, 15, 70), (400, 15, 55)]:
        for y in range(50 - bh, 50):
            for x in range(bx, bx + bw):
                if 0 <= y < HEIGHT and 0 <= x < WIDTH:
                    pixel_map[y][x] = blend(WHITE, pixel_map[y][x], 0.4)

    # Bottom accent bar
    for y in range(350, 356):
        for x in range(40, WIDTH - 40):
            pixel_map[y][x] = ACCENT

    # Flatten rows
    raw = b""
    for y in range(HEIGHT):
        raw += b"\x00" + b"".join(bytes(p) for p in pixel_map[y])

    idat = png_chunk(b"IDAT", zlib.compress(raw))
    iend = png_chunk(b"IEND", b"")
    return signature + ihdr + idat + iend


with open(OUT_PATH, "wb") as f:
    f.write(build_png())

print(f"Created {OUT_PATH}")
