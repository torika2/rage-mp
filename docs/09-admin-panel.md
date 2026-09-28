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
- **Kick** a player after a confirmation prompt.
- **Mute** or **Ban** an online player using the selected duration: 5 minutes,
  30 minutes, 1 hour, 6 hours, 1 day, 7 days, or permanently. Active mutes
  block regular chat; bans are checked on every join. Both persist across
  server restarts and expire automatically. **Unmute** is available on the
  player's row; enter a Social Club account name under **Unban account** to
  remove a ban.
- Toggle the admin's own flight mode from the panel or press **B** (WASD,
  Space, Ctrl, Shift to move). While flying, the admin is invisible to streamed
  players; invisibility is restored when flight is disabled or the admin dies.
  Flight remains invincible, as does Admin Mode.
- Send a server-wide announcement, limited to 180 characters.

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
