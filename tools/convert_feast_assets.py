# -*- coding: utf-8 -*-
"""把用户提供的素材转换成 lolo 桌宠需要的格式:
1. 吃饱了.mp4 (绿幕) -> assets/videos/feed.png (720x960 透明 APNG)
2. 10 张带棋盘格底的 JPG -> assets/videos/food_<id>.png (透明 PNG)
"""
import os, sys, glob
import numpy as np
import imageio.v3 as iio
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = os.path.join(ROOT, 'assets', 'videos')

# ---------- 1) mp4 -> feed.png ----------
def convert_mp4():
    src = os.path.join(ROOT, '吃饱了.mp4')
    frames = iio.imread(src)              # (N,720,720,3)
    print('mp4:', frames.shape)
    alphas_all = []
    out_frames = []
    for i, f in enumerate(frames):
        r = f[:, :, 0].astype(int); g = f[:, :, 1].astype(int); b = f[:, :, 2].astype(int)
        greenness = g - np.maximum(r, b)
        cand = greenness > 14
        lab, n = ndimage.label(cand)
        border_ids = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
        border_ids = border_ids[border_ids != 0]
        bg = np.isin(lab, border_ids)
        a = np.where(bg, 0, 255).astype(np.uint8)
        am = Image.fromarray(a, 'L').filter(ImageFilter.GaussianBlur(1.2))
        alpha = np.array(am)
        # 边缘半透明像素做绿色溢出抑制
        semi = (alpha > 0) & (alpha < 250)
        rgb = f.copy()
        gm = semi & (greenness > 10)
        rgb[:, :, 1] = np.where(gm, (r + b // 2) // 2 + 10, g).clip(0, 255).astype(np.uint8)
        out = np.dstack([rgb, alpha])
        alphas_all.append(alpha > 30)
        out_frames.append(out)
        if i % 24 == 0:
            print('  keyed frame', i)
    # 全片统一包围盒（避免逐帧缩放抖动）
    union = np.zeros(frames.shape[1:3], bool)
    for m in alphas_all:
        union |= m
    ys, xs = np.where(union)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    print('bbox:', x0, x1, y0, y1)
    # 目标: 角色高约750px, 底边 y=889, 中心 x=334 (对齐 walk.png)
    scale = 750.0 / (y1 - y0)
    cx_src = (x0 + x1) / 2.0
    target_cx, target_bottom = 334, 889
    pil_frames = []
    for out in out_frames:
        im = Image.fromarray(out, 'RGBA')
        nw, nh = round(720 * scale), round(720 * scale)
        im = im.resize((nw, nh), Image.LANCZOS)
        dx = int(round(target_cx - cx_src * scale))
        dy = int(round(target_bottom - y1 * scale))
        canvas = Image.new('RGBA', (720, 960), (0, 0, 0, 0))
        canvas.paste(im, (dx, dy), im)
        pil_frames.append(canvas)
    dst = os.path.join(VID, 'feed.png')
    pil_frames[0].save(dst, save_all=True, append_images=pil_frames[1:],
                       duration=42, loop=0, disposal=2)
    print('feed.png 保存完成: %d 帧, %.1f MB' % (len(pil_frames), os.path.getsize(dst) / 1e6))
    pil_frames[0].save(os.path.join(ROOT, 'tmp_frames', 'feed_preview0.png'))

# ---------- 2) 食物 JPG -> food_<id>.png ----------
FOODS = [
    ('075Z-b6669ff1', 'cake',      '蛋糕'),
    ('077Z-e951c207', 'burger',    '汉堡'),
    ('079Z-0b7b7c5b', 'nuggets',   '鸡块'),
    ('081Z-c313bb93', 'drumstick', '鸡腿'),
    ('082Z-c89e94b0', 'egg',       '煎蛋'),
    ('084Z-bb95d128', 'cola',      '可乐'),
    ('086Z-37843840', 'milktea',   '奶茶'),
    ('087Z-44977fd6', 'milk',      '牛奶'),
    ('089Z-c20bc3ff', 'sushi',     '寿司'),
    ('090Z-39885bfd', 'fries',     '薯条'),
]
CLIP = r'C:/Users/hxw/.workbuddy/clipboard-images'

def convert_foods():
    sheet_items = []
    for tag, fid, cn in FOODS:
        src = os.path.join(CLIP, 'clipboard-2026-10-12T04-46-41-%s.jpg' % tag)
        im = Image.open(src).convert('RGB')
        a = np.array(im).astype(int)
        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
        cand = (mx > 215) & ((mx - mn) < 18)      # 浅色低饱和 = 棋盘格
        lab, n = ndimage.label(cand)
        border_ids = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
        border_ids = border_ids[border_ids != 0]
        bg = np.isin(lab, border_ids)
        alpha = np.where(bg, 0, 255).astype(np.uint8)
        alpha = np.array(Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(1.0)))
        rgba = np.dstack([a.astype(np.uint8), alpha])
        # 裁剪到内容 + 8% 边距, 缩放到 256x256
        ys, xs = np.where(alpha > 30)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        pad = int(max(x1 - x0, y1 - y0) * 0.08)
        x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
        x1 = min(im.width - 1, x1 + pad); y1 = min(im.height - 1, y1 + pad)
        crop = Image.fromarray(rgba, 'RGBA').crop((x0, y0, x1 + 1, y1 + 1))
        side = max(crop.size)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
        sq = sq.resize((256, 256), Image.LANCZOS)
        dst = os.path.join(VID, 'food_%s.png' % fid)
        sq.save(dst)
        sz = os.path.getsize(dst)
        print('food_%s.png (%s): %.0f KB' % (fid, cn, sz / 1024))
        sheet_items.append((fid, sq))
    # 拼一张检查图
    sheet = Image.new('RGBA', (256 * 5, 256 * 2), (255, 0, 255, 255))
    for i, (_, im) in enumerate(sheet_items):
        sheet.paste(im, ((i % 5) * 256, (i // 5) * 256), im)
    sheet.save(os.path.join(ROOT, 'tmp_frames', 'foods_sheet.png'))
    print('foods_sheet.png 已生成')

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('all', 'mp4'):
        convert_mp4()
    if which in ('all', 'foods'):
        convert_foods()
