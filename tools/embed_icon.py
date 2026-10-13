#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 Windows 内核 API 给 exe 注入图标，不依赖 rcedit / winCodeSign / 7za。
通过 ctypes 调用 kernel32.dll 的 BeginUpdateResourceW / UpdateResourceW /
EndUpdateResourceW，把 .ico 拆成 RT_ICON + RT_GROUP_ICON 资源写回 PE。
"""
import ctypes
import struct
import sys

from ctypes import wintypes

kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

RT_ICON = 3
RT_GROUP_ICON = 14


def _setup_prototypes():
    kernel32.BeginUpdateResourceW.restype = wintypes.HANDLE
    kernel32.BeginUpdateResourceW.argtypes = [wintypes.LPCWSTR, wintypes.BOOL]

    kernel32.UpdateResourceW.restype = wintypes.BOOL
    kernel32.UpdateResourceW.argtypes = [
        wintypes.HANDLE,
        ctypes.c_void_p,  # lpType (MAKEINTRESOURCE)
        ctypes.c_void_p,  # lpName (MAKEINTRESOURCE)
        wintypes.WORD,    # wLanguage
        ctypes.c_void_p,  # lpData
        wintypes.DWORD,   # cb
    ]

    kernel32.EndUpdateResourceW.restype = wintypes.BOOL
    kernel32.EndUpdateResourceW.argtypes = [wintypes.HANDLE, wintypes.BOOL]

    kernel32.LoadLibraryExW.restype = wintypes.HANDLE
    kernel32.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]

    kernel32.FindResourceW.restype = wintypes.HANDLE
    kernel32.FindResourceW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p]

    kernel32.LoadResource.restype = wintypes.HANDLE
    kernel32.LoadResource.argtypes = [wintypes.HANDLE, wintypes.HANDLE]

    kernel32.LockResource.restype = ctypes.c_void_p
    kernel32.LockResource.argtypes = [wintypes.HANDLE]

    kernel32.SizeofResource.restype = wintypes.DWORD
    kernel32.SizeofResource.argtypes = [wintypes.HANDLE, wintypes.HANDLE]

    kernel32.FreeLibrary.argtypes = [wintypes.HANDLE]


_setup_prototypes()


def MAKEINTRESOURCE(i):
    return ctypes.c_void_p(i)


def parse_ico(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:2] != b"\x00\x00":
        raise SystemExit("不是合法的 ICON 文件: " + path)
    reserved, itype, count = struct.unpack("<HHH", data[:6])
    if itype != 1:
        raise SystemExit("不是图标类型: " + path)
    entries = []
    off = 6
    for _ in range(count):
        b_width, b_height, b_color, b_res, planes, bit_count, bytes_in_res, image_off = (
            struct.unpack("<BBBBHHII", data[off : off + 16])
        )
        img = data[image_off : image_off + bytes_in_res]
        entries.append((b_width, b_height, b_color, b_res, planes, bit_count, bytes_in_res, img))
        off += 16
    return entries


def build_group_icon(entries):
    g = bytearray()
    g += struct.pack("<HHH", 0, 1, len(entries))  # reserved, type=1(icon), count
    for i, (w, h, cc, res, planes, bc, bir, _img) in enumerate(entries):
        # GRPICONDIRENTRY: 14 bytes (dwBytesInRes 是 DWORD=4，wID 替换原 imageOffset)
        g += struct.pack("<BBBBHHIH", w, h, cc, res, planes, bc, bir, i + 1)
    return bytes(g)


def embed(exe, ico):
    entries = parse_ico(ico)
    group = build_group_icon(entries)

    h = kernel32.BeginUpdateResourceW(exe, False)
    if not h:
        raise ctypes.WinError(ctypes.get_last_error())

    try:
        for i, (_w, _h, _cc, _res, _planes, _bc, _bir, img) in enumerate(entries):
            buf = ctypes.create_string_buffer(img, len(img))
            ok = kernel32.UpdateResourceW(
                h, MAKEINTRESOURCE(RT_ICON), MAKEINTRESOURCE(i + 1), 0, buf, len(img)
            )
            if not ok:
                raise ctypes.WinError(ctypes.get_last_error())

        gbuf = ctypes.create_string_buffer(group, len(group))
        ok = kernel32.UpdateResourceW(
            h, MAKEINTRESOURCE(RT_GROUP_ICON), MAKEINTRESOURCE(1), 0, gbuf, len(group)
        )
        if not ok:
            raise ctypes.WinError(ctypes.get_last_error())
    except Exception:
        # 出错则放弃本次修改，避免半成品
        kernel32.EndUpdateResourceW(h, True)
        raise

    ok = kernel32.EndUpdateResourceW(h, False)
    if not ok:
        raise ctypes.WinError(ctypes.get_last_error())

    # 读回校验
    LOAD_LIBRARY_AS_DATAFILE = 0x2
    LOAD_LIBRARY_AS_IMAGE_RESOURCE = 0x20
    hmod = kernel32.LoadLibraryExW(
        exe, None, LOAD_LIBRARY_AS_DATAFILE | LOAD_LIBRARY_AS_IMAGE_RESOURCE
    )
    if not hmod:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        # FindResourceW(hModule, lpName, lpType) —— 注意第二参是名字、第三参是类型
        hr = kernel32.FindResourceW(hmod, MAKEINTRESOURCE(1), MAKEINTRESOURCE(RT_GROUP_ICON))
        if not hr:
            kernel32.FreeLibrary(hmod)
            raise SystemExit("校验失败: 找不到刚写入的 RT_GROUP_ICON")
        size = kernel32.SizeofResource(hmod, hr)
        if size != len(group):
            kernel32.FreeLibrary(hmod)
            raise SystemExit("校验失败: 资源大小不符 (%d != %d)" % (size, len(group)))
    finally:
        kernel32.FreeLibrary(hmod)

    print("OK 图标已写入并校验通过: %s  (图标帧数=%d)" % (exe, len(entries)))


def main():
    if len(sys.argv) != 3:
        print("用法: python embed_icon.py <exe> <ico>")
        sys.exit(2)
    embed(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    main()
