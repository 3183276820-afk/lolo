#!/usr/bin/env python3
# 安全缩小 APNG：等比降分辨率，逐帧保留原始延时，APNG 重新存盘。
# 不改动动画速度/功能，仅减少文件体积（用于给便携版 exe 瘦身）。
import sys, os
from PIL import Image

def shrink(inp, outp, scale=2/3):
    im = Image.open(inp)
    if not getattr(im, 'is_animated', False):
        # 单帧：直接缩放
        fr = im.convert('RGBA').resize(
            (max(1, int(im.width*scale)), max(1, int(im.height*scale))), Image.LANCZOS)
        fr.save(outp, optimize=True)
        print(f"{os.path.basename(inp)}: 单帧 {im.size}->{fr.size}")
        return
    frames, durs = [], []
    n = im.n_frames
    w0, h0 = im.size
    tw, th = max(1, int(w0*scale)), max(1, int(h0*scale))
    for i in range(n):
        im.seek(i)
        d = im.info.get('duration')
        durs.append(int(d) if d else 67)
        fr = im.convert('RGBA').resize((tw, th), Image.LANCZOS)
        frames.append(fr)
    # 用首帧的 disposal/loop 信息保存
    frames[0].save(
        outp, save_all=True, append_images=frames[1:],
        duration=durs, loop=0, optimize=True)
    old = os.path.getsize(inp)
    new = os.path.getsize(outp)
    print(f"{os.path.basename(inp)}: {n}帧 {im.size}->{ (tw,th) } "
          f"size {old/1e6:.1f}MB -> {new/1e6:.1f}MB "
          f"(节省 {(1-new/old)*100:.0f}%)")

if __name__ == '__main__':
    inp = sys.argv[1]
    outp = sys.argv[2] if len(sys.argv) > 2 else (os.path.splitext(inp)[0] + '_s.png')
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 2/3
    shrink(inp, outp, scale)
