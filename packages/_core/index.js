// ===================== _core: shared command registry + chat redirect =====================
// Loads before other packages (name sorts first). Two jobs:
//  1) Wrap mp.events.addCommand so every command is recorded in a registry the custom chat dispatches to.
//  2) Redirect player.outputChatBox(...) into the custom chat UI (native chat is hidden), so all the
//     existing command/system replies still appear.

global.commandRegistry = global.commandRegistry || {};

const _addCommand = mp.events.addCommand.bind(mp.events);
mp.events.addCommand = function (name, handler) {
    if (name && typeof name === 'object') {
        for (const key in name) {
            if (typeof name[key] === 'function') global.commandRegistry[key.toLowerCase()] = name[key];
        }
    } else if (typeof name === 'string' && typeof handler === 'function') {
        global.commandRegistry[name.toLowerCase()] = handler;
    }
    return _addCommand(name, handler);
};

global.runCommand = function (player, raw) {
    const text = String(raw).trim();
    if (text[0] !== '/') return false;
    const parts = text.slice(1).split(/\s+/);
    const name = (parts.shift() || '').toLowerCase();
    const handler = global.commandRegistry[name];
    if (!handler) { player.outputChatBox('!{#ff6b6b}უცნობი ბრძანება: /' + name); return true; }
    // Other packages can block commands for a player (e.g. packages/demorgan while serving a sentence).
    if (typeof global.commandGuard === 'function') {
        const blocked = global.commandGuard(player, name);
        if (blocked) { player.outputChatBox(blocked); return true; }
    }
    try { handler(player, parts.join(' '), ...parts); }
    catch (e) { player.outputChatBox('!{#ff6b6b}ბრძანების შეცდომა.'); }
    return true;
};

// Send a structured line into the custom chat UI.
global.chatSend = function (player, msg) {
    try { player.call('chat:in', [JSON.stringify(msg)]); } catch (e) {}
};

// Redirect outputChatBox -> custom chat (as a "system" line, keeping !{#hex} codes for the UI to parse).
try {
    if (mp.Player && mp.Player.prototype) {
        const proto = mp.Player.prototype;
        const _out = proto.outputChatBox;
        proto.outputChatBox = function (text) {
            global.chatSend(this, { ch: 'system', text: String(text), ts: Date.now() });
            // keep native as a fallback only if the custom chat isn't up yet (harmless; native is hidden client-side)
        };
        proto._outputChatBoxNative = _out;
    }
} catch (e) { console.log('[_core] outputChatBox redirect failed: ' + e); }

// ===================== Backend API client =====================
// Thin wrapper so any package can persist/load data via the NestJS API (which owns MySQL).
// Config (base URL + API key) lives in packages/_core/api.config.json (gitignored).
// IMPORTANT: don't call these on a hot per-tick path — cache in memory and persist on events
// (login, logout, purchase, periodic flush). See docs.
let apiConfig = { baseUrl: 'http://127.0.0.1:3000', apiKey: '' };
try {
    apiConfig = Object.assign(apiConfig, require('./api.config.json'));
} catch (e) {
    console.log('[_core] api.config.json missing — API client disabled until it is created.');
}

// Uses Node's built-in http (the RAGE:MP server's embedded Node predates global fetch).
const http = require('http');
const apiUrl = require('url').parse(apiConfig.baseUrl);

function apiRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const headers = { 'Authorization': 'Bearer ' + apiConfig.apiKey };
        if (payload !== null) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload);
        }
        const request = http.request({
            hostname: apiUrl.hostname,
            port: apiUrl.port,
            path,
            method,
            headers,
        }, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                const status = response.statusCode;
                if (status >= 200 && status < 300) {
                    resolve(data ? JSON.parse(data) : null);
                } else {
                    reject(new Error(`API ${method} ${path} -> ${status}`));
                }
            });
        });
        request.on('error', reject);
        if (payload !== null) request.write(payload);
        request.end();
    });
}

global.api = {
    get: (path) => apiRequest('GET', path),
    put: (path, body) => apiRequest('PUT', path, body),
    post: (path, body) => apiRequest('POST', path, body),
    patch: (path, body) => apiRequest('PATCH', path, body),

    // --- accounts ---
    register: (data) => apiRequest('POST', '/auth/register', data),
    login: (email, password) => apiRequest('POST', '/auth/login', { email, password }),
    loginBySocialClub: (socialClubName, password) => apiRequest('POST', '/auth/login-social', { socialClubName, password }),
    getUser: (id) => apiRequest('GET', `/users/${id}`),
    setEmailValidated: (id, value) => apiRequest('PATCH', `/users/${id}/email-validation`, { value }),
    setPhoneValidated: (id, value) => apiRequest('PATCH', `/users/${id}/phone-validation`, { value }),
    setUserType: (id, userType) => apiRequest('PATCH', `/users/${id}/type`, { userType }),
    setUserGender: (id, gender) => apiRequest('PATCH', `/users/${id}/gender`, { gender }),

    // --- characters (gameplay state) ---
    loadCharacter: (id) => apiRequest('GET', `/characters/${id}`),
    saveCharacter: (id, data) => apiRequest('PUT', `/characters/${id}`, data),
    saveAppearance: (id, appearance) => apiRequest('PUT', `/characters/${id}/appearance`, { appearance }),
    saveEquipment: (id, data) => apiRequest('PUT', `/characters/${id}/equipment`, { data }),
    saveClothing: (id, data) => apiRequest('PUT', `/characters/${id}/clothing`, { data }),
    saveTattoos: (id, data) => apiRequest('PUT', `/characters/${id}/tattoos`, { data }),
    saveLastPosition: (id, position) => apiRequest('PUT', `/characters/${id}/position`, { data: position }),

    // --- inventory ---
    loadInventory: (id) => apiRequest('GET', `/characters/${id}/inventory`),
    saveInventory: (id, slots) => apiRequest('PUT', `/characters/${id}/inventory`, { slots }),

    // --- item instances (owner + status: 'inventory' | 'dropped') ---
    loadItems: (characterId) => apiRequest('GET', `/characters/${characterId}/items`),
    createItem: (characterId, data) => apiRequest('POST', `/characters/${characterId}/items`, data),
    updateItem: (itemId, data) => apiRequest('PUT', `/items/${itemId}`, data),
    deleteItem: (itemId) => apiRequest('DELETE', `/items/${itemId}`),
    fraudLog: (limit) => apiRequest('GET', `/fraud-log${limit ? '?limit=' + limit : ''}`),

    // --- vehicles (ownership) ---
    loadVehicles: (id) => apiRequest('GET', `/characters/${id}/vehicles`),
    createVehicle: (id, data) => apiRequest('POST', `/characters/${id}/vehicles`, data),
    updateVehicle: (vehicleId, data) => apiRequest('PUT', `/vehicles/${vehicleId}`, data),
    deleteVehicle: (vehicleId) => apiRequest('DELETE', `/vehicles/${vehicleId}`),

    // --- houses ---
    loadHouses: () => apiRequest('GET', '/houses'),
    loadHouse: (houseId) => apiRequest('GET', `/houses/${houseId}`),
    createHouse: (data) => apiRequest('POST', '/houses', data),
    updateHouse: (houseId, data) => apiRequest('PUT', `/houses/${houseId}`, data),
    deleteHouse: (houseId) => apiRequest('DELETE', `/houses/${houseId}`),

    // --- parking ---
    loadParking: () => apiRequest('GET', '/parking'),
    saveParkingSpot: (spotId, data) => apiRequest('PUT', `/parking/${encodeURIComponent(spotId)}`, data),
    clearParkingSpot: (spotId) => apiRequest('DELETE', `/parking/${encodeURIComponent(spotId)}`),
};

mp.events.add('packagesLoaded', () => {
    console.log(`[_core] command registry ready: ${Object.keys(global.commandRegistry).length} commands`);
});
