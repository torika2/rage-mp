// ===================== Admin: add-on car handling editor =====================
// Reads/writes handling values directly inside each add-on car's dlc.rpf (RPF v7, unencrypted
// "OPEN" packs only). Handling is baked into the pack, so edits here only take effect after a
// server restart + client relaunch — RAGE:MP can't hot-reload handling. Exposed to the admin panel
// via global.carHandlingList() / global.carHandlingSave().
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DLC_DIR = path.join(__dirname, '..', '..', 'client_packages', 'game_resources', 'dlcpacks');

// Curated numeric handling fields (all stored as <field value="..."/> in handling.meta).
// Each: [field, min, max, isInt]
const FIELDS = [
    ['fMass', 200, 20000, false],
    ['fInitialDriveForce', 0.01, 2.0, false],
    ['fDriveInertia', 0.01, 2.0, false],
    ['fBrakeForce', 0.05, 5.0, false],
    ['fTractionCurveMax', 0.1, 10, false],
    ['fTractionCurveMin', 0.1, 10, false],
    ['fTractionCurveLateral', 1, 60, false],
    ['fTractionBiasFront', 0.01, 0.99, false],
    ['fLowSpeedTractionLossMult', 0, 5, false],
    ['fSteeringLock', 10, 90, false],
    ['fDriveBiasFront', 0, 1, false],
    ['nInitialDriveGears', 1, 10, true],
    ['fInitialDriveMaxFlatVel', 10, 600, false]
];
const FIELD_NAMES = FIELDS.map(f => f[0]);
const FIELD_META = Object.fromEntries(FIELDS.map(([name, min, max, isInt]) => [name, { min, max, isInt }]));

const MAGIC_RPF7 = 0x52504637;
const ENC_OPEN = 0x4e45504f;

function u24(buf, o) { return buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16); }
function w24(buf, o, v) { buf[o] = v & 0xff; buf[o + 1] = (v >> 8) & 0xff; buf[o + 2] = (v >> 16) & 0xff; }

// Read header + TOC + names + a named meta file, without loading the whole (tens of MB) rpf.
function readMeta(filePath, wanted) {
    const fd = fs.openSync(filePath, 'r');
    try {
        const head = Buffer.alloc(16);
        fs.readSync(fd, head, 0, 16, 0);
        if (head.readUInt32LE(0) !== MAGIC_RPF7) return null;
        const entryCount = head.readUInt32LE(4);
        const namesLen = head.readUInt32LE(8);
        const enc = head.readUInt32LE(12);
        if (enc !== ENC_OPEN) return { encrypted: true };
        const tocLen = entryCount * 16;
        const block = Buffer.alloc(16 + tocLen + namesLen);
        fs.readSync(fd, block, 0, block.length, 0);
        const names = block.slice(16 + tocLen, 16 + tocLen + namesLen);
        const nameAt = (o) => { let e = o; while (e < names.length && names[e] !== 0) e++; return names.toString('latin1', o, e); };
        const out = {};
        for (const key of wanted) {
            for (let i = 0; i < entryCount; i++) {
                const p = 16 + i * 16;
                if (block[p + 4] === 0x00 && block[p + 5] === 0xff && block[p + 6] === 0xff && block[p + 7] === 0x7f) continue; // dir
                if (nameAt(block.readUInt16LE(p)) !== key) continue;
                const size = u24(block, p + 2), offset = u24(block, p + 5) * 512;
                const raw = Buffer.alloc(size);
                fs.readSync(fd, raw, 0, size, offset);
                let xml;
                try { xml = zlib.inflateRawSync(raw); } catch (e) { try { xml = zlib.inflateSync(raw); } catch (e2) { xml = raw; } }
                out[key] = xml.toString('utf8');
                break;
            }
        }
        return out;
    } finally { fs.closeSync(fd); }
}

// Split handling.meta into per-car chunks keyed by <handlingName>. Nested <SubHandlingData> items
// stay inside their parent chunk because we split on the top-level CHandlingData item boundary.
function handlingChunks(xml) {
    const parts = xml.split(/(?=<Item type="CHandlingData")/);
    const cars = [];
    for (const part of parts) {
        const m = part.match(/<handlingName>([^<]*)<\/handlingName>/);
        if (!m) continue;
        const values = {};
        for (const field of FIELD_NAMES) {
            const fm = part.match(new RegExp('<' + field + ' value="([^"]*)"'));
            if (fm) values[field] = fm[1];
        }
        cars.push({ handlingName: m[1], values });
    }
    return cars;
}

// List every editable car across all OPEN add-on packs: [{ pack, handlingName, model, values }].
function list() {
    const result = [];
    let folders = [];
    try { folders = fs.readdirSync(DLC_DIR); } catch (e) { return result; }
    for (const pack of folders) {
        const rpf = path.join(DLC_DIR, pack, 'dlc.rpf');
        if (!fs.existsSync(rpf)) continue;
        let meta;
        try { meta = readMeta(rpf, ['handling.meta', 'vehicles.meta']); } catch (e) { continue; }
        if (!meta || meta.encrypted || !meta['handling.meta']) continue;
        const models = meta['vehicles.meta'] ? (meta['vehicles.meta'].match(/<modelName>([^<]*)<\/modelName>/g) || []).map(s => s.replace(/<\/?modelName>/g, '')) : [];
        for (const car of handlingChunks(meta['handling.meta'])) {
            result.push({ pack, handlingName: car.handlingName, model: models[0] || '', values: car.values });
        }
    }
    return result;
}

function formatValue(field, raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const meta = FIELD_META[field];
    const clamped = Math.max(meta.min, Math.min(meta.max, n));
    return meta.isInt ? String(Math.round(clamped)) : clamped.toFixed(6);
}

// Write edited values for one car. edits = { field: value }. Returns { ok, message }.
function save(pack, handlingName, edits) {
    if (!/^[A-Za-z0-9_]+$/.test(String(pack))) return { ok: false, message: 'Invalid pack name.' };
    const rpf = path.join(DLC_DIR, String(pack), 'dlc.rpf');
    if (!fs.existsSync(rpf)) return { ok: false, message: 'Pack not found.' };

    const applied = {};
    for (const field of FIELD_NAMES) {
        if (edits[field] === undefined || edits[field] === null || edits[field] === '') continue;
        const v = formatValue(field, edits[field]);
        if (v === null) return { ok: false, message: `Invalid value for ${field}.` };
        applied[field] = v;
    }
    if (!Object.keys(applied).length) return { ok: false, message: 'No valid fields to save.' };

    const buf = fs.readFileSync(rpf);
    if (buf.readUInt32LE(0) !== MAGIC_RPF7) return { ok: false, message: 'Not an RPF7 pack.' };
    if (buf.readUInt32LE(12) !== ENC_OPEN) return { ok: false, message: 'Pack is encrypted; cannot edit.' };
    const entryCount = buf.readUInt32LE(4);
    const namesLen = buf.readUInt32LE(8);
    const tocStart = 16, namesStart = 16 + entryCount * 16;
    const names = buf.slice(namesStart, namesStart + namesLen);
    const nameAt = (o) => { let e = o; while (e < names.length && names[e] !== 0) e++; return names.toString('latin1', o, e); };

    // locate handling.meta + compute its 512-aligned slot capacity (distance to the next file)
    let hp = -1, hSize = 0, hOff = 0;
    const offsets = [];
    for (let i = 0; i < entryCount; i++) {
        const p = tocStart + i * 16;
        if (buf[p + 4] === 0x00 && buf[p + 5] === 0xff && buf[p + 6] === 0xff && buf[p + 7] === 0x7f) continue;
        const off = u24(buf, p + 5) * 512;
        offsets.push(off);
        if (nameAt(buf.readUInt16LE(p)) === 'handling.meta') { hp = p; hSize = u24(buf, p + 2); hOff = off; }
    }
    if (hp < 0) return { ok: false, message: 'handling.meta not found in pack.' };
    let nextOff = buf.length;
    for (const o of offsets) if (o > hOff && o < nextOff) nextOff = o;
    const slotCap = nextOff - hOff;

    // edit the target car's chunk
    let xml;
    try { xml = zlib.inflateRawSync(buf.slice(hOff, hOff + hSize)).toString('utf8'); }
    catch (e) { return { ok: false, message: 'Could not read handling.meta.' }; }
    const chunks = xml.split(/(?=<Item type="CHandlingData")/);
    let found = false;
    for (let k = 0; k < chunks.length; k++) {
        const m = chunks[k].match(/<handlingName>([^<]*)<\/handlingName>/);
        if (!m || m[1] !== handlingName) continue;
        let blk = chunks[k];
        for (const field in applied) {
            blk = blk.replace(new RegExp('(<' + field + ' value=")[^"]*(")'), `$1${applied[field]}$2`);
        }
        chunks[k] = blk;
        found = true;
        break;
    }
    if (!found) return { ok: false, message: `Car "${handlingName}" not found in ${pack}.` };
    const newXml = Buffer.from(chunks.join(''), 'utf8');
    const comp = zlib.deflateRawSync(newXml, { level: 9 });
    if (comp.length > slotCap) return { ok: false, message: 'Edited handling too large for its slot (unchanged).' };

    // overwrite the slot in place + update TOC size / uncompressed size, then atomic replace
    comp.copy(buf, hOff);
    buf.fill(0, hOff + comp.length, hOff + slotCap);
    w24(buf, hp + 2, comp.length);
    buf.writeUInt32LE(newXml.length, hp + 8);
    const tmp = rpf + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, rpf);
    return { ok: true, message: `Saved ${Object.keys(applied).length} field(s) to ${pack}/${handlingName}. Restart server + reconnect to apply.` };
}

module.exports = { list, save, FIELDS, FIELD_NAMES };
