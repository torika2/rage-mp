#!/usr/bin/env python3
"""Build packages/houses/data/world_houses.json: a for-sale house at every residential mailbox on the map.

GTA puts a mailbox (prop_letterbox_01/02/03) in front of almost every house, so their placements are a
map-wide list of houses. Source: DurtyFree/gta-v-data-dumps objectslocations/worldLetterBoxes.json.

Each house gets a random interior + price from its area's tier (hills = villas/penthouses, city = mid
apartments, south LS / countryside = cheap apartments). The RNG is seeded, so re-running gives the same
result. packages/houses imports the file once (data.seededWorld) — re-running doesn't touch live houses.

Run:  python3 tools/gen-house-data.py
"""
import json
import math
import os
import random
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = 'https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/objectslocations/worldLetterBoxes.json'
OUT = os.path.join(ROOT, 'packages', 'houses', 'data', 'world_houses.json')
DEDUPE_M = 8.0  # mailboxes closer than this belong to the same house

# Interior keys must exist in INTERIORS (packages/houses/index.js). Price range in $, rounded to 5k.
TIERS = {
    'high': {'interiors': ['wild_oats', 'conker_2044', 'conker_2045', 'hillcrest_2862', 'hillcrest_2868', 'hillcrest_2874',
                           'whispymound', 'mad_wayne', 'eclipse_modern', 'eclipse_moody', 'eclipse_vibrant', 'eclipse_sharp',
                           'eclipse_monochrome', 'eclipse_seductive', 'eclipse_regal', 'eclipse_aqua'],
             'price': (250000, 650000)},
    'mid':  {'interiors': ['mid', 'mid', 'richards', 'tinsel', 'low'], 'price': (90000, 180000)},
    'low':  {'interiors': ['low', 'low', 'low', 'mid'], 'price': (40000, 80000)},
}


def tier_of(x, y):
    if y > 2500:            # Sandy Shores, Grapeseed, Paleto, rural county
        return 'low'
    if y < -1100:           # Davis, Strawberry, Rancho, El Burro
        return 'low'
    if y > 100 and -2100 < x < 1100:  # Vinewood Hills, Rockford/Richman, Pacific Bluffs
        return 'high'
    return 'mid'            # Mirror Park, Vespucci, Little Seoul, Chumash coast …


def main():
    with urllib.request.urlopen(SOURCE, timeout=60) as response:
        boxes = json.loads(response.read().decode('utf-8'))
    houses = []
    for box in boxes:
        if not str(box.get('Name', '')).startswith('prop_letterbox'):
            continue  # prop_postbox_* are public post boxes, not houses
        p = box['Position']
        x, y, z = p['X'], p['Y'], p['Z']
        if any(math.hypot(x - h['x'], y - h['y']) < DEDUPE_M for h in houses):
            continue
        houses.append({'x': round(x, 2), 'y': round(y, 2), 'z': round(z + 1.0, 2)})  # prop base -> ped height

    rng = random.Random(20260930)
    for house in houses:
        tier = tier_of(house['x'], house['y'])
        config = TIERS[tier]
        low, high = config['price']
        house['tier'] = tier
        house['interior'] = rng.choice(config['interiors'])
        house['price'] = int(round(rng.randint(low, high) / 5000.0) * 5000)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as handle:
        json.dump(houses, handle, separators=(',', ':'))
    counts = {t: sum(1 for h in houses if h['tier'] == t) for t in TIERS}
    print(f'{len(houses)} houses -> {os.path.relpath(OUT, ROOT)}  {counts}')


if __name__ == '__main__':
    main()
