#!/usr/bin/env python3
"""Pack a RAGE:MP dlc.rpf (OPEN / unencrypted RPF7) on Linux — no CodeWalker needed.

Use for ADD-ON or REPLACE packs whose payload is streaming resources
(.ytd .ydd .ydr .yft .ybn .yft etc). Audio/.rel/.dat packs need extra content.xml
wiring and are out of scope here.

    python3 tools/rpf/pack_dlc.py <packname> <srcdir> <out/dlc.rpf>

- <packname>  becomes the DLC device/name hash (e.g. gcom_ballas_gerald).
- <srcdir>    every *resource* file in it (RSC7 magic) is packed flat into the archive.
- Generates a minimal valid setup2.xml + content.xml (order 50, GROUP_STARTUP).
- OPEN archives are proven to load on this server (demon/npolchar/gcom_ballas_gang
  are all OPEN). Verify the result with:  python3 tools/rpf/rpf.py ls <out/dlc.rpf>

CAVEAT: this builds a structurally-correct archive, but whether the game actually
mounts the DLC and overrides the target ped/asset can only be confirmed in-game.
Deploy, restart rageserv, reconnect, and eyeball it.
"""
import struct, zlib, sys, os, glob

SECTOR, DIR_MARKER, RES_FLAG = 512, 0x7FFFFF, 0x800000

def pad(buf, to=SECTOR):
    if len(buf) % to:
        buf += b"\0" * (to - len(buf) % to)
    return buf

def deflate(raw):
    co = zlib.compressobj(9, zlib.DEFLATED, -15)
    return co.compress(raw) + co.flush()

def setup2_xml(name):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<SSetupData>\n'
            f'  <deviceName>dlc_{name}</deviceName>\n  <datFile>content.xml</datFile>\n'
            f'  <timeStamp>00/00/0000 00:00:00</timeStamp>\n  <nameHash>{name}</nameHash>\n'
            f'  <contentChangeSetGroups>\n    <Item>\n      <NameHash>GROUP_STARTUP</NameHash>\n'
            f'      <ContentChangeSets>\n        <Item>{name}_AUTOGEN</Item>\n'
            f'      </ContentChangeSets>\n    </Item>\n  </contentChangeSetGroups>\n'
            f'  <type>EXTRACONTENT_COMPAT_PACK</type>\n  <order value="50" />\n</SSetupData>\n').encode()

# Which content.xml <fileType> each known vehicle .meta maps to. A folder that contains vehicles.meta
# is treated as an add-on VEHICLE and these metas are wired as dataFiles + enabled in the changeset.
VEHICLE_META_TYPES = {
    "vehicles.meta":       "VEHICLE_METADATA_FILE",
    "carvariations.meta":  "VEHICLE_VARIATION_FILE",
    "carcols.meta":        "CARCOLS_FILE",
    "handling.meta":       "HANDLING_FILE",
    "vehiclelayouts.meta": "VEHICLE_LAYOUTS_FILE",
    "dlctext.meta":        "TEXTFILE_METAFILE",
}

def content_xml(name, metas=()):
    # metas: list of (filename, fileType) wired into dataFiles (flat in the dlc root) + the changeset.
    data_items, enable_items = "", ""
    for fn, ftype in metas:
        persistent = "true" if ftype == "RPF_FILE" else "false"
        data_items += (f'    <Item>\n      <filename>dlc_{name}:/{fn}</filename>\n'
                       f'      <fileType>{ftype}</fileType>\n      <overlay value="false" />\n'
                       f'      <disabled value="true" />\n      <persistent value="{persistent}" />\n    </Item>\n')
        enable_items += f'        <Item>dlc_{name}:/{fn}</Item>\n'
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<CDataFileMgr__ContentsOfDataFileXml>\n'
            f'  <disabledFiles />\n  <includedXmlFiles />\n  <includedDataFiles />\n'
            f'  <dataFiles>\n{data_items}  </dataFiles>\n'
            f'  <contentChangeSets>\n    <Item>\n      <changeSetName>{name}_AUTOGEN</changeSetName>\n'
            f'      <filesToDisable />\n      <filesToEnable>\n{enable_items}      </filesToEnable>\n'
            f'      <txdToLoad />\n      <txdToUnload />\n'
            f'      <residentResources />\n      <unregisterResources />\n    </Item>\n'
            f'  </contentChangeSets>\n  <patchFiles />\n</CDataFileMgr__ContentsOfDataFileXml>\n').encode()

def load_resource(path):
    b = open(path, "rb").read()
    if b[:4] != b"RSC7":
        return None
    _, sysf, gfxf = struct.unpack_from("<III", b, 4)
    body = b[16:]
    zlib.decompress(body, -15)  # sanity: valid raw-deflate
    return body, sysf, gfxf

def main(name, srcdir, out):
    # Collect vehicle metas present in the source folder (flat in the dlc root) so we can wire them.
    metas = []
    for path in sorted(glob.glob(os.path.join(srcdir, "*"))):
        base = os.path.basename(path).lower()
        if os.path.isfile(path) and base in VEHICLE_META_TYPES:
            metas.append((os.path.basename(path), VEHICLE_META_TYPES[base]))
    is_vehicle = any(fn.lower() == "vehicles.meta" for fn, _ in metas)
    wired = metas if is_vehicle else []

    files = [("content.xml", "bin", content_xml(name, wired), None, None),
             ("setup2.xml",  "bin", setup2_xml(name),  None, None)]
    # Include the wired .meta files as plain (bin) entries so content.xml can reference them.
    for fn, _ in wired:
        files.append((fn, "bin", open(os.path.join(srcdir, fn), "rb").read(), None, None))
    wired_names = {fn for fn, _ in wired}
    for path in sorted(glob.glob(os.path.join(srcdir, "*"))):
        if not os.path.isfile(path) or os.path.basename(path) in wired_names:
            continue
        res = load_resource(path)
        if res is None:
            print("skip (not a resource):", os.path.basename(path)); continue
        body, sysf, gfxf = res
        files.append((os.path.basename(path), "res", body, sysf, gfxf))
    if len(files) <= 2:
        sys.exit("no resource files found in " + srcdir)
    if is_vehicle:
        print("vehicle add-on: wired metas ->", ", ".join(f"{fn}={ft}" for fn, ft in wired))

    count = 1 + len(files)
    heap = bytearray(b"\0"); name_off = {}
    for nm, *_ in files:
        name_off[nm] = len(heap); heap += nm.encode() + b"\0"
    while len(heap) % 16:
        heap += b"\0"
    data_start = (16 + count*16 + len(heap) + SECTOR - 1) // SECTOR * SECTOR

    data = bytearray(); layout = []
    for nm, kind, payload, A, B in files:
        block = (data_start + len(data)) // SECTOR
        if kind == "bin":
            stored = deflate(payload); A, B = len(payload), 0
        else:
            stored = payload
        layout.append((kind, len(stored), A, B, block)); data += pad(bytearray(stored))

    toc = bytearray()
    toc += struct.pack("<H", 0) + b"\x00\x00\x00" + struct.pack("<I", DIR_MARKER)[:3] + struct.pack("<II", 1, len(files))
    for (nm, kind, *_), (k, size, A, B, block) in zip(files, layout):
        off = block | (RES_FLAG if kind == "res" else 0)
        toc += struct.pack("<H", name_off[nm]) + struct.pack("<I", size)[:3] + struct.pack("<I", off)[:3] + struct.pack("<II", A, B)

    buf = pad(bytearray(b"7FPR" + struct.pack("<II", count, len(heap)) + b"OPEN" + toc + heap), SECTOR)
    assert len(buf) == data_start
    buf += data
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "wb").write(buf)
    print(f"wrote {out} ({len(buf)} bytes); {count} entries:",
          ", ".join(nm for nm, *_ in files))

if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
