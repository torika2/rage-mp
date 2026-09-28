# Police System

Server-side police job for the freeroam gamemode. The roster, rank permissions, jail destination, and jail sentences are configured in `packages/police/police.json`; officer and sentence data are persisted there.

## Ranks and capabilities

| Rank | Capabilities |
|------|--------------|
| Cadet | Go on/off duty |
| Police Officer | Duty, handcuff and uncuff nearby players |
| Senior Officer | Officer permissions, arrest a handcuffed player |
| Sergeant | Senior Officer permissions, sentence and release arrested players |
| Lieutenant | Sergeant permissions, recruit cadets and promote/demote lower-ranking officers |
| Captain | Lieutenant permissions, remove lower-ranking officers from the roster |
| Chief of Police | All police permissions; the initial allowlisted administrator is treated as Chief |

A rank can use a capability only while on duty. Ranks inherit the capabilities listed for them in `police.json`; edit that file to change the hierarchy. An officer cannot manage an equal- or higher-ranking officer, assign a rank equal to or above their own, or manage an allowlisted administrator.

## In-game commands

Player targets use the online player ID shown in the player list. For physical interactions, the target must be within 3 metres and in the same dimension.

| Command | Permission | Effect |
|---------|------------|--------|
| `/police` | Police roster | Show rank, duty status, and command summary |
| `/ranks` | Anyone | Show valid rank keys |
| `/pduty` | Police roster | Toggle duty |
| `/cuff <id>` | Officer+ | Immobilize a nearby player |
| `/uncuff <id>` | Officer+ | Uncuff a player who is not arrested or jailed |
| `/arrest <id>` | Senior Officer+ | Mark a handcuffed player as arrested |
| `/jail <id> <minutes>` | Sergeant+ | Send an arrested, handcuffed player to configured jail for 1-120 minutes |
| `/release <id>` | Sergeant+ | Release a jailed player early |
| `/hire <id>` | Lieutenant+ | Add a nearby player as a Cadet |
| `/promote <id> <rank>` | Lieutenant+ | Promote a lower-ranking officer, subject to rank hierarchy |
| `/demote <id> <rank>` | Lieutenant+ | Demote a lower-ranking officer |
| `/fire <id>` | Captain+ | Remove a lower-ranking officer from the roster |

## Initial administrator and configuration

`police.json` initially allowlists the Social Club account `SEPHIGR` as the Chief. Admin names are matched case-insensitively. To add administrators, edit the `admins` array. Only edit this file while the server is stopped, or coordinate with a restart: the package loads the configuration into memory at startup and writes roster/jail changes back to disk.

The initial jail destination is Mission Row cell coordinates `(459.7, -994.2, 24.9)`, dimension `0`. Adjust `jail.position` and `jail.dimension` in `police.json` to match the server's interior/map before using `/jail`; `/jail` saves the prisoner's pre-jail position and dimension for their release. Sentence limits are configured by `minMinutes` and `maxMinutes`.

## State and limitations

- Roster entries and active sentence release times persist by Social Club account. Expired sentences are cleared on reconnect; active sentences resume when the player reconnects.
- Duty and handcuff/arrest state are session-only. A player who disconnects before being jailed is not kept cuffed after reconnecting.
- Cuffs use server-side position freeze: this MVP does not add cuff animations, escorting, weapon confiscation, citations, or evidence.
- Police gameplay commands and checks run on the server; there are no client-supplied rank, sentence, or reward values.

## Verification after deployment

1. Run `node --check packages/police/index.js` and validate `packages/police/police.json` with `python3 -m json.tool packages/police/police.json`.
2. Restart `rageserv`; inspect `journalctl -u rageserv -n 50 --no-pager` for package load errors.
3. Join as `SEPHIGR`; `/police` should show Chief, then `/pduty` should enable police commands.
4. Hire a nearby player with `/hire <id>`, then test promotion/demotion and confirm a reconnect preserves their rank.
5. With two players nearby, test cuff → arrest → jail for 1 minute → automatic release, early release, and reconnect during an active sentence.
6. Confirm off-duty use, insufficient ranks, out-of-range targets, invalid minutes, and attempts to manage peers are rejected.