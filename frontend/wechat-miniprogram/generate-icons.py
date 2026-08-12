#!/usr/bin/env python3
"""Generate simple placeholder WeChat tabbar icons using only stdlib."""
import struct
import zlib
import os

OUT_DIR = "miniprogram/assets/icons"
os.makedirs(OUT_DIR, exist_ok=True)


def png_chunk(chunk_type, data):
    chunk = chunk_type + data
    crc = zlib.crc32(chunk) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)


def make_png(width, height, rgb):
    """Return PNG bytes for a solid RGB image."""
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b"IHDR", ihdr_data)

    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(rgb * width)
    idat_data = zlib.compress(raw)
    idat = png_chunk(b"IDAT", idat_data)
    iend = png_chunk(b"IEND", b"")
    return signature + ihdr + idat + iend


def save_icon(name, rgb):
    path = os.path.join(OUT_DIR, name)
    with open(path, "wb") as f:
        f.write(make_png(81, 81, rgb))
    print(f"Created {path}")


# 使用品牌色 #1a1a2e 和浅灰 #f5f6fa 作为占位图标
save_icon("home.png", (245, 246, 250))              # 未选中：浅灰
save_icon("home-active.png", (26, 26, 46))          # 选中：品牌深蓝
save_icon("portfolio.png", (245, 246, 250))
save_icon("portfolio-active.png", (26, 26, 46))
save_icon("valuation.png", (245, 246, 250))
save_icon("valuation-active.png", (26, 26, 46))
save_icon("monitor.png", (245, 246, 250))
save_icon("monitor-active.png", (26, 26, 46))
save_icon("user.png", (245, 246, 250))
save_icon("user-active.png", (26, 26, 46))
