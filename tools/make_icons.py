# 新头像 -> 图标：抠掉棋盘格假透明背景 + 去角落水印字 + 生成 lolo.png/tray.png/lolo.ico
import os
import numpy as np
from PIL import Image
from scipy import ndimage
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import clear_watermark_image, gblur

BASE = r'C:/Users/hxw/Desktop/lolo'
SRC = os.path.join(BASE, '新头像.jpg')
OUTD = os.path.join(BASE, 'assets', 'icon')

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int32)
r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
lum = (r + g + b) / 3
sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
# 棋盘格背景特征：亮 + 低饱和
bglike = (lum > 195) & (sat < 40)

# 从边界洪泛，只清与边界连通的背景（保护肚皮/眼白等内部白色）
h, w = bglike.shape
reach = np.zeros((h, w), bool)
reach[0, :] = bglike[0, :]; reach[-1, :] = bglike[-1, :]
reach[:, 0] |= bglike[:, 0]; reach[:, -1] |= bglike[:, -1]
reach = bglike & ndimage.binary_dilation(ndimage.binary_propagation(reach, mask=bglike), iterations=0) if False else None
# binary_propagation 正确用法：
seed = np.zeros_like(bglike)
seed[0, :] = bglike[0, :]; seed[-1, :] = bglike[-1, :]
seed[:, 0] |= bglike[:, 0]; seed[:, -1] |= bglike[:, -1]
reach = ndimage.binary_propagation(seed, mask=bglike)

alpha = np.where(reach, 0, 255).astype(np.float32)
alpha = gblur(alpha)  # 轻柔边缘
rgba = np.dstack([r, g, b, np.clip(alpha, 0, 255)]).astype(np.uint8)

# 去除与主体不连通的小块（豆包AI生成 水印字等）
lab, num = ndimage.label(rgba[:, :, 3] > 60)
if num > 1:
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, num + 1))
    main = int(np.argmax(sizes)) + 1
    rgba[:, :, 3] = np.where(lab == main, rgba[:, :, 3], 0)

# 角落水印字兜底（若与主体断开则上一步已删；这里再清角落小块）
rgba = clear_watermark_image(rgba, max_comp=3000)

out = Image.fromarray(rgba, 'RGBA')

# 裁掉四周透明边，主体居中放大
bbox = out.getbbox()
if bbox:
    out = out.crop(bbox)
side = max(out.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(out, ((side - out.size[0]) // 2, (side - out.size[1]) // 2))

sq.resize((512, 512), Image.LANCZOS).save(os.path.join(OUTD, 'lolo.png'))
sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUTD, 'tray.png'))
sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUTD, 'lolo.ico'),
                                          sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('icons OK, bbox=', bbox, 'side=', side)
