# Admin Panel

The CEF admin panel is available to the allowlisted Social Club account
`SEPHIGR` using **F8** or `/admin` (both toggle the panel). The panel captures
game input while open so keyboard and mouse interaction stays within the UI.
The server checks the account again for every panel request and action; hiding
or modifying the client UI does not grant authorization.

The panel's **Admin Mode** toggle gates privileged actions. Admin Mode starts
off each session; turn it on to enable player actions, flight, announcements,
and moderation. The admin is invincible while Admin Mode is on. Turning it off
immediately ends flight, restores normal damage, and rejects privileged actions
while leaving the panel available to turn it back on.

## Actions

- Browse and filter online players by name or player ID.
- **Go to** a player or **Bring** a player to the admin. Both parties must be
  on foot; the destination position and dimension are copied server-side.
- **Heal** a living player to 100 health.
- **Revive** an unconscious player at their current position and dimension.
- **Kill** a non-admin player (with confirmation); self-targeting and
  allowlisted administrators are rejected server-side.
- **Give money:** the Player actions card → **Give money** → ID + amount ($1 to $1,000,000). The persisted balance is updated server-side and the recipient is
  notified. The `/addmoney` command is restricted to allowlisted admins with
  Admin Mode enabled.
- **Kick** a player after a confirmation prompt.
- **Player rows** only have **Go to**, **Bring**, **Heal** and **Revive**.
- **Player actions card** (right column): **Ban**, **Mute**, **Unmute**, **Give money**,
  **Demorgan**, **Release DM**, **Kick** and **Kill**. Each button opens a small form asking for
  the **player ID** (showing who it is as you type), plus:
  - **Ban / Mute:** time in minutes (0 = permanent), with quick buttons (30 min, 1 h, 1 day,
    Permanent …).
  - **Give money:** the amount in $.
  - **Demorgan:** time in minutes plus an optional **reason**, shown to the prisoner.
  - The form validates everything before sending, and the server re-checks it.
- **Mute = text + voice.** Chat messages from a muted player aren't delivered (they're told
  they're muted). Voice is cut on the **server**: no voice link to or from anyone while muted, and
  the 15-second voice relink respects it, so a modified client can't get around it. Push-to-talk
  (B) is also blocked on their client. When a timed mute expires, voice comes back on its own
  within 15 s.
- **Mute** an online player (Player actions card): whole minutes up to 525,600 (1 year), where
  **0 = permanent**. **Ban** is in whole days (presets 1, 3, 7, 14, 30 days, up to 365), where
  **0 = permanent**. The confirmation and the
  player's message show it readably (e.g. "for 1 day 6 hours"). Active mutes
  block regular chat; bans are checked on every join. Both persist across
  server restarts and expire automatically. **Unmute** is available on the
  player's row; enter a Social Club account name under **Unban account** to
  remove a ban.
- Allowlisted administrators bypass automatic chat spam bans.
- Toggle the admin's own flight mode from the panel or press **N** while in Admin
  Mode (WASD, Space up, Ctrl down, Shift fast 250 m/s, Alt slow 10 m/s, normal 60 m/s). While flying, the admin is invisible to streamed
  players; invisibility is restored when flight is disabled or the admin dies.
  Flight remains invincible, as does Admin Mode.
- Send a server-wide announcement, limited to 180 characters.
- **Demorgan** (admin jail, `packages/demorgan`): Player actions card → **Demorgan** → ID +
  minutes (1–1440) + optional reason. **Release DM** lets them out. A prisoner's row shows
  "Demorgan: N min left". It needs Admin Mode, and admins can't be sent.
  - **Where:** an enclosed **underground interior**, the Gunrunning **bunker** below the docks,
    in **dimension 1**. Inside a closed interior GTA doesn't draw the outside world, so only the
    Demorgan area is visible, and its walls keep prisoners in. There's **no line/radius** any more.
  - **Enforced by the server:** a prisoner who glitches out (falls 40 m+ through the floor or ends
    up more than 250 m away) is put back on the spawn point and gets **+5 minutes**; one who dies
    respawns inside immediately, also **+5 minutes**. Getting into a vehicle just puts them back.
    One who isn't in dimension 1 (e.g. just connected) is put back into it, no penalty. Everyone
    in Demorgan is **invincible** (client-side, re-applied every frame). Chat
    commands are blocked except `/pos`, `/money`, `/bank`, `/needs`, `/laws` and `/inv`.
  - **Client:** weapons, melee and vehicles are disabled, and a countdown with the reason shows at
    the top of the screen. Anyone in Demorgan (prisoners, `/sjail`, `/dim 1`, `/setdim … 1`) has
    the **minimap hidden** and **no NPCs or traffic**, and the bunker's furniture (entity sets
    `Bunker_Style_A`, `standard_bunker_set`, …) is switched on. The bunker's Gunrunning IPLs (`gr_grdlc_interior_placement`, `…_interior_0_grdlc_int_01_milo_`) are requested at client start, and the furniture is applied once the interior is loaded (retried for ~30 s), otherwise parts of it show up missing. Everything is restored on leaving.
  - **Prison work (digging):** each prisoner has a marked spot (orange marker). Standing on it and
    pressing **E** plays a pickaxe-swinging animation for 10 s (every prisoner is given a **pickaxe inventory item** automatically when jailed or on rejoin, and it's removed on release; if they drop or lose it, a new one is handed out when they press E, if they have a free slot; several prisoners can dig at once, each on their own spot); each prisoner can dig **10 times in a row, then gets a random 5–20 minute break** (rolled per prisoner and per batch) (the prompt shows `Digging break m:ss`), then another 10, and so on; the counter and break are stored with the sentence so reconnecting doesn't skip it (admins aren't limited; `DIG_BATCH` / `DIG_COOLDOWN_MIN` / `DIG_COOLDOWN_MAX`); staying on the spot for the full 10 s pays a
    **random $50–$300** (digging does **not** shorten the sentence), shown as a push notification in the same style as the ammo chip (`+$450 Digging` under the crosshair, in the
    HUD page) and in chat right after the animation (skewed so $50 is the most common: ~1 in 4 digs, median ~$80, average ~$110; tune `DIG_MONEY_*` in `packages/demorgan/index.js`) and marks a new spot. Admins digging get the same money and notification. The server checks the spot, the distance
    at start and end, and one dig at a time. Spots default to 8 offsets around the Demorgan spot;
    admins manage them with `/dmdig` (list), `/dmdig add` (your position; the first add replaces
    the defaults), `/dmdig del <n>` and `/dmdig reset`. Admins who enter Demorgan (`/sjail`, `/dim 1`) are also given a pickaxe (taken back when they leave) and can dig at **any** spot with E (same animation, same random money and notification). They always see every spot (golden
    markers). Each spot (within 15 m) carries an `E  Dig 3/10` label in the HUD's ammo-chip style (prisoners: their own spot, which shows `Digging break m:ss` during the break; admins: all spots). The spots have no number labels; `/dmdig` lists them by number.
  - **Moving it:** `/sjail set` saves your position as the Demorgan spot. Use a spot inside an
    enclosed interior, or the outside map becomes visible again. The first start after this update
    moved any older open-yard spot into the bunker (once, `spotVersion: 2`).
  - **Time:** it counts down only while online and survives reconnects, respawns and restarts
    (`packages/demorgan/demorgan.json`). On release, the player appears outside the prison gate.
  - **Commands:** `/demorgan <id> <minutes> [reason]`, `/undemorgan <id>`, `/demorgans` (list,
    including offline), `/sjail` (admins only: teleport yourself into Demorgan; `/sjail` again
    returns you to where you were), and `/sjail set` (move the Demorgan spot to where you stand).
    All of them are also in the **Commands** tab.
- **Dimensions:** **0 = main world**, **1 = Demorgan** (house interiors use `100000 + house id`).
  Admins can use `/dim` to see their dimension, `/dim <0|1|main|demorgan|number>` to move
  themselves, and `/setdim <id> <…>` to move a player. Moving to 1 lands on the Demorgan spawn
  point. A player serving Demorgan can't be moved with `/setdim` (use `/undemorgan` first). The
  admin panel's player list shows each player's dimension. Both commands are in the Commands tab.
- **Commands tab:** every chat command on the server, grouped (General, Vehicles, Economy &
  shops, Clothing, Government, Police, City Hall, Houses, Admin). Each has its usage, a short
  description, an arguments box and **Run**. Commands that take a player id get a **player
  picker** from the online list. Search filters the list, and the box at the bottom runs any
  command typed in full (e.g. `/house price 12 90000`).
  - **Permissions:** running a command is exactly like typing it in chat, so each command still
    checks its own permissions. Only admins can list or run commands from the panel.
  - **Output** goes to chat, and the panel shows "Ran /…".
  - **Catalog:** descriptions live in `COMMAND_CATALOG` (`packages/admin/index.js`). A newly
    added command with no entry still appears automatically under **Other** (read from
    `global.commandRegistry`).
- **Scrolling:** the player list, the command list and the right-hand column each scroll on their
  own. If the game window is smaller than the panel, the whole page scrolls.

The panel refreshes the player list after actions. Player account identifiers
are not disclosed in the player list; the unban form requires the account name
because the banned player is offline. Self-targeting and moderation of
allowlisted administrators are rejected server-side. The Escape key closes the
panel; F8 or `/admin` toggles it.

## Files and verification

- Server authorization/actions and persistent sanctions: `packages/admin/index.js`
  and `packages/admin/moderation.json`
- Client browser lifecycle and event bridge: `client_packages/index.js`
- CEF: `client_packages/ui/admin/index.html`

Run `node --check packages/admin/index.js` and
`node --check client_packages/index.js`, then restart `rageserv` and reconnect.
Verify F8 and `/admin` toggle the panel, game controls do not act behind it,
and privileged actions are rejected while Admin Mode is off. Verify `/admin`
is rejected for a non-allowlisted account. Test chat mute, expiry/unmute,
temporary and permanent bans, rejoin rejection, unban, kick, and restarting the
service with a stored sanction.
