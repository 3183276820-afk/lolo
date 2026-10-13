#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 exe 提取第 1 个图标，保存为 PNG，便于肉眼确认图标内容。"""
import ctypes
import struct
from ctypes import wintypes

user32 = ctypes.WinDLL("user32", use_last_error=True)
shell32 = ctypes.WinDLL("shell32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)

LPHANDLE = ctypes.POINTER(wintypes.HANDLE)


class ICONINFO(ctypes.Structure):
    _fields_ = [
        ("fIcon", wintypes.BOOL),
        ("xHotspot", wintypes.DWORD),
        ("yHotspot", wintypes.DWORD),
        ("hbmMask", wintypes.HANDLE),
        ("hbmColor", wintypes.HANDLE),
    ]


class BITMAP(ctypes.Structure):
    _fields_ = [
        ("bmType", ctypes.c_long),
        ("bmWidth", ctypes.c_long),
        ("bmHeight", ctypes.c_long),
        ("bmWidthBytes", ctypes.c_long),
        ("bmPlanes", ctypes.c_short),
        ("bmBitsPixel", ctypes.c_short),
        ("bmBits", ctypes.c_void_p),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", ctypes.c_long),
        ("biHeight", ctypes.c_long),
        ("biPlanes", ctypes.c_short),
        ("biBitCount", ctypes.c_short),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", ctypes.c_long),
        ("biYPelsPerMeter", ctypes.c_long),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


shell32.ExtractIconExW.restype = ctypes.c_int
shell32.ExtractIconExW.argtypes = [wintypes.LPCWSTR, ctypes.c_int, LPHANDLE, LPHANDLE, ctypes.c_uint]
user32.GetIconInfo.restype = wintypes.BOOL
user32.GetIconInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(ICONINFO)]
user32.DestroyIcon.argtypes = [wintypes.HANDLE]

gdi32.GetObjectW.restype = ctypes.c_int
gdi32.GetObjectW.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p]
gdi32.CreateCompatibleDC.restype = wintypes.HANDLE
gdi32.CreateCompatibleDC.argtypes = [wintypes.HANDLE]
gdi32.CreateDIBSection.restype = wintypes.HANDLE
gdi32.CreateDIBSection.argtypes = [
    wintypes.HANDLE, ctypes.c_void_p, wintypes.UINT, ctypes.POINTER(wintypes.LPVOID), ctypes.c_void_p, wintypes.DWORD
]
gdi32.GetDIBits.restype = ctypes.c_int
gdi32.GetDIBits.argtypes = [
    wintypes.HANDLE, wintypes.HANDLE, wintypes.UINT, wintypes.UINT, wintypes.LPVOID, ctypes.c_void_p, wintypes.UINT
]
gdi32.SelectObject.restype = wintypes.HANDLE
gdi32.SelectObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
gdi32.DeleteObject.argtypes = [wintypes.HANDLE]
gdi32.DeleteDC.argtypes = [wintypes.HANDLE]

DIB_RGB_COLORS = 0


def extract(exe, out_png):
    hl = wintypes.HANDLE()
    hs = wintypes.HANDLE()
    cnt = shell32.ExtractIconExW(exe, 0, ctypes.byref(hl), ctypes.byref(hs), 1)
    if cnt < 1 or not hl.value:
        raise SystemExit("没有图标可提取: " + exe)
    hicon = hl.value
    ii = ICONINFO()
    if not user32.GetIconInfo(hicon, ctypes.byref(ii)):
        raise ctypes.WinError(ctypes.get_last_error())
    hbm = ii.hbmColor
    if not hbm:
        hbm = ii.hbmMask
    bm = BITMAP()
    gdi32.GetObjectW(hbm, ctypes.sizeof(BITMAP), ctypes.byref(bm))
    w, h = bm.bmWidth, abs(bm.bmHeight)
    bpp = bm.bmBitsPixel or 32
    print("图标尺寸: %dx%d, bpp=%d" % (w, h, bpp))

    hdc = gdi32.CreateCompatibleDC(None)
    bi = BITMAPINFOHEADER()
    bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.biWidth = w
    bi.biHeight = -h  # top-down
    bi.biPlanes = 1
    bi.biBitCount = 32
    bi.biCompression = 0
    pv = wintypes.LPVOID()
    hbmp = gdi32.CreateDIBSection(hdc, ctypes.byref(bi), DIB_RGB_COLORS, ctypes.byref(pv), None, 0)
    gdi32.SelectObject(hdc, hbmp)
    # 复制颜色位图数据
    gdi32.GetDIBits(hdc, hbm, 0, h, pv, ctypes.byref(bi), DIB_RGB_COLORS)
    buf = ctypes.string_at(pv, w * h * 4)
    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc)
    gdi32.DeleteObject(ii.hbmColor)
    gdi32.DeleteObject(ii.hbmMask)
    user32.DestroyIcon(hicon)

    # buf: BGRA, top-down -> 转成 RGBA 给 PIL
    import struct as _st
    pixels = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 4
            b, g, r, a = buf[i], buf[i + 1], buf[i + 2], buf[i + 3]
            j = i
            pixels[j] = r
            pixels[j + 1] = g
            pixels[j + 2] = b
            pixels[j + 3] = a

    # 写 PNG (依赖 PIL)
    from PIL import Image
    img = Image.frombytes("RGBA", (w, h), bytes(pixels))
    img.save(out_png)
    print("已保存:", out_png)


if __name__ == "__main__":
    import sys
    extract(sys.argv[1], sys.argv[2])
