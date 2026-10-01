# Troubleshooting

## `/car <name>` spawns a default car (not the add-on)

The model isn't mounted on the client. Work through these in order:

1. **Is the DLC even on the server, in the right place?**
   ```bash
   find /opt/ragemp-srv/client_packages/game_resources/dlcpacks -maxdepth 2
   ```
   It must be `game_resources/dlcpacks/<name>/dlc.rpf`, **not** `client_packages/dlcpacks/...`.

2. **Does the folder name match the add-on's internal name?**
   Naming it something generic (e.g. `bmwm5` instead of `g82adro`) makes it spawn default.
   The correct name is the `dlcpacks:/<name>/` from the mod readme / `setup2.xml` `nameHash`.

3. **Did the server actually restart after the change?**
   ```bash
   systemctl show rageserv -p ActiveEnterTimestamp --value   # must be AFTER your file change
   ```
   If a command "didn't work", first check it actually ran — the restart time is the giveaway.

4. **Did the client re-download it?** Look for a file the exact size of your `dlc.rpf`:
   ```bash
   find /mnt/c/RAGEMP/client_resources -type f -size <BYTES>c
   ```
   Nothing found → the server isn't serving it (wrong path, or no restart, or client didn't reconnect).

5. **Did you FULLY relaunch the GTA client?** DLCs mount at game load. A mid-session reconnect
   downloads the file but won't mount it. Close GTA to desktop, relaunch, reconnect.

6. **Right spawn name?** Confirm `<modelName>` from `vehicles.meta` (see doc 05). Readmes lie sometimes.

7. **Legacy vs Enhanced mismatch?** Installing an Enhanced `dlc.rpf` on this Legacy setup won't load.
   Use the Legacy build.

## `/livery <n>` does nothing

The car probably has no liveries. Check `carvariations.meta` (`<liveries>` all `false`) and whether a
`carcols.meta` exists. If there are none, this is expected — there's nothing to switch to.

## My command / `sudo` "didn't do anything"

If running commands from the Claude Code prompt, they must be prefixed with `!` to execute on the
machine (otherwise the text is just sent as a message). `sudo` will prompt for a password on the
terminal (characters don't echo — type it and press Enter). Verify with the restart timestamp above.

## Can't edit files (Permission denied)

`client_packages/` and `packages/` may be root-owned. Take ownership once:
```bash
sudo chown -R torik:torik /opt/ragemp-srv/client_packages /opt/ragemp-srv/packages
```

## Server won't start after a change

```bash
journalctl -u rageserv -n 50 --no-pager
```
Look for JS syntax errors (bad edit to `packages/freeroam/index.js` or `client_packages/index.js`)
or a malformed file. Fix and `sudo systemctl restart rageserv`.

## MapTypesStore pool limit error (Redux users)

Already fixed: `client_packages/game_resources/common/data/gameconfig.xml` has `MapTypesStore`
raised to `50000`. If it recurs, that file is the place.

## Barber: buying hair colour "doesn't complete / doesn't save"

Symptom: in the hair salon, pressing Pay does nothing and no colour saves (often on a fresh
character). Cause: the ped reports out-of-range colour values (e.g. `hairColor = 255`), and the
server's `parseLook` rejects the whole look (valid colours are 0–63). Fixed — `withDefaults()` in
`packages/barber/index.js` clamps every field to its valid range. See
[12-salons.md](12-salons.md). If it recurs, check that `withDefaults` is clamping (not just
`Number.isInteger`), and look for `[barber] buy rejected by parseLook` in the server log.
