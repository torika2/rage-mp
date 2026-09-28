# Adding Add-On Vehicle Mods

This is the full, correct process for adding a custom add-on car to the server.
Follow every step — most "it spawns a default car" problems are a skipped step here.

## TL;DR

```
client_packages/game_resources/dlcpacks/<INTERNAL_NAME>/dlc.rpf
```

- `<INTERNAL_NAME>` **must** match the mod's own DLC name.
- Restart server → **fully relaunch** GTA client → reconnect → `/veh <spawnname>`.

---

## Step 1 — Get the right `dlc.rpf` out of the download

Mods come as `.rar`/`.zip`, often with several builds. Extract and pick correctly:

- If it has **`Legacy/`** and **`Enhanced/`** folders → use **`Legacy/.../dlc.rpf`** (we run Legacy).
- If it has **`Manual Installation/`** and **`OIV Automatic Installation/`** → use the **`Manual Installation/dlc.rpf`**.
- Ignore `.oiv` files (those are OpenIV auto-installers for singleplayer).

Extracting on Linux (RAR needs 7-Zip; download the static binary once):

```bash
cd /tmp
curl -sL -o 7z.tar.xz https://www.7-zip.org/a/7z2301-linux-x64.tar.xz
tar -xf 7z.tar.xz 7zzs && chmod +x 7zzs
./7zzs l "/mnt/c/Users/torik/Downloads/<mod>.rar"      # list contents
./7zzs x -o/tmp/out "/mnt/c/Users/torik/Downloads/<mod>.rar" "Legacy/.../dlc.rpf"
```

## Step 2 — Find the spawn name AND the internal DLC name

- **Spawn name** = `<modelName>` inside the pack's `vehicles.meta` (a pack can have several).
- **Internal DLC name** = the folder name in the mod's readme line
  `<Item>dlcpacks:\<name>\</Item>` (also the `setup2.xml` `nameHash`/`deviceName`).

See **[05-inspecting-rpf.md](05-inspecting-rpf.md)** for a script that prints both.
Or just read the mod's `Readme.txt` — it states both the folder name and spawn name(s).

> ⚠️ Readmes sometimes have copy-paste errors in the spawn name (e.g. the ABT RS7 readme
> says "tenf" but the real names are `23rs7`/`23rs7abt`). When in doubt, trust `vehicles.meta`.

## Step 3 — Place it with the correct folder name

```bash
mkdir -p /opt/ragemp-srv/client_packages/game_resources/dlcpacks/<INTERNAL_NAME>
cp /tmp/out/.../dlc.rpf \
   /opt/ragemp-srv/client_packages/game_resources/dlcpacks/<INTERNAL_NAME>/dlc.rpf
```

**The folder name matters.** RAGE:MP mounts the DLC under that folder name; if it doesn't
match the add-on's internal name, the model won't resolve and you get a default car.
Example: the BMW pack's internal name is `g82adro`, so the folder must be `g82adro`
(naming it `bmwm5` breaks it).

## Step 4 — Restart the server

```bash
sudo systemctl restart rageserv
```

This re-indexes `client_packages` so the new `dlc.rpf` is added to the client download list
(`.listcache`). Confirm the server came up: `journalctl -u rageserv -f`.

## Step 5 — Update the client (this is the step people skip)

1. **Fully close GTA V / RAGE:MP** (exit to desktop — *not* just disconnect).
2. Relaunch RAGE:MP and connect. It downloads the new `dlc.rpf` on join…
3. …and **mounts DLCs at game load**, which is why a full relaunch (not a reconnect) is required.

## Step 6 — Test & verify

- In game: `/veh <spawnname>` (e.g. `/veh 23rs7`).
- From the server box you can confirm the client actually downloaded it — look for a file the
  same size as the `dlc.rpf` in the client cache:
  ```bash
  find /mnt/c/RAGEMP/client_resources -type f -size <BYTES>c
  # <BYTES> = exact byte size of the dlc.rpf you installed
  ```

---

## Liveries / skins

- A car only has liveries if its `carvariations.meta` has `<liveries>` items set to `true`,
  or a `carcols.meta` defines livery mods. Many add-ons have **none** — then `/livery` does nothing
  on that car, and that's expected (not a bug).
- Example: the BMW `g82adro` has **no** liveries (Body Paint: 1); the RmodCustoms Audi `rmodrs7`
  **does** have liveries.
- Base body textures are embedded in the pack (`<model>.ytd` inside the nested `vehicles.rpf`)
  and load automatically with the model — nothing extra to install.

## Multiple cars in one pack

One `dlc.rpf` can contain several models (e.g. the ABT pack has `23rs7` and `23rs7abt`).
They share one folder; each has its own spawn name.
