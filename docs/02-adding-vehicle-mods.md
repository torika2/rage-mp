# Adding Add-On Vehicle Mods

This is the full, correct process for adding a custom add-on car to the server.
Follow every step — most "it spawns a default car" problems are a skipped step here.

## TL;DR

```
client_packages/game_resources/dlcpacks/<name>/dlc.rpf
```

> ⚠️ **The "free-form / prefix convention" below is UNVERIFIED and broke every mod on this server.**
> A mass `car_`/`cloth_`/`map_`/`sound_` prefix rename stopped all add-ons loading (even after a full
> relaunch); the known-good state is **unprefixed folder names matching each pack's internal
> `nameHash`**. See **[16-dlcpack-folder-naming.md](16-dlcpack-folder-naming.md)**. Until the prefix
> convention is actually proven in-game, name a new folder to match its `nameHash` and don't rename
> existing ones.

- Name the folder to match the pack's internal `nameHash` (see doc 16). The model itself resolves by
  the spawn name in `vehicles.meta`, not the folder (golden rule #5) — see Step 3.
- Restart server → **fully relaunch** GTA client → reconnect → `/car <spawnname>`.

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

**Folder naming:** use `<INTERNAL_NAME>` = the pack's internal `nameHash` (unprefixed). The *model*
resolves by the `<modelName>` baked in `vehicles.meta`, **not** the folder (golden rule #5) — that's
why a folder can spawn a differently-named model. But do **not** rely on that to rename working
folders: a mass category-prefix rename (`car_`/`cloth_`/`map_`/`sound_`) broke **every** add-on on
this server and reverting to unprefixed names fixed it. The prefix convention is **UNVERIFIED** — see
**[16-dlcpack-folder-naming.md](16-dlcpack-folder-naming.md)**.

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

- In game: `/car <spawnname>` (e.g. `/car 23rs7`).
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
