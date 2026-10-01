// ===================== Open All Interiors (IPL loader + blips) =====================
// RAGE:MP equivalent of NewTheft's "Open All Interiors" ScriptHookV .asi mod.
// The .asi can't run under RAGE:MP, so instead each client requests the same
// interior IPLs (Interior Proxy Library map data) that the mod enables, removes the
// "fake/closed/off-mission" IPL variants that would block them, and drops a map blip
// at each interior entrance. Purely client-side/visual — no server authority needed.
//
// Press F7 in-game to toggle the interior blips on/off (same key as the original mod).

// --- IPLs to request (open the interiors) ---
const REQUEST_IPLS = [
    'ex_dt1_02_office_02b', 'chop_props', 'FIBlobby', 'FBI_colPLUG',
    'FBI_repair', 'v_tunnel_hole', 'TrevorsMP', 'TrevorsTrailer',
    'TrevorsTrailerTidy', 'farm', 'farmint', 'farm_lod',
    'farm_props', 'facelobby', 'CS1_02_cf_onmission1', 'CS1_02_cf_onmission2',
    'CS1_02_cf_onmission3', 'CS1_02_cf_onmission4', 'v_rockclub', 'v_janitor',
    'bkr_bi_hw1_13_int', 'ufo', 'ufo_lod', 'ufo_eye',
    'csr_afterMission', 'v_carshowroom', 'shr_int', 'shutter_closed',
    'smboat', 'smboat_distantlights', 'smboat_lod', 'smboat_lodlights',
    'cargoship', 'railing_start', 'sp1_10_real_interior', 'sp1_10_real_interior_lod',
    'id2_14_during1', 'coronertrash', 'Coroner_Int_on', 'refit_unload',
    'post_hiest_unload', 'Carwash_with_spinners', 'KT_CarWash', 'ferris_finale_Anim',
    'ch1_02_open', 'AP1_04_TriAf01', 'CS2_06_TriAf02', 'CS4_04_TriAf03',
    'scafendimap', 'DT1_05_HC_REQ', 'DT1_05_REQUEST', 'dt1_05_hc_remove',
    'dt1_05_hc_remove_lod', 'FINBANK', 'golfflags', 'airfield',
    'v_garages', 'v_foundry', 'hei_yacht_heist', 'hei_yacht_heist_Bar',
    'hei_yacht_heist_Bedrm', 'hei_yacht_heist_Bridge', 'hei_yacht_heist_DistantLights', 'hei_yacht_heist_enginrm',
    'hei_yacht_heist_LODLights', 'hei_yacht_heist_Lounge', 'hei_carrier', 'hei_Carrier_int1',
    'hei_Carrier_int2', 'hei_Carrier_int3', 'hei_Carrier_int4', 'hei_Carrier_int5',
    'hei_Carrier_int6', 'hei_carrier_LODLights', 'bkr_bi_id1_23_door', 'lr_cs6_08_grave_closed',
    'hei_sm_16_interior_v_bahama_milo_', 'CS3_07_MPGates', 'cs5_4_trains', 'v_lesters',
    'v_trevors', 'v_michael', 'v_comedy', 'v_cinema',
    'V_Sweat', 'V_35_Fireman', 'redCarpet', 'triathlon2_VBprops',
    'jetstenativeurnel', 'Jetsteal_ipl_grp1', 'v_hospital',
    'RC12B_HospitalInterior', 'canyonriver01', 'canyonriver01_lod', 'cs3_05_water_grp1',
    'cs3_05_water_grp1_lod', 'trv1_trail_start', 'CanyonRvrShallow', 'vw_casino_penthouse',
    'vw_casino_main', 'vw_casino_carpark', 'vw_dlc_casino_door', 'vw_casino_door',
    'hei_dlc_windows_casino', 'hei_dlc_casino_door', 'hei_dlc_casino_aircon', 'vw_casino_garage',
];

// --- IPLs to remove (fake shells / closed doors / off-mission variants) ---
const REMOVE_IPLS = [
    'FIBlobbyfake', 'farm_burnt', 'farm_burnt_lod', 'farm_burnt_props',
    'farmint_cap', 'farmint_cap_lod', 'CS1_02_cf_offmission', 'hei_bi_hw1_13_door',
    'shutter_open', 'sp1_10_fake_interior', 'sp1_10_fake_interior_lod', 'id2_14_during_door',
    'id2_14_during2', 'id2_14_on_fire', 'id2_14_post_no_int', 'id2_14_pre_no_int',
    'Coroner_Int_off', 'bh1_16_refurb', 'jewel2fake', 'bh1_16_doors_shut',
    'ch1_02_closed', 'scafstartimap', 'DT1_05_HC_REMOVE', 'DT1_03_Shutter',
    'DT1_03_Gr_Closed', 'RC12B_Default', 'RC12B_Fixed',
];

// --- Map blips at interior entrances: { name, sprite, x, y, z } ---
const INTERIOR_BLIPS = [
    { name: 'Hospital', sprite: 61, x: 305.0, y: -583.0, z: 43.0 }, // Central LS Medical Center (v_hospital) — same Pillbox site as the custom Pill Box Hospital
    { name: 'Simeon\'s Showroom', sprite: 369, x: -47.162, y: -1115.333, z: 26.5 },
    { name: 'Trevor\'s Trailer', sprite: 40, x: 1985.481, y: 3828.768, z: 32.5 },
    { name: 'Jewel Store', sprite: 439, x: -637.202, y: -239.162, z: 38.1 },
    { name: 'Rooftop Construction', sprite: 402, x: -585.825, y: -282.72, z: 35.455 },
    { name: 'Heist Union Depository', sprite: 500, x: 2.697, y: -667.017, z: 16.131 },
    { name: 'Morgue', sprite: 274, x: 240.621, y: -1379.569, z: 33.742 },
    { name: 'Cluckin Bell', sprite: 478, x: -146.384, y: 6161.5, z: 30.206 },
    { name: 'Grapeseed\'s Farm', sprite: 350, x: 2447.9, y: 4973.4, z: 47.7 },
    { name: 'FIB', sprite: 475, x: 135.965, y: -761.74, z: 45.746 },
    { name: 'Lester\'s factory', sprite: 473, x: 716.84, y: -962.05, z: 31.59 },
    { name: 'Life Invader lobby', sprite: 475, x: -1047.9, y: -233.0, z: 39.0 },
    { name: 'Carwash', sprite: 100, x: 55.7, y: -1391.3, z: 30.5 },
    { name: 'Fame Or Shame', sprite: 475, x: -248.492, y: -2010.509, z: 34.574 },
    { name: 'Mission House', sprite: 350, x: -3086.428, y: 339.252, z: 6.372 },
    { name: 'Mod Shop', sprite: 446, x: 970.275, y: -1826.57, z: 31.115 },
    { name: 'Grave', sprite: 274, x: -282.464, y: 2835.845, z: 55.914 },
    { name: 'The Lost Clubhouse', sprite: 494, x: 984.155, y: -95.366, z: 74.5 },
    { name: 'Heist Aircraft Carrier', sprite: 455, x: 3082.312, y: -4717.119, z: 15.262 },
    { name: 'Heist Yacht', sprite: 455, x: -2043.974, y: -1031.582, z: 11.981 },
    { name: 'Red Carpet', sprite: 409, x: 300.593, y: 199.759, z: 104.378 },
    { name: 'Bahama Mamas', sprite: 93, x: -1389.15, y: -585.809, z: 30.22 },
];

function applyIpls() {
    for (const ipl of REQUEST_IPLS) { try { mp.game.streaming.requestIpl(ipl); } catch (e) {} }
    for (const ipl of REMOVE_IPLS)  { try { mp.game.streaming.removeIpl(ipl);  } catch (e) {} }
}

// --- Blip management (F7 toggles) ---
let blipHandles = [];
let blipsShown = false;

function showBlips() {
    if (blipsShown) return;
    for (const b of INTERIOR_BLIPS) {
        try {
            const blip = mp.blips.new(b.sprite, new mp.Vector3(b.x, b.y, b.z), {
                name: b.name,
                scale: 0.85,
                color: 0,          // sprite's native colour
                shortRange: true,  // only draw when the player is nearby (less map clutter)
                dimension: 0
            });
            blipHandles.push(blip);
        } catch (e) {}
    }
    blipsShown = true;
}

function hideBlips() {
    for (const blip of blipHandles) { try { if (blip && mp.blips.exists(blip)) blip.destroy(); } catch (e) {} }
    blipHandles = [];
    blipsShown = false;
}

function toggleBlips() { blipsShown ? hideBlips() : showBlips(); }

// Initial setup shortly after the client starts (give streaming a moment to be ready).
setTimeout(() => {
    applyIpls();
    showBlips();
    mp.console.logInfo(`[interiors] ${REQUEST_IPLS.length} IPLs requested, ${INTERIOR_BLIPS.length} blips placed`);
}, 3000);

// Re-apply IPLs after every (re)spawn so interiors stay open across respawns/teleports.
mp.events.add('playerSpawn', applyIpls);

// F7 (VK 0x76) toggles the interior blips, matching the original mod's default key.
mp.keys.bind(0x76, false, toggleBlips);
