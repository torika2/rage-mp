#!/usr/bin/env python3
"""Rebuild the pillbox/rc12b map DLC with CONTENTS_DLC_MAP_DATA map-streaming wiring,
modelled on the only working map pack on this server (gcom_ballas_gang).

Outer dlc.rpf:
  setup2.xml   (EXTRACONTENT_LEVEL_PACK, isLevelPack=true, order 2,
                groups GROUP_EARLY_ON / GROUP_UPDATE_STREAMING / GROUP_UPDATE_TEXT)
  content.xml  (custom_maps.rpf declared TWICE: plain RPF_FILE + CONTENTS_DLC_MAP_DATA,
                streaming changeset enables it)
  x64/levels/gta5/_citye/maps/custom_maps.rpf/<ymap>

Usage: build_pillbox.py <name> <ymap_rsc7> <out_dlc.rpf> [manifest.ymf]
If a manifest path is given it is packed (bin) next to the ymap inside custom_maps.rpf
and declared as CONTENTS_DLC_MANIFEST (fwMapDataStore registration).
"""
import struct, zlib, os, math, sys

MAGIC=0x52504637; OPEN=0x4e45504f; DIRID=0x7fffff00
def u24(v): return bytes([v&0xff,(v>>8)&0xff,(v>>16)&0xff])
def deflate(b):
    co=zlib.compressobj(9,zlib.DEFLATED,-15); return co.compress(b)+co.flush()

def build_rpf(entries, files):
    ec=len(entries); nblob=b""; noff={}
    for e in entries:
        n=e['name']
        if n not in noff: noff[n]=len(nblob); nblob+=n.encode('latin1')+b'\x00'
    first=math.ceil((16+ec*16+len(nblob))/512)
    body=b""; place={}; cur=first*512
    for idx,data in files:
        place[idx]=(cur//512,len(data)); pad=data+b'\x00'*((-len(data))%512)
        body+=pad; cur+=len(pad)
    toc=b""
    for i,e in enumerate(entries):
        if e['type']=='dir':
            toc+=struct.pack('<IIII',noff[e['name']],DIRID,e['idx'],e['count'])
        elif e['type']=='bin':
            sec,_=place[i]
            toc+=struct.pack('<H',noff[e['name']])+u24(e['fsize'])+u24(sec)+struct.pack('<II',e['unc'],0)
        elif e['type']=='res':
            sec,_=place[i]
            toc+=struct.pack('<H',noff[e['name']])+u24(e['fsize'])+u24(sec|0x800000)+struct.pack('<II',e['sysFlags'],e['gfxFlags'])
    head=struct.pack('<IIII',MAGIC,ec,len(nblob),OPEN)+toc+nblob
    head+=b'\x00'*(first*512-len(head))
    return head+body

def load_rsc7(path):
    """Return (basename, payload_after_16byte_header, sysFlags, gfxFlags) for an RSC7 file."""
    raw=open(path,'rb').read()
    assert raw[:4]==b'RSC7', f"{path}: not RSC7"
    _,sysF,gfxF=struct.unpack('<III',raw[4:16])
    return os.path.basename(path), raw[16:], sysF, gfxF

def main():
    # Positional: <name> <ymap_rsc7> <out_dlc.rpf> [manifest.ymf]
    # Flags:      --ytyp <ytyp_rsc7>   --manifest <manifest.ymf>   --flat
    # --flat mirrors the known-working gcom_ballas_gang layout: the inner archive is a FLAT
    # 'x64/replacement.rpf' stored UNCOMPRESSED in the outer (vs the default nested, deflated
    # 'x64/levels/gta5/_citye/maps/custom_maps.rpf'). Per-file compression inside is unchanged.
    pos=[]; ytyp_path=None; manifest_path=None; flat=False
    args=sys.argv[1:]; i=0
    while i<len(args):
        a=args[i]
        if a=='--ytyp': ytyp_path=args[i+1]; i+=2
        elif a=='--manifest': manifest_path=args[i+1]; i+=2
        elif a=='--flat': flat=True; i+=1
        else: pos.append(a); i+=1
    name, ymap_path, out = pos[0], pos[1], pos[2]
    if manifest_path is None and len(pos)>3: manifest_path=pos[3]  # legacy 4th positional
    ymap_name, payload, sysF, gfxF = load_rsc7(ymap_path)

    dev=f"dlc_{name}"
    cs_init=f"CCS_{name}_SP_NG_INIT"
    cs_strm=f"CCS_{name}_SP_NG_STREAMING"
    cs_map =f"CCS_{name}_SP_NG_STREAMING_MAP"
    cs_text=f"CCS_{name}_SP_NG_TEXT"

    setup=f'''<?xml version="1.0" encoding="utf-8"?>
<SSetupData>
	<deviceName>{dev}</deviceName>
	<datFile>content.xml</datFile>
	<timeStamp>05/30/2020 00:00:00</timeStamp>
	<nameHash>{name}</nameHash>
	<contentChangeSets />
	<contentChangeSetGroups>
		<Item>
			<NameHash>GROUP_EARLY_ON</NameHash>
			<ContentChangeSets>
				<Item>{cs_init}</Item>
			</ContentChangeSets>
		</Item>
		<Item>
			<NameHash>GROUP_UPDATE_STREAMING</NameHash>
			<ContentChangeSets>
				<Item>{cs_strm}</Item>
				<Item>{cs_map}</Item>
			</ContentChangeSets>
		</Item>
		<Item>
			<NameHash>GROUP_UPDATE_TEXT</NameHash>
			<ContentChangeSets>
				<Item>{cs_text}</Item>
			</ContentChangeSets>
		</Item>
	</contentChangeSetGroups>
	<startupScript />
	<scriptCallstackSize value="0" />
	<type>EXTRACONTENT_LEVEL_PACK</type>
	<order value="2" />
	<minorOrder value="0" />
	<isLevelPack value="true" />
	<dependencyPackHash />
	<requiredVersion />
	<subPackCount value="0" />
</SSetupData>'''.encode()

    inner_name = "replacement.rpf" if flat else "custom_maps.rpf"
    inner_relpath = inner_name if flat else f"levels/gta5/_citye/maps/{inner_name}"
    mp=f"{dev}:/%PLATFORM%/{inner_relpath}"
    content=f'''<?xml version="1.0" encoding="utf-8"?>
<CDataFileMgr__ContentsOfDataFileXml>
	<disabledFiles />
	<includedXmlFiles />
	<includedDataFiles />
	<dataFiles>
		<Item>
			<filename>{mp}</filename>
			<fileType>RPF_FILE</fileType>
			<overlay value="false" />
			<disabled value="false" />
			<persistent value="false" />
		</Item>
		<Item>
			<filename>{mp}</filename>
			<fileType>RPF_FILE</fileType>
			<overlay value="false" />
			<disabled value="false" />
			<persistent value="false" />
			<contents>CONTENTS_DLC_MAP_DATA</contents>
		</Item>
	</dataFiles>
	<contentChangeSets>
		<Item>
			<changeSetName>{cs_map}</changeSetName>
			<filesToEnable>
				<Item>{mp}</Item>
			</filesToEnable>
			<executionConditions>
				<activeChangesetConditions>
				</activeChangesetConditions>
				<genericConditions>$level=MO_JIM_L11</genericConditions>
			</executionConditions>
		</Item>
	</contentChangeSets>
	<patchFiles />
</CDataFileMgr__ContentsOfDataFileXml>'''.encode()

    # inner custom_maps.rpf: ymap (+ optional ytyp, + optional manifest).
    # Entry order: _manifest.ymf (if any), then ytyp (if any), then the ymap.
    ents=[None]; files=[]  # ents[0] = root dir, filled in below
    if manifest_path:
        man=open(manifest_path,'rb').read()
        ents.append({'type':'bin','name':'_manifest.ymf','fsize':len(deflate(man)),'unc':len(man)})
        files.append((len(ents)-1,deflate(man)))
    if ytyp_path:
        ytyp_name, ytyp_payload, ytyp_sysF, ytyp_gfxF = load_rsc7(ytyp_path)
        ents.append({'type':'res','name':ytyp_name,'fsize':len(ytyp_payload),'sysFlags':ytyp_sysF,'gfxFlags':ytyp_gfxF})
        files.append((len(ents)-1,ytyp_payload))
    ents.append({'type':'res','name':ymap_name,'fsize':len(payload),'sysFlags':sysF,'gfxFlags':gfxF})
    files.append((len(ents)-1,payload))
    ents[0]={'type':'dir','name':'','idx':1,'count':len(ents)-1}
    inner=build_rpf(ents, files)

    cx,sx=deflate(content),deflate(setup)
    if flat:
        # Mirror Ballas: inner archive stored UNCOMPRESSED (TOC fsize=0 => read 'unc' bytes raw),
        # as a flat 'x64/replacement.rpf'.
        outer=build_rpf(
            [{'type':'dir','name':'','idx':1,'count':3},
             {'type':'bin','name':'content.xml','fsize':len(cx),'unc':len(content)},
             {'type':'bin','name':'setup2.xml','fsize':len(sx),'unc':len(setup)},
             {'type':'dir','name':'x64','idx':4,'count':1},
             {'type':'bin','name':inner_name,'fsize':0,'unc':len(inner)}],
            [(1,cx),(2,sx),(4,inner)])
    else:
        ix=deflate(inner)
        outer=build_rpf(
            [{'type':'dir','name':'','idx':1,'count':3},
             {'type':'bin','name':'content.xml','fsize':len(cx),'unc':len(content)},
             {'type':'bin','name':'setup2.xml','fsize':len(sx),'unc':len(setup)},
             {'type':'dir','name':'x64','idx':4,'count':1},
             {'type':'dir','name':'levels','idx':5,'count':1},
             {'type':'dir','name':'gta5','idx':6,'count':1},
             {'type':'dir','name':'_citye','idx':7,'count':1},
             {'type':'dir','name':'maps','idx':8,'count':1},
             {'type':'bin','name':inner_name,'fsize':len(ix),'unc':len(inner)}],
            [(1,cx),(2,sx),(8,ix)])
    os.makedirs(os.path.dirname(os.path.abspath(out)),exist_ok=True)
    open(out,'wb').write(outer)
    print(f"wrote {out} ({len(outer)} bytes)  layout={'flat x64/replacement.rpf' if flat else 'nested custom_maps.rpf'}  ymap={ymap_name}  ytyp={'yes' if ytyp_path else 'NO'}  manifest={'yes' if manifest_path else 'NO'}")

if __name__=='__main__': main()
