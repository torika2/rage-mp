#!/usr/bin/env python3
"""Minimal RPF7 (OPEN/unencrypted) reader + writer for GTA V dlc.rpf files.

Format reverse-engineered from working OPEN archives on this server:
  Header(16): b"7FPR" | u32 EntryCount | u32 NamesLength | b"OPEN"
  Entry(16):
    u16 NameOffset
    u24 FileSize            (on-disk size; 0 => stored uncompressed)
    u24 FileOffset+flag      (>>? : low 23 bits = block index *512; bit 0x800000 => RESOURCE)
    u32 A  (dir: EntriesIndex | bin: UncompressedSize | res: SystemFlags)
    u32 B  (dir: EntriesCount | bin: encryption=0     | res: GraphicsFlags)
    Directory marker: FileOffset field (3 bytes) == 0x7FFFFF  (bytes ff ff 7f)
All multi-byte ints little-endian. Data sectors are 512-byte aligned.
"""
import struct, zlib, sys

SECTOR = 512
DIR_MARKER = 0x7FFFFF
RES_FLAG = 0x800000

def u24(b):   # 3 little-endian bytes -> int
    return b[0] | (b[1] << 8) | (b[2] << 16)

def read(path):
    data = open(path, "rb").read()
    magic, count, nameslen = data[0:4], struct.unpack_from("<I", data, 4)[0], struct.unpack_from("<I", data, 8)[0]
    enc = data[12:16]
    assert magic == b"7FPR", magic
    toc_off = 16
    names_off = toc_off + count * 16
    names = data[names_off:names_off + nameslen]
    def name(o):
        end = names.index(b"\0", o)
        return names[o:end].decode("latin-1")
    entries = []
    for i in range(count):
        e = data[toc_off + i*16: toc_off + i*16 + 16]
        nameoff = struct.unpack_from("<H", e, 0)[0]
        size = u24(e[2:5])
        offfield = u24(e[5:8])
        a = struct.unpack_from("<I", e, 8)[0]
        b = struct.unpack_from("<I", e, 12)[0]
        if offfield == DIR_MARKER:
            entries.append(("dir", name(nameoff) if nameoff else "", a, b))
        else:
            is_res = bool(offfield & RES_FLAG)
            blk = offfield & ~RES_FLAG
            off = blk * SECTOR
            entries.append(("res" if is_res else "bin", name(nameoff), size, off, a, b))
    return data, enc, entries

def extract(path, want):
    data, enc, entries = read(path)
    for e in entries:
        if e[0] in ("res", "bin") and e[1] == want:
            kind, nm, size, off, a, b = e
            if kind == "bin":
                raw = data[off: off + (size if size else a)]
                if size and size != a:  # deflate-compressed
                    raw = zlib.decompress(raw, -15)
                return raw
            else:
                body = data[off: off + size]  # compressed resource body (no RSC7 header)
                return body, a, b  # sysflags, gfxflags
    return None

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "ls":
        data, enc, entries = read(sys.argv[2])
        print("enc", enc, "entries", len(entries))
        for e in entries:
            print(e[:4] if e[0] != "dir" else e)
    elif cmd == "cat":
        out = extract(sys.argv[2], sys.argv[3])
        if isinstance(out, tuple):
            print("(resource) body bytes:", len(out[0]), "sys %#x gfx %#x" % (out[1], out[2]))
        else:
            sys.stdout.buffer.write(out)
