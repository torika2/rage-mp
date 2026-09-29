# Building the rc12b map DLC (CodeWalker, Windows)

The ymap must live inside a `dlc.rpf`. This folder is the *source tree* — build it into
an RPF with CodeWalker, then drop the result at:

    client_packages/game_resources/dlcpacks/rc12b/dlc.rpf

Everything under `dlc.rpf/` here is exactly what the archive must contain:

    dlc.rpf/
      setup2.xml
      content.xml
      x64/levels/gta5/_citye/maps/custom_maps.rpf/
        rc12b_default.ymap

## CodeWalker steps

1. Open **CodeWalker.exe** → menu **Tools → RPF Explorer**.
2. **File → New RPF Archive…** → name it `dlc.rpf`, encryption **OPEN** (unencrypted).
   Save it somewhere on Windows (e.g. Downloads).
3. With `dlc.rpf` open, drag in `setup2.xml` and `content.xml` from this folder
   (or use **Import Raw**). Keep them at the root.
4. Inside `dlc.rpf`, recreate the folders: right-click → New Folder →
   `x64`, then inside it `levels`, then `gta5`, then `_citye`, then `maps`.
5. Inside `maps`, **File → New RPF Archive…** → name it `custom_maps.rpf`, **OPEN**.
6. Open `custom_maps.rpf` and **Import Raw** the file `rc12b_default.ymap`.
7. Close/save. CodeWalker auto-fixes the archive offsets on save.
8. Copy the finished `dlc.rpf` (from step 2) into:
   `client_packages/game_resources/dlcpacks/rc12b/dlc.rpf`

## Then deploy

    sudo systemctl restart rageserv    # in a real terminal

Relaunch the RAGE:MP client and reconnect. The map objects appear at the ymap's
coordinates. Nothing is added to `/veh` — this is world geometry, not a vehicle.

If objects don't show: check `journalctl -u rageserv -f` for load errors, and verify
the `dlc_rc12b:` prefix in content.xml matches `deviceName` in setup2.xml.
