/* =============================================================================
   Calculadora Pro · capa Supabase (auth + datos en la nube + gating)

   Es OPCIONAL y no invasiva: si no hay config (config.js) o no está cargada la
   librería de Supabase, `CRDSupabase.enabled()` devuelve false y la app sigue
   en modo demo/localStorage exactamente como hoy. Cuando configuras las llaves,
   se activa el login real, la sincronización en la nube y el control de acceso.

   Requiere, ANTES de este archivo en el HTML:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="config.js"></script>   // define window.CRD_CONFIG
   ========================================================================== */
(function () {
  'use strict';

  var cfg = (typeof window !== 'undefined' && window.CRD_CONFIG) || {};
  var lib = (typeof window !== 'undefined' && window.supabase) || null;   // UMD global de supabase-js
  var _client = null;

  function enabled() {
    return !!(lib && cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  function client() {
    if (!enabled()) return null;
    if (!_client) _client = lib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return _client;
  }

  /* ---- mapeo app (camelCase) ↔ DB (snake_case) para `proyectos` ------------ */
  var PROJ_MAP = {
    name: 'nombre', location: 'ubicacion', moneda: 'moneda', valor: 'valor',
    inicialPct: 'inicial_pct', planMeses: 'plan_meses', valorizacion: 'valorizacion',
    entryModel: 'entry_model', entradaPremium: 'entrada_premium', exitStrategy: 'exit_strategy',
    rentaBruta: 'renta_bruta', ocupacion: 'ocupacion', costoCierre: 'costo_cierre', margenError: 'margen_error',
    vehiculo: 'vehiculo', taxRate: 'tax_rate', diferimiento: 'diferimiento', devaluacion: 'devaluacion',
    finType: 'fin_type', finTasa: 'fin_tasa', finPlazo: 'fin_plazo', p5: 'p5'
  };
  var PROJ_MAP_INV = (function () { var o = {}; for (var k in PROJ_MAP) o[PROJ_MAP[k]] = k; return o; })();

  function projToDb(p, usuarioId, orden) {
    var row = { usuario_id: usuarioId };
    if (p.id && /^[0-9a-f-]{36}$/i.test(p.id)) row.id = p.id;   // conserva UUID; ids locales se generan en la DB
    for (var k in PROJ_MAP) if (p[k] !== undefined) row[PROJ_MAP[k]] = p[k];
    if (orden != null) row.orden = orden;
    return row;
  }
  function projFromDb(row) {
    var p = { id: row.id };
    for (var col in PROJ_MAP_INV) if (row[col] !== undefined && row[col] !== null) p[PROJ_MAP_INV[col]] = row[col];
    return p;
  }

  var SIT_FIELDS = ['ingreso', 'gasto', 'deudas', 'capital', 'horizonte'];

  /* ---- Auth ---------------------------------------------------------------- */
  function signIn(email, password) {
    return client().auth.signInWithPassword({ email: email, password: password })
      .then(function (r) { if (r.error) throw r.error; return r.data.user; });
  }
  function signUp(email, password, nombre) {
    return client().auth.signUp({ email: email, password: password, options: { data: { nombre: nombre || '' } } })
      .then(function (r) { if (r.error) throw r.error; return r.data.user; });
  }
  function resetPassword(email) {
    return client().auth.resetPasswordForEmail(email).then(function (r) { if (r.error) throw r.error; return true; });
  }
  function signOut() { return client().auth.signOut(); }
  function currentUser() {
    return client().auth.getUser().then(function (r) { return r.data ? r.data.user : null; });
  }
  function onAuthChange(cb) {
    if (!enabled()) return;
    client().auth.onAuthStateChange(function (_evt, session) { cb(session ? session.user : null); });
  }

  /* ---- Gating (acceso) ----------------------------------------------------- */
  // Devuelve { allowed, reason }. reason: 'revocado' si pidió reembolso.
  function checkAccess(profile) {
    if (!profile) return { allowed: true, reason: null };            // sin perfil todavía → deja pasar (se creará)
    if (profile.acceso_activo === false) return { allowed: false, reason: 'revocado' };
    return { allowed: true, reason: null };
  }

  /* ---- Perfil (situación personal) ---------------------------------------- */
  function loadProfile(uid) {
    return client().from('usuarios').select('*').eq('id', uid).single()
      .then(function (r) { return r.error ? null : r.data; });
  }
  function saveProfile(uid, state) {
    var row = { id: uid, idioma: state.lang };
    SIT_FIELDS.forEach(function (f) { if (state[f] !== undefined) row[f] = state[f]; });
    return client().from('usuarios').upsert(row).then(function (r) { if (r.error) throw r.error; return true; });
  }

  /* ---- Snapshot completo (sync total) -------------------------------------
     Guarda TODO el estado que no cabe en columnas (supuestos, shopping,
     portafolio, checklist, pestañas). Requiere una columna jsonb en `usuarios`:
       ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS snapshot jsonb;
     Si la columna no existe, el upsert falla silenciosamente (se ignora) y la
     app sigue funcionando con localStorage. */
  var SNAP_KEYS = ['perfilNombre', 'valorizacionEsp', 'gastoLibertad', 'rendRenta',
    'inflacion', 'view', 'panelTab', 'projTab', 'shopping', 'portafolio', 'checklist'];
  function saveSnapshot(uid, state) {
    var snap = {};
    SNAP_KEYS.forEach(function (k) { if (state[k] !== undefined) snap[k] = state[k]; });
    snap._ts = new Date().toISOString();
    return client().from('usuarios').upsert({ id: uid, snapshot: snap })
      .then(function (r) { if (r.error) throw r.error; return true; });
  }
  function loadSnapshot(uid) {
    return client().from('usuarios').select('snapshot').eq('id', uid).single()
      .then(function (r) { return (r.error || !r.data) ? null : r.data.snapshot; });
  }

  /* ---- Proyectos ----------------------------------------------------------- */
  function loadProjects(uid) {
    return client().from('proyectos').select('*').eq('usuario_id', uid).order('orden', { ascending: true })
      .then(function (r) { return r.error ? [] : (r.data || []).map(projFromDb); });
  }
  function upsertProject(uid, project, orden) {
    return client().from('proyectos').upsert(projToDb(project, uid, orden)).select().single()
      .then(function (r) { if (r.error) throw r.error; return projFromDb(r.data); });
  }
  function deleteProject(id) {
    return client().from('proyectos').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; return true; });
  }
  // Guarda todos los proyectos del estado (para sincronizar el orden en bloque).
  function saveAllProjects(uid, projects) {
    var rows = projects.map(function (p, i) { return projToDb(p, uid, i); });
    return client().from('proyectos').upsert(rows).then(function (r) { if (r.error) throw r.error; return true; });
  }

  window.CRDSupabase = {
    enabled: enabled, client: client,
    signIn: signIn, signUp: signUp, resetPassword: resetPassword, signOut: signOut,
    currentUser: currentUser, onAuthChange: onAuthChange, checkAccess: checkAccess,
    loadProfile: loadProfile, saveProfile: saveProfile,
    saveSnapshot: saveSnapshot, loadSnapshot: loadSnapshot,
    loadProjects: loadProjects, upsertProject: upsertProject, deleteProject: deleteProject, saveAllProjects: saveAllProjects,
    _map: { projToDb: projToDb, projFromDb: projFromDb }
  };
})();
