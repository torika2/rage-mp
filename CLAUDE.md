# CLAUDE.md

RAGE:MP (GTA V multiplayer) server — freeroam gamemode with add-on vehicles, a
speedometer/fuel/money system, and more.

## 📖 All documentation lives in [`docs/`](docs/README.md)

Start there. Key entry points:

- [docs/README.md](docs/README.md) — index + golden rules
- [docs/01-server-overview.md](docs/01-server-overview.md) — paths, service, networking
- [docs/02-adding-vehicle-mods.md](docs/02-adding-vehicle-mods.md) — how to add add-on cars
- [docs/03-commands.md](docs/03-commands.md) — commands, keybinds, HUD, fuel/money
- [docs/04-troubleshooting.md](docs/04-troubleshooting.md) — common problems
- [docs/05-inspecting-rpf.md](docs/05-inspecting-rpf.md) — reading `dlc.rpf`
- [docs/inventory.md](docs/inventory.md) — installed mods & spawn names
- [docs/agents/README.md](docs/agents/README.md) — the specialist agents (below)

## Fast facts

- Server: `/opt/ragemp-srv`, systemd service `rageserv` (`sudo systemctl restart rageserv`, logs `journalctl -u rageserv -f`).
- Client-side code: `client_packages/index.js` (owned by `torik` — editable without sudo).
- Server-side code: `packages/<name>/index.js` (`freeroam` = commands, `economy` = money/fuel).
- Add-on cars: `client_packages/game_resources/dlcpacks/<name>/dlc.rpf`.
- Deploy = edit files (no sudo needed) → `sudo systemctl restart rageserv` in a **real terminal** → relaunch/reconnect client.

## Specialist agents

Invocable Claude Code subagents live in [`.claude/agents/`](.claude/agents) and are documented in
[`docs/agents/`](docs/agents/README.md). Roster:

| Agent | Use it for |
|-------|-----------|
| `modder` | Adding/fixing add-on vehicles, DLCs, textures, RPF work |
| `critical-thinker` | Stress-testing plans/decisions before building |
| `gamification` | Progression, rewards, retention, engagement loops |
| `life-system-analyzer` | RP "life" mechanics: needs, jobs, housing, survival |
| `game-system-analyzer` | Core systems: vehicles, fuel, economy, combat, balance/exploits |
| `economy-balancer` | Tuning prices, drain rates, payouts, inflation |
| `qa-tester` | Test plans, edge cases, in-game verification steps |
| `security-anticheat` | Server authority, input validation, exploit prevention |
| `performance-optimizer` | Render loop, streaming, server tick performance |
| `documenter` | Writing `docs/` for a system at the end of a task — one system per file, asks first |

> Conventions for working in this repo (deploy method, Legacy-only, no-sudo file edits) are in
> `docs/`. Agents should read the relevant docs before acting.

## Always offer to document at the end of a task

When a task finishes — a feature built, a system changed, or a question answered that the docs couldn't
— **ask the user whether they want it documented** before moving on. Keep it to one short line, e.g.:

> Task done. Want me to document the **<system>** in `docs/`? (y / skip)

If the user says yes, launch the `documenter` agent (Agent tool, `subagent_type: documenter`) to write
it. The documenter writes one focused doc per system and will confirm the filename/scope itself. Skip
the question only for trivial tasks (typo fixes, one-liners, pure investigation with nothing new to
record).
