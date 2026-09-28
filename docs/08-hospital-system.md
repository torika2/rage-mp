# Hospital System

The hospital job is a server-side package in `packages/hospital/`. The
Pillbox Hill Medical Center v1.8 RAGE:MP-format package from `hospi.zip` is
installed at `client_packages/game_resources/dlcpacks/phmc/dlc.rpf`, and entry
is enabled for an in-game test. The archive also contains a separate SP copy;
only the `ragemp/dlc.rpf` was installed. The 292 MB game asset is not tracked
in Git; install it separately from `hospi.zip`. The server also checks that
`dlc.rpf` exists before allowing entry, so a checkout without the asset keeps
the entrance disabled even if `interior.enabled` is true. The author cautions
that the map requires a current official GTA V game version and may show as LOD
or cause fall-through on older/incompatible builds. Use `/hreset` or `/hexit`
to recover and disable `interior.enabled` if that occurs.

## Ranks and capabilities

| Rank | Capabilities |
|------|--------------|
| Medical Intern | Go on/off duty |
| Emergency Medical Technician (EMT) | Duty, treat nearby patients |
| Paramedic | EMT permissions, revive nearby unconscious patients |
| Surgeon | Paramedic permissions, recruit and promote/demote lower-ranking staff |
| Chief Physician | Surgeon permissions, remove lower-ranking staff |

The allowlisted account in `hospital.json` is always treated as Chief Physician.
Capability checks are performed server-side. Patient treatment and revival
require staff to be on duty, and the patient must be within 3 metres and in the
same dimension. Staff management also requires the manager to be on duty.
Managers cannot manage allowlisted administrators or staff of equal or higher
rank, or assign a rank equal to or above their own.

## Patient access and commands

The hospital entrance is marked on the map, and entry is enabled for testing.
`/hreset` and `/hexit` remain available to return stranded players to the
exterior.

| Command | Permission | Effect |
|---------|------------|--------|
| `/hospital` | Anyone | Show staff rank/status and hospital commands |
| `/henter` | Anyone | Enter when a hospital interior is installed and enabled |
| `/hexit` | Anyone inside | Exit; safely returns a stranded player while interior is disabled |
| `/hreset` | Anyone at hospital | Safely return outside if stranded near the interior coordinates |
| `/hduty` | Hospital staff | Toggle duty |
| `/heal <id>` | EMT+ on duty | Restore a nearby living patient to configured max health |
| `/revive <id>` | Paramedic+ on duty | Revive a nearby unconscious player at their current position |
| `/hranks` | Anyone | List valid rank keys |
| `/hhire <id>` | Surgeon+ on duty | Hire an online player as Medical Intern |
| `/hpromote <id> <rank>` | Surgeon+ on duty | Promote a lower-ranking staff member |
| `/hdemote <id> <rank>` | Surgeon+ on duty | Demote a lower-ranking staff member |
| `/hfire <id>` | Chief Physician+ on duty | Remove a lower-ranking staff member |

Use the player ID displayed in the player list. Staff management targets can be
online anywhere; treatment targets must be nearby.

## Configuration and persistence

Edit `packages/hospital/hospital.json` while the server is stopped:

- `admins`: Social Club names treated as Chief Physician.
- `maxHealth`: health restored by treatment or revival.
- `exterior.position` / `exterior.dimension`: entrance and return point.
- `interior.enabled`: currently true for testing the installed RAGE:MP-format
  PHMC pack. Disable it if the map appears as LOD or has missing collision.
- `interior.entrance` / `interior.exit` / `interior.dimension`: transition
  points; update and verify them against the installed interior before enabling.
- `ranks`: staff rank hierarchy and capabilities.
- `staff`: persistent roster keyed by lowercase Social Club name.

Roster changes are written atomically to `hospital.json`. Duty status resets on
reconnect. The current MVP does not include EMS vehicles, salaries, billing,
medical inventory, treatment animations, or persistent patient records.

## Deployment and testing

1. Validate `hospital.json` with `python3 -m json.tool packages/hospital/hospital.json`.
2. Check JavaScript syntax with `node --check packages/hospital/index.js` and
   `node --check client_packages/index.js` in an environment with Node installed.
3. Restart `rageserv` and inspect `journalctl -u rageserv -n 50 --no-pager`.
4. Reconnect and test hospital entry. The mod author requires a current official
   GTA V game version. If the interior appears as LOD or has missing collision,
   use `/hreset` or `/hexit`, set `interior.enabled` false, and restart.
5. With two players, test intern duty, EMT healing, paramedic revival, and staff
   promotion/demotion/firing with accounts at different ranks.
6. Verify off-duty, wrong-rank, self-target, out-of-range, and out-of-location
   attempts are rejected.
