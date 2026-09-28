# Inspecting a `dlc.rpf`

How to find a car's **spawn name**, **liveries**, and **encryption** without OpenIV/Windows.

A `dlc.rpf` is a **RPF v7** archive. Add-on packs are usually **unencrypted** (`enc = "OPEN"`),
which means we can parse them directly. If a pack is AES/NG encrypted you'd need OpenIV on Windows.

## Quick check: is it encrypted?

```bash
python3 - <<'PY'
import struct
d=open('dlc.rpf','rb').read()
magic,entries,namesLen,enc=struct.unpack('<IIII', d[:16])
print("RPF7" if magic==0x52504637 else "not rpf7",
      "| entries",entries,
      "| enc", {0x4e45504f:'OPEN'}.get(enc, hex(enc)))
PY
```

`OPEN` → parseable below. Anything else → encrypted.

## Extract spawn names + livery info

`vehicles.meta` and `carvariations.meta` inside the RPF are deflate-compressed. This parser
walks the RPF v7 table-of-contents and decompresses them:

```bash
python3 - <<'PY'
import struct, zlib, re
data=open('dlc.rpf','rb').read()
_,entryCount,namesLen,enc=struct.unpack('<IIII',data[:16])
toc=data[16:16+entryCount*16]
names=data[16+entryCount*16:16+entryCount*16+namesLen]
def nm(o):
    e=names.find(b'\x00',o); return names[o:e].decode('latin1')
def u24(b): return b[0]|(b[1]<<8)|(b[2]<<16)
files={}
for i in range(entryCount):
    e=toc[i*16:i*16+16]
    if e[4:8]==b'\x00\xff\xff\x7f': continue          # directory entry
    files[nm(struct.unpack('<H',e[:2])[0])] = (u24(e[2:5]), u24(e[5:8])*512)
def grab(off,size):
    raw=data[off:off+size]
    for m in (-15,15):
        try: return zlib.decompress(raw,m)
        except: pass
    return raw
if 'vehicles.meta' in files:
    xml=grab(*files['vehicles.meta']).decode('utf-8','replace')
    print("SPAWN NAMES:", re.findall(r'<modelName>(.*?)</modelName>', xml))
if 'carvariations.meta' in files:
    xml=grab(*files['carvariations.meta']).decode('utf-8','replace')
    flags=re.findall(r'<Item value="(true|false)"', xml)
    print("liveries present:", 'true' in flags, f"({flags.count('true')} of {len(flags)})")
PY
```

- **SPAWN NAMES** = what you type after `/veh`.
- **liveries present: True** → `/livery <n>` works on this car.

## Field notes (RPF v7 layout, for reference)

- Header (16 bytes): `magic("RPF7")`, `entryCount(u32)`, `namesLength(u32)`, `encryption(u32)`.
- Then `entryCount × 16-byte` TOC entries, then the names blob.
- **Directory entry:** bytes[4:8] == `00 FF FF 7F`; bytes[0:4]=name offset, [8:12]=child index, [12:16]=child count.
- **File entry:** `nameOffset(u16)`, `size(u24)`, `offset(u24)×512`, `uncompressedSize(u32)`.
  If stored size < uncompressed size, it's raw-deflate compressed.

## Tools

- List/extract archives (incl. RAR): static 7-Zip binary
  ```bash
  curl -sL -o 7z.tar.xz https://www.7-zip.org/a/7z2301-linux-x64.tar.xz
  tar -xf 7z.tar.xz 7zzs && chmod +x 7zzs
  ./7zzs l <archive>          # list
  ./7zzs x -o<dir> <archive>  # extract
  ```
