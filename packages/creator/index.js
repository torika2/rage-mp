// ===================== Character creator: heritage + face + overlays =====================
// The last onboarding step (auth -> gender -> CREATOR -> spawn). The client previews a full GTA
// Online-style creator locally; on confirm we validate the whole appearance blob server-side,
// persist it to MySQL (characters.appearance via the API), apply it to the streamed ped so everyone
// sees it, and then drop the player into the world.
//
// The appearance blob is the AUTHORITATIVE full look. The barber shop edits a subset later
// (hair/beard/eyebrows/eye) — it defers to this blob on spawn so it can't wipe the face (see barber).

const HERITAGE_PARENTS = 46;      // mother/father indices 0..45
const FEATURE_COUNT = 20;         // face-feature sliders, each -1..1
const HAIR_MAX = 73;              // freemode hair drawables 0..73
const PALETTE = 64;               // hair/overlay tint palette 0..63
const EYE_COLORS = 32;            // 0..31

// head-overlay id + max style + whether it takes a tint colour. style -1 = none.
const OVERLAYS = {
    blemishes:     { id: 0,  max: 23, color: false },
    beard:         { id: 1,  max: 28, color: true, maleOnly: true },
    eyebrows:      { id: 2,  max: 33, color: true },
    ageing:        { id: 3,  max: 14, color: false },
    makeup:        { id: 4,  max: 74, color: false },
    blush:         { id: 5,  max: 6,  color: true },
    complexion:    { id: 6,  max: 11, color: false },
    sundamage:     { id: 7,  max: 10, color: false },
    lipstick:      { id: 8,  max: 9,  color: true },
    moles:         { id: 9,  max: 17, color: false },
    chesthair:     { id: 10, max: 16, color: true, maleOnly: true },
    bodyblemishes: { id: 11, max: 11, color: false },
};

const FREEMODE = { m: mp.joaat('mp_m_freemode_01'), f: mp.joaat('mp_f_freemode_01') };
// Private room where the creator ped stands (indoors, neutral light).
const CREATOR_POS = { x: 402.56, y: -1000.0, z: -99.0 };

function genderOf(player) {
    if (player.account && (player.account.gender === 'm' || player.account.gender === 'f')) return player.account.gender;
    return Number(player.model) === FREEMODE.f ? 'f' : 'm';
}

// ---- validation: returns a clean blob or null ----
function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function clampFloat(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
}

function validateAppearance(raw, gender) {
    if (!raw || typeof raw !== 'object') return null;

    const h = raw.heritage || {};
    const mom = clampInt(h.mom, 0, HERITAGE_PARENTS - 1);
    const dad = clampInt(h.dad, 0, HERITAGE_PARENTS - 1);
    const shapeMix = clampFloat(h.shapeMix, 0, 1);
    const skinMix = clampFloat(h.skinMix, 0, 1);
    if (mom === null || dad === null || shapeMix === null || skinMix === null) return null;

    if (!Array.isArray(raw.features) || raw.features.length !== FEATURE_COUNT) return null;
    const features = raw.features.map((v) => clampFloat(v, -1, 1));
    if (features.some((v) => v === null)) return null;

    const hairRaw = raw.hair || {};
    const hair = {
        style: clampInt(hairRaw.style, 0, HAIR_MAX),
        color: clampInt(hairRaw.color, 0, PALETTE - 1),
        highlight: clampInt(hairRaw.highlight, 0, PALETTE - 1),
    };
    if (hair.style === null || hair.color === null || hair.highlight === null) return null;

    const overlays = {};
    for (const key of Object.keys(OVERLAYS)) {
        const spec = OVERLAYS[key];
        const o = (raw.overlays && raw.overlays[key]) || {};
        let style = clampInt(o.style, -1, spec.max);
        if (style === null) return null;
        if (spec.maleOnly && gender === 'f') style = -1; // no beard/chest hair on female ped
        const opacity = clampFloat(o.opacity, 0, 1);
        if (opacity === null) return null;
        const entry = { style, opacity };
        if (spec.color) {
            const color = clampInt(o.color, 0, PALETTE - 1);
            if (color === null) return null;
            entry.color = color;
        }
        overlays[key] = entry;
    }

    const eyeColor = clampInt(raw.eyeColor, 0, EYE_COLORS - 1);
    if (eyeColor === null) return null;

    return { heritage: { mom, dad, shapeMix, skinMix }, features, hair, overlays, eyeColor };
}

// ---- apply the blob to the server-side (streamed) ped ----
function applyAppearance(player, look) {
    const gender = genderOf(player);
    try { player.model = FREEMODE[gender]; } catch (e) {}
    const h = look.heritage;
    // setHeadBlend(shapeFirst, shapeSecond, shapeThird, skinFirst, skinSecond, skinThird, shapeMix, skinMix, thirdMix)
    // first = father, second = mother.
    try { player.setHeadBlend(h.dad, h.mom, 0, h.dad, h.mom, 0, h.shapeMix, h.skinMix, 0); } catch (e) {}
    for (let i = 0; i < FEATURE_COUNT; i++) {
        try { player.setFaceFeature(i, look.features[i]); } catch (e) {}
    }
    try { player.setClothes(2, look.hair.style, 0, 0); } catch (e) {}
    try { player.setHairColor(look.hair.color, look.hair.highlight); } catch (e) {}
    for (const key of Object.keys(OVERLAYS)) {
        const spec = OVERLAYS[key];
        const entry = look.overlays[key];
        const value = entry.style < 0 ? 255 : entry.style;
        const color = spec.color ? entry.color : 0;
        try { player.setHeadOverlay(spec.id, [value, entry.opacity, color, color]); } catch (e) {}
    }
    try { player.eyeColor = look.eyeColor; } catch (e) {}
}

// ---- public hooks (used by auth + barber) ----
global.creatorHasAppearance = (player) => !!(player.character && player.character.appearance);
global.applyCreatorAppearance = (player) => {
    const look = player.character && player.character.appearance;
    if (look) applyAppearance(player, look);
};
// Auth calls this when a logged-in character still has no appearance.
global.startCharacterCreator = (player) => {
    player.creatorActive = true;
    const gender = genderOf(player);
    try { player.model = FREEMODE[gender]; } catch (e) {}
    player.dimension = 2500000 + player.id; // private room instance
    try { player.spawn(new mp.Vector3(CREATOR_POS.x, CREATOR_POS.y, CREATOR_POS.z)); } catch (e) {}
    player.call('creator:start', [JSON.stringify({
        gender: genderOf(player),
        pos: CREATOR_POS,
        limits: {
            parents: HERITAGE_PARENTS, features: FEATURE_COUNT, hairMax: HAIR_MAX,
            palette: PALETTE, eyeColors: EYE_COLORS, overlays: OVERLAYS,
        },
    })]);
    console.log(`[creator] ${player.name} entering character creator`);
};

// ---- client confirm ----
mp.events.add('creator:save', async (player, blobJson) => {
    if (!player.creatorActive || !player.character) return;
    let raw;
    try { raw = JSON.parse(blobJson); } catch (e) { return player.call('creator:error', ['მონაცემები დაზიანებულია.']); }
    const look = validateAppearance(raw, genderOf(player));
    if (!look) return player.call('creator:error', ['იერსახის მონაცემები არასწორია.']);

    try {
        const character = await global.api.saveAppearance(player.character.id, look);
        player.character = character;           // now carries appearance
        player.creatorActive = false;
        player.dimension = 0;
        applyAppearance(player, look);
        // Hand off to auth, which either opens the spawn selector or spawns directly. Both the
        // 'auth:spawnSelect' and 'auth:enter' client events tear down the creator UI, so we don't
        // call 'creator:done' here (that would unfreeze before the spawn step).
        if (typeof global.authFinishSpawn === 'function') global.authFinishSpawn(player);
        else { try { player.spawn(player.position); } catch (e) {} player.call('creator:done'); }
        console.log(`[creator] ${player.name} saved appearance for character #${player.character.id}`);
    } catch (e) {
        console.log('[creator] save failed: ' + (e && e.message));
        player.call('creator:error', ['შენახვა ვერ მოხერხდა, სცადეთ თავიდან.']);
    }
});

// Re-apply the full look whenever the ped (re)spawns.
mp.events.add('playerSpawn', (player) => {
    if (global.creatorHasAppearance(player)) setTimeout(() => global.applyCreatorAppearance(player), 1500);
});
