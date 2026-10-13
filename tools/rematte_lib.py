# 抠像核心库：绿幕抠像（保留黑眼/黑纹/深色）+ 时间一致性去水印（不误伤 lolo 白脸）
import os, glob, shutil, subprocess
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'  # 历史遗留常量，现在改用 cv2
FPS = 15
DUR = round(1000 / FPS)  # 67ms/帧

def extract(v, d, fps=FPS):
    """用 OpenCV 抽帧（自带的视频解码器，无需外部 ffmpeg）。
    按目标 fps 均匀采样，帧文件以源帧序号命名，避免重复。"""
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    import cv2
    cap = cv2.VideoCapture(v)
    if not cap.isOpened():
        raise RuntimeError('无法打开视频: ' + v)
    src = cap.get(cv2.CAP_PROP_FPS) or 30.0
    src = src if src > 0 else 30.0
    i, last, out = 0, -1, []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        target = int(round(i / src * fps))
        if target != last:
            rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
            p = os.path.join(d, f'f{i:05d}.png')
            Image.fromarray(rgb).save(p)
            out.append(p)
            last = target
        i += 1
    cap.release()
    return sorted(out)

def dilate(b, n=1):
    for _ in range(n):
        b = b | np.roll(b, 1, 0) | np.roll(b, -1, 0) | np.roll(b, 1, 1) | np.roll(b, -1, 1)
    return b

def gblur(a):
    k = np.array([1, 2, 1], float) / 4
    a = np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 0, a)
    a = np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 1, a)
    return a

def bg_ref_of(rgb):
    """取角落绿色中位数作为背景基准（每帧自适应）"""
    g = rgb[:, :, 1].astype(np.int32)
    r = rgb[:, :, 0].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)
    greenness = g - np.maximum(r, b)
    corners = np.concatenate([greenness[:40, :40].ravel(), greenness[:40, -40:].ravel(),
                              greenness[-40:, :40].ravel(), greenness[-40:, -40:].ravel()])
    return float(np.median(corners))

def matte_core(rgb):
    """绿幕抠像：保留黑眼/黑纹/深色爪垫，做溢色去除与边缘柔化。不含水印处理。
    v2 修复：
    - 地板规则：地板绿比墙暗，用更低阈值整体抠掉地板上残留的暗绿碎点与投影
      （黑色爪垫 greenness≈0 不受影响）；
    - 闭运算封缝：白毛阴影缝/肚皮阴影洞与外界连通的细缝先封住，再整体填洞，
      书影投在白肚皮上被抠出的洞（~1300px）也能填回；
    - 孤立噪点清除：与主体不连通的小前景（右下角水印残渣等）整块删除。"""
    from scipy import ndimage
    r = rgb[:, :, 0].astype(np.int32); g = rgb[:, :, 1].astype(np.int32); b = rgb[:, :, 2].astype(np.int32)
    greenness = g - np.maximum(r, b)
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    bg_ref = bg_ref_of(rgb)
    bg = greenness > bg_ref * 0.5
    bg = dilate(bg, 2)
    # 保护低饱和像素（白脸/肤色/浅色绒毛）：膨胀只允许吃高饱和的纯绿背景，
    # 不能把贴着绿幕的白色脸边缘当成背景抠穿（睡觉趴地时尤甚）
    bg = bg & (sat > 25)
    # 地板规则：地板绿比背景墙暗（greenness/SAT 都偏低），墙阈值抠不干净，
    # 残留的暗绿碎点+投影就成了玩偶脚边的"黑色像素点"。放宽阈值整体抠掉。
    # 玩偶深色部分（黑眼/黑爪垫/深棕花纹）greenness≤0，不会被误伤。
    h = rgb.shape[0]
    ys = np.arange(h, dtype=np.int32).reshape(-1, 1)
    floor_row = ys > int(h * 0.70)
    bg = bg | (floor_row & (greenness > 8) & (sat > 14))
    fg = ~bg
    # 闭运算：白毛阴影缝、肚皮阴影区与外界连通的细缝先封住
    fg = ndimage.binary_closing(fg, structure=np.ones((5, 5), bool))
    # 填洞：绿幕反光渗进白脸内部形成的透明洞、书影在白肚皮上抠出的洞，
    # 只要被身体包围就整体填回（坐姿玩偶没有真实"封闭窗"，上限放宽到 8000px 防意外）
    filled = ndimage.binary_fill_holes(fg)
    holes = filled & ~fg
    lab, num = ndimage.label(holes)
    if num:
        max_hole = 8000
        big = np.zeros_like(fg)
        for k in range(1, num + 1):
            m = lab == k
            if m.sum() > max_hole:
                big |= m
        fg = filled & ~big
    # 孤立噪点：不挨着主体的前景碎块（右下角"豆包AI"水印残渣、绿幕碎点）整块删除
    lab, num = ndimage.label(fg)
    if num > 1:
        sizes = ndimage.sum(fg, lab, range(1, num + 1))
        main = int(np.argmax(sizes)) + 1
        mainm = lab == main
        near = mainm
        for _ in range(8):
            near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
        for k in range(1, num + 1):
            if k == main:
                continue
            m = lab == k
            if m.sum() < 5000 and not (m & near).any():
                fg &= ~m
    spill = (greenness > 0) & fg
    # 地面阴影细条清除：接触地面的动画里，lolo 在地板上的投影是"深色近中性"像素
    # （lum<110、greenness≈0、低饱和），既不够绿过不了墙/地板规则，也不像爪垫那样偏暖，
    # 残留为贴在爪子轮廓底部的横向细条（两爪之间最明显）。真实深色部件（黑爪垫）
    # 竖向厚度大（~100px），用竖向形态学开运算区分：细条（<41px 高）删除，厚块保留。
    lum = np.maximum(np.maximum(r, g), b)
    dark = fg & (lum < 110) & (greenness < 8) & (sat < 40) & floor_row
    if dark.any():
        thick = ndimage.binary_opening(dark, structure=np.ones((41, 1), bool))
        # 追加"下方 12px 内是背景"约束：地面阴影贴着轮廓底边（下方就是地板绿），
        # 而看书动画里书的深色封底位于身体内部（下方是白肚皮），不能误删
        bgm = ~fg
        bg_below = np.zeros_like(bgm)
        for dy in range(1, 13):
            bg_below[:-dy] |= bgm[dy:]
        fg &= ~(dark & ~thick & bg_below)
    g2 = np.where(spill, np.maximum(r, b), g)
    alpha = gblur(fg.astype(np.float32) * 255)
    rgba = np.dstack([r, g2, b, np.clip(alpha, 0, 255)]).astype(np.uint8)
    return rgba

# ---------- 时间一致性去水印（视频用） ----------
def _corner_zones(h, w, mh=100, mw=240):
    # 注意：区域不能开太大！之前 160x420 时，read 里静止的白肚皮落在右下角区域内，
    # 被当成"静态水印"整块抠掉（白肚皮被扣掉的真正元凶）。水印字只在画面极端角落。
    return [(0, 0, mh, mw), (0, w - mw, mh, w), (h - mh, 0, h, mw), (h - mh, w - mw, h, w)]

def _candidate_in_zone(reg):
    """水印候选：低绿、比该角背景亮、低饱和（豆包浅色水印字特征）"""
    r = reg[:, :, 0].astype(np.int32); g = reg[:, :, 1].astype(np.int32); b = reg[:, :, 2].astype(np.int32)
    greenness = g - np.maximum(r, b)
    lum = (r + g + b) / 3
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    bgpix = greenness > 12
    bg_lum = lum[bgpix].mean() if bgpix.sum() else lum.mean()
    return (greenness < 12) & (lum > bg_lum + 20) & (sat < 80)

def detect_static_watermark(files, thr=0.6, max_comp=6000):
    """跨帧检测角落里"每帧几乎都在同一位置"的静态水印。
    lolo 的白脸是动态的、且通常是大块连通域 -> 自然被过滤。"""
    im0 = np.asarray(Image.open(files[0]).convert('RGB'))
    h, w = im0.shape[:2]
    zones = _corner_zones(h, w)
    counts = [np.zeros((y1 - y0, x1 - x0), np.int32) for (y0, x0, y1, x1) in zones]
    n = 0
    for f in files:
        im = np.asarray(Image.open(f).convert('RGB')).astype(np.int32)
        for zi, (y0, x0, y1, x1) in enumerate(zones):
            cand = _candidate_in_zone(im[y0:y1, x0:x1])
            counts[zi] += cand.astype(np.int32)
        n += 1
    # 静态掩码：出现在 >= thr 比例的帧里
    static = [c >= int(round(thr * n)) for c in counts]
    # 连通块过滤：水印字是小块；大块（lolo 白脸残留）一律保留
    out = []
    from scipy import ndimage
    for s in static:
        lab, num = ndimage.label(s)
        keep = np.zeros_like(s)
        for k in range(1, num + 1):
            if (lab == k).sum() <= max_comp:
                keep |= (lab == k)
        out.append(keep)
    return zones, out

def apply_static_watermark(rgba, zones, static_masks):
    for (y0, x0, y1, x1), sm in zip(zones, static_masks):
        rgba[y0:y1, x0:x1, 3] = np.where(sm, 0, rgba[y0:y1, x0:x1, 3])
    return rgba

# ---------- 图用去水印（头像静止图用：连通块限制） ----------
def clear_watermark_image(rgba, mh=160, mw=420, max_comp=4000):
    """静止头像：只清角落里的小连通块（水印字），保护主体白脸。"""
    h, w, _ = rgba.shape
    from scipy import ndimage
    zones = _corner_zones(h, w, mh, mw)
    for (y0, x0, y1, x1) in zones:
        reg = rgba[y0:y1, x0:x1]
        cand = _candidate_in_zone(reg)
        lab, num = ndimage.label(cand)
        for k in range(1, num + 1):
            if (lab == k).sum() <= max_comp:
                reg[:, :, 3] = np.where(lab == k, 0, reg[:, :, 3])
        rgba[y0:y1, x0:x1] = reg
    return rgba
