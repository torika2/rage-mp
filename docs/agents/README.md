# Specialist Agents

Purpose-built Claude Code subagents for this RAGE:MP server. The **runnable** definitions live in
[`.claude/agents/`](../../.claude/agents) (that's the only place Claude Code auto-loads them from). This
page documents what each is for and when to reach for it.

## How to use

- Ask Claude to "use the **modder** agent to add this car", or run `/agents` to see them.
- Each agent is scoped and read/act-limited to keep it focused; several are read-only (analysis/critique).

## Roster

### Requested

| Agent | Role | When to use |
|-------|------|-------------|
| **modder** | GTA V / RAGE:MP modding | Add/fix add-on vehicles, DLCs, textures, RPF inspection, gameconfig |
| **critical-thinker** | Devil's advocate (read-only) | Stress-test a plan/decision *before* building it |
| **gamification** | Game design & engagement | Progression, rewards, missions, retention, economy sinks/sources |
| **life-system-analyzer** | RP life systems (read-only) | Needs (hunger/energy…), jobs, housing, banking, interdependencies |
| **game-system-analyzer** | Core mechanics (read-only) | Review/extend vehicles, fuel, engine, economy, combat; find exploits |

> Note: the two analyzer agents use the correct spelling `analyzer` (you wrote "analizer").

### Recommended additions

| Agent | Role | When to use |
|-------|------|-------------|
| **economy-balancer** | Numeric balancing | Tune prices, fuel drain, payouts, starting money; keep client/server prices in sync |
| **qa-tester** | QA / verification | Test plans, edge cases, server-side checks before "done" |
| **security-anticheat** | Server authority | Any client→server value flow (money, items, progression) |
| **performance-optimizer** | Perf | Anything added to the render loop or frequent server events |

## How they fit together (typical flow)

```
idea → critical-thinker (is it worth it?) → gamification / *-system-analyzer (design)
     → modder / (implementation) → economy-balancer (numbers)
     → security-anticheat (can't be exploited?) → performance-optimizer (cheap enough?)
     → qa-tester (prove it works) → deploy (restart + relaunch)
```

## Further agents worth adding later

- **ux-hud-designer** — HUD clarity, menu ergonomics, player feedback.
- **world-builder / lore** — missions, points of interest, narrative consistency.
- **release-manager** — the swap-deploy + backup + restart workflow, rollbacks.
- **data-persistence** — when JSON outgrows itself and a real DB is needed.

Ask and I'll scaffold any of these the same way.
