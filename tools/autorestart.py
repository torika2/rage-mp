#!/usr/bin/env python3
"""Restart rageserv automatically when server/client code or assets change.

Runs as the `rageserv-autorestart` systemd service (see tools/install-autorestart.sh).
Polls file mtimes once a second (no inotify dependency), waits until edits have been quiet
for DEBOUNCE seconds, then runs `sudo -n systemctl restart rageserv`.

Files the server writes itself (packages/*/*.json data, .listcache, *.tmp) are ignored —
watching them would make the server restart itself in a loop.
"""
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WATCH_DIRS = ['packages', 'client_packages']
WATCH_FILES = ['conf.json']
IGNORE_NAMES = {'.listcache'}
IGNORE_SUFFIXES = ('.tmp', '.swp', '~')
POLL = 1.0
DEBOUNCE = 2.0


def ignored(rel):
    name = os.path.basename(rel)
    if name in IGNORE_NAMES or name.endswith(IGNORE_SUFFIXES):
        return True
    # Runtime data written by server packages (money.json, inventory.json, ...).
    return rel.startswith('packages' + os.sep) and name.endswith('.json')


def snapshot():
    state = {}
    paths = [os.path.join(ROOT, f) for f in WATCH_FILES]
    for d in WATCH_DIRS:
        for dirpath, _, files in os.walk(os.path.join(ROOT, d)):
            paths.extend(os.path.join(dirpath, f) for f in files)
    for p in paths:
        rel = os.path.relpath(p, ROOT)
        if ignored(rel):
            continue
        try:
            st = os.stat(p)
            state[rel] = (st.st_mtime_ns, st.st_size)
        except OSError:
            pass
    return state


def changed(old, new):
    return sorted(k for k in old.keys() | new.keys() if old.get(k) != new.get(k))


def main():
    print(f'watching {ROOT} ({", ".join(WATCH_DIRS + WATCH_FILES)})', flush=True)
    last = snapshot()
    pending, quiet_since = set(), 0.0
    while True:
        time.sleep(POLL)
        now = snapshot()
        diff = changed(last, now)
        last = now
        if diff:
            pending.update(diff)
            quiet_since = time.monotonic()
            continue
        if pending and time.monotonic() - quiet_since >= DEBOUNCE:
            files = ', '.join(sorted(pending)[:5]) + (' …' if len(pending) > 5 else '')
            print(f'change detected ({files}) -> restarting rageserv', flush=True)
            result = subprocess.run(['sudo', '-n', 'systemctl', 'restart', 'rageserv'],
                                    capture_output=True, text=True)
            if result.returncode != 0:
                print('restart failed: ' + (result.stderr.strip() or str(result.returncode)), file=sys.stderr, flush=True)
            pending.clear()
            last = snapshot()


if __name__ == '__main__':
    main()
