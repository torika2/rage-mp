#!/usr/bin/env python3
"""Pack a CodeWalker .ymap into a RAGE:MP map DLC (dlc.rpf) — no CodeWalker/Windows needed.

Builds a byte-valid RPF7 (OPEN/unencrypted) with the standard map layout:
    dlc.rpf/
      setup2.xml, content.xml
      x64/levels/gta5/_citye/maps/custom_maps.rpf/<name>.ymap

Usage:
    python3 build_map_dlc.py <name> <path/to/exported.ymap>
Writes to: client_packages/game_resources/dlcpacks/<name>/dlc.rpf

The .ymap must be a CodeWalker-exported RSC7 resource (standard export). Verified against
the server's existing dlc.rpf packs (same RPF7 format: magic 0x52504637, enc 'OPEN',
dir id 0x7fffff00, resource entries flagged with offset bit-23 + sys/gfx flags).
"""
import struct, zlib, os, math, sys

MAGIC=0x52504637; OPEN=0x4e45504f; DIRID=0x7fffff00
def u24(v): return bytes([v&0xff,(v>>8)&0xff,(v>>16)&0xff])
def raw_deflate(b):
    co=zlib.compressobj(9,zlib.DEFLATED,-15); return co.compress(b)+co.flush()

def build_rpf(entries, files):
    ec=len(entries)
    nblob=b""; noff={}
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

def main():
    if len(sys.argv)!=3:
        print(__doc__); sys.exit(1)
    name, ymap_path = sys.argv[1], sys.argv[2]
    root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /opt/ragemp-srv
    ym=open(ymap_path,'rb').read()
    assert ym[:4]==b'RSC7', "not an RSC7 ymap (re-export from CodeWalker)"
    _,sysF,gfxF=struct.unpack('<III',ym[4:16]); payload=ym[16:]

    dev=f"dlc_{name}"; cs=f"{name}_AUTOGEN"
    setup=f'''<?xml version="1.0" encoding="UTF-8"?>
<SSetupData>
  <deviceName>{dev}</deviceName>
  <datFile>content.xml</datFile>
  <timeStamp>05/30/2020 00:00:00</timeStamp>
  <nameHash>{name}</nameHash>
  <contentChangeSets />
  <contentChangeSetGroups>
    <Item><NameHash>GROUP_STARTUP</NameHash><ContentChangeSets><Item>{cs}</Item></ContentChangeSets></Item>
  </contentChangeSetGroups>
  <startupScript /><scriptCallstackSize value="0" />
  <type>EXTRACONTENT_COMPAT_PACK</type>
  <order value="21" /><minorOrder value="0" /><isLevelPack value="false" />
  <requiredVersion /><subPackCount value="0" />
</SSetupData>'''.encode()
    mp=f"{dev}:/x64/levels/gta5/_citye/maps/custom_maps.rpf"
    content=f'''<?xml version="1.0" encoding="UTF-8"?>
<CDataFileMgr__ContentsOfDataFileXml>
  <disabledFiles /><includedXmlFiles itemType="7" /><includedDataFiles />
  <dataFiles itemType="3">
    <Item><filename>{mp}</filename><fileType>RPF_FILE</fileType>
      <overlay value="false" /><disabled value="true" /><persistent value="false" /></Item>
  </dataFiles>
  <contentChangeSets itemType="6">
    <Item><changeSetName>{cs}</changeSetName><mapChangeSetData /><filesToInvalidate /><filesToDisable />
      <filesToEnable><Item>{mp}</Item></filesToEnable><useCacheLoader value="false" /></Item>
  </contentChangeSets>
  <patchFiles />
</CDataFileMgr__ContentsOfDataFileXml>'''.encode()

    inner=build_rpf(
        [{'type':'dir','name':'','idx':1,'count':1},
         {'type':'res','name':os.path.basename(ymap_path),'fsize':len(payload),'sysFlags':sysF,'gfxFlags':gfxF}],
        [(1,payload)])
    cx,sx,ix=raw_deflate(content),raw_deflate(setup),raw_deflate(inner)
    outer=build_rpf(
        [{'type':'dir','name':'','idx':1,'count':3},
         {'type':'bin','name':'content.xml','fsize':len(cx),'unc':len(content)},
         {'type':'bin','name':'setup2.xml','fsize':len(sx),'unc':len(setup)},
         {'type':'dir','name':'x64','idx':4,'count':1},
         {'type':'dir','name':'levels','idx':5,'count':1},
         {'type':'dir','name':'gta5','idx':6,'count':1},
         {'type':'dir','name':'_citye','idx':7,'count':1},
         {'type':'dir','name':'maps','idx':8,'count':1},
         {'type':'bin','name':'custom_maps.rpf','fsize':len(ix),'unc':len(inner)}],
        [(1,cx),(2,sx),(8,ix)])
    out=os.path.join(root,'client_packages/game_resources/dlcpacks',name)
    os.makedirs(out,exist_ok=True)
    open(os.path.join(out,'dlc.rpf'),'wb').write(outer)
    print(f"wrote {out}/dlc.rpf ({len(outer)} bytes). Restart rageserv + fully relaunch client.")

if __name__=='__main__': main()
