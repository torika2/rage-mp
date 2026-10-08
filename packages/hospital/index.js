// ===================== Hospital =====================
// Death / timeout / revive system (see death.js) and the hospital respawn point.
//
// NOTE: the custom Pillbox map/interior work (Menyoo "No Roads" import + the pillbox_rescue
// ymap + server-side object spawning) was removed — it could not render (see
// docs/17-pillbox-hospital-interior.md). The visible hospital interior is the native GTA one,
// streamed by client_packages/interiors.js ("Open All Interiors"). Only the death/revive
// gameplay lives here now.

require('./death');
