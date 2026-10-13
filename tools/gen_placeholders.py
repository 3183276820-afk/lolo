#!/usr/bin/env python3
# 生成喂食功能的占位素材（透明 PNG）。
# 仅为让功能立刻可运行；请用真实 APNG/PNG 覆盖同名文件：
#   feed.png          720x960 带透明通道，lolo 吃食动画
#   food_<id>.png     任意尺寸透明 PNG，食物图标/道具（建议 96x96 或 120x120）
import os, zlib, struct

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'videos')

def write_png(path, w, h, pixels):
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))
    comp = zlib.compress(bytes(raw), 9)
    def chunk(typ, data):
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) \
          + chunk(b'IDAT', comp) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)

def blank(w, h):
    return [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]

def disc(px, cx, cy, r, color, ring=None):
    h = len(px); w = len(px[0])
    for y in range(h):
        for x in range(w):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= r * r:
                px[y][x] = color
            elif ring and d <= (r + 3) ** 2:
                px[y][x] = ring

def make_food(name, color):
    w = h = 96
    px = blank(w, h)
    disc(px, 48, 48, 34, color, ring=(max(0, color[0]-40), max(0, color[1]-40), max(0, color[2]-40), 255))
    write_png(os.path.join(OUT, name), w, h, px)

def make_feed():
    w, h = 720, 960
    px = blank(w, h)
    # 简单“食盆”：底部居中的大椭圆 + 几颗食物点
    bowl = (180, 150, 120, 255)
    bowl_ring = (120, 95, 70, 255)
    disc(px, 360, 720, 150, bowl, ring=bowl_ring)
    for (dx, dy, c) in [(-40, -30, (220, 80, 80, 255)), (10, -50, (240, 240, 250, 255)),
                        (55, -25, (245, 240, 215, 255)), (0, -10, (100, 160, 220, 255))]:
        disc(px, 360 + dx, 700 + dy, 26, c)
    write_png(os.path.join(OUT, 'feed.png'), w, h, px)

foods = {
    'food_fish.png':  (100, 160, 220, 255),
    'food_apple.png': (220, 80, 80, 255),
    'food_milk.png':  (240, 240, 250, 255),
    'food_bone.png':  (230, 225, 200, 255),
    'food_rice.png':  (245, 240, 215, 255),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make_feed()
    for n, c in foods.items():
        make_food(n, c)
    print('占位素材已生成到', os.path.abspath(OUT))
