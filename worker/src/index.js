/* ══════════════════════════════════════════════════════════════════════════════
   Sofa Club — Worker de Cloudflare
   ------------------------------------------------------------------------------
   Es la única pieza que conoce el token de GitHub. Los navegadores nunca lo ven:
   cada persona sostiene un secreto propio que sólo sirve para hablar con aquí.

   Tres garantías, por construcción y no por buena fe:

   1. IDENTIDAD. Las operaciones personales (nota, ganas, comentarios, perfil) no
      llevan parámetro de usuario: el autor lo pone el servidor a partir del
      secreto. Suplantar a otro no está prohibido, es que no se puede expresar.

   2. GRUPOS. El grupo va dentro del secreto y determina qué archivo se abre. Un
      secreto del grupo A no puede nombrar el archivo del grupo B.

   3. METADATOS. Al añadir un título sólo se acepta el id de TMDB; la ficha la
      trae el Worker. El cliente no puede inyectar ni un título.
   ══════════════════════════════════════════════════════════════════════════════ */

const GH = 'https://api.github.com';
const TMDB = 'https://api.themoviedb.org/3';
const VERSION = 3;

/* ── utilidades ─────────────────────────────────────────────────────────────── */
const nowIso = () => new Date().toISOString();
const uid = (p) => p + [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(36)).join('').slice(0, 10);
const randomSecret = () => [...crypto.getRandomValues(new Uint8Array(24))]
  .map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

async function sha256(s){
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/* comparación en tiempo constante: no queremos filtrar nada por lo que tarda */
function sameHash(a, b){
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const b64enc = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64dec = (b64) => {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
};

class Fallo extends Error {
  constructor(status, code, msg){ super(msg || code); this.status = status; this.code = code; }
}

/* ── saneado de lo que llega del cliente ────────────────────────────────────── */
const GROUP_OK = /^[a-z0-9][a-z0-9-]{1,30}$/;
const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES = ['wish', 'watching', 'done', 'dropped'];
const okId = (s) => (ID_OK.test(String(s || '')) ? String(s) : null);
const okStr = (s, max) => String(s == null ? '' : s).slice(0, max);
const okInt = (v, a, b) => { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(a, Math.min(b, n)) : null; };
const okColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c) : '#8B85A8');
const okEmoji = (e) => (String(e == null ? '' : e).replace(/[^\p{Extended_Pictographic}\p{L}\p{N}]/gu, '').slice(0, 4) || '\u{1F464}');
const okName = (n) => (okStr(n, 40).trim() || 'Alguien');

/* ── acceso al repositorio ──────────────────────────────────────────────────── */
function repoPath(env, group){ return 'data/' + group + '.json'; }
function ghHeaders(env){
  return { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sofa-club-worker' };
}
async function leerGrupo(env, group){
  const url = GH + '/repos/' + env.REPO + '/contents/' + repoPath(env, group) + '?ref=' + encodeURIComponent(env.BRANCH || 'main');
  const r = await fetch(url, { headers: ghHeaders(env), cf: { cacheTtl: 0 } });
  if (r.status === 404) return { doc: null, sha: null };
  if (!r.ok) throw new Fallo(502, 'github', 'GitHub respondió ' + r.status);
  const j = await r.json();
  return { doc: JSON.parse(b64dec(j.content || '')), sha: j.sha };
}
async function escribirGrupo(env, group, doc, sha, mensaje){
  const url = GH + '/repos/' + env.REPO + '/contents/' + repoPath(env, group);
  const body = { message: mensaje || ('sofa club · ' + group), branch: env.BRANCH || 'main',
    content: b64enc(JSON.stringify(doc, null, 1)) };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(env)), body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) throw new Fallo(409, 'conflicto');
  if (!r.ok) throw new Fallo(502, 'github', 'GitHub respondió ' + r.status);
  const j = await r.json();
  return j.content && j.content.sha;
}
/* lee, aplica el cambio y guarda; si otro se adelantó, vuelve a intentarlo */
async function conGrupo(env, group, fn){
  for (let intento = 0; intento < 4; intento++){
    const { doc, sha } = await leerGrupo(env, group);
    if (!doc) throw new Fallo(404, 'sin-grupo');
    const extra = await fn(doc);
    doc.updatedAt = nowIso();
    try { await escribirGrupo(env, group, doc, sha); return { doc, extra }; }
    catch (e){
      if (e.code === 'conflicto' && intento < 3){ await new Promise((r) => setTimeout(r, 120 * (intento + 1))); continue; }
      throw e;
    }
  }
  throw new Fallo(409, 'conflicto');
}

/* ── vista que se manda al navegador: sin secretos, jamás ───────────────────── */
function vistaPublica(doc, me){
  return {
    group: doc.group, me: me, owner: doc.owner,
    users: (doc.users || []).filter((u) => !u.deletedAt).map((u) => ({
      id: u.id, name: u.name, emoji: u.emoji, color: u.color, joinedAt: u.joinedAt, active: true,
    })),
    items: (doc.items || []).filter((i) => !i.deletedAt).map((i) => {
      const c = Object.assign({}, i);
      c.notes = (i.notes || []).filter((n) => !n.deletedAt);
      delete c.deletedAt;
      return c;
    }),
  };
}

/* ── identidad: del secreto a la persona ────────────────────────────────────── */
function partirSecreto(secreto){
  const s = String(secreto || '');
  const i = s.indexOf('.');
  if (i < 1) return null;
  const group = s.slice(0, i), resto = s.slice(i + 1);
  if (!GROUP_OK.test(group) || resto.length < 16) return null;
  return { group, resto };
}
async function identificar(env, req){
  const auth = req.headers.get('Authorization') || '';
  const secreto = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const partes = partirSecreto(secreto);
  if (!partes) throw new Fallo(401, 'sin-clave');
  const { doc, sha } = await leerGrupo(env, partes.group);
  if (!doc) throw new Fallo(401, 'sin-clave');
  const hash = await sha256(partes.resto);
  const yo = (doc.users || []).find((u) => !u.deletedAt && sameHash(u.secretHash, hash));
  if (!yo) throw new Fallo(401, 'sin-clave');
  return { group: partes.group, me: yo.id, doc, sha };
}

/* ── TMDB (el token también vive sólo aquí) ─────────────────────────────────── */
async function tmdb(env, path, params){
  if (!env.TMDB_TOKEN) throw new Fallo(503, 'sin-tmdb');
  const p = new URLSearchParams(Object.assign({ language: 'es-ES' }, params || {}));
  const url = TMDB + path + '?' + p;
  const cache = caches.default;
  const clave = new Request(url, { method: 'GET' });
  let r = await cache.match(clave);
  if (!r){
    r = await fetch(url, { headers: { Authorization: 'Bearer ' + env.TMDB_TOKEN, Accept: 'application/json' } });
    if (!r.ok) throw new Fallo(502, 'tmdb', 'TMDB respondió ' + r.status);
    r = new Response(r.body, r);
    r.headers.set('Cache-Control', 'max-age=21600');   // seis horas
    await cache.put(clave, r.clone());
  }
  return r.json();
}
async function fichaTmdb(env, type, id){
  const d = await tmdb(env, '/' + type + '/' + id, { append_to_response: 'watch/providers' });
  const seasons = type === 'tv'
    ? (d.seasons || []).filter((s) => s.season_number > 0).map((s) => ({ number: s.season_number, episodes: s.episode_count }))
    : null;
  const wp = (d['watch/providers'] && d['watch/providers'].results && d['watch/providers'].results.ES) || {};
  const vistos = {};
  const providers = [].concat(wp.flatrate || [], wp.free || [])
    .map((p) => ({ name: okStr(p.provider_name, 40), logo: p.logo_path }))
    .filter((p) => p.name && !vistos[p.name] && (vistos[p.name] = 1)).slice(0, 6);
  return {
    tmdbId: d.id, type,
    title: okStr(d.title || d.name, 160) || 'Sin título',
    originalTitle: okStr(d.original_title || d.original_name || d.title || d.name, 160),
    year: Number(String(d.release_date || d.first_air_date || '').slice(0, 4)) || null,
    poster: d.poster_path || null,
    genres: (d.genres || []).slice(0, 8).map((g) => okStr(g.name, 40)),
    overview: okStr(d.overview, 1200),
    runtime: type === 'movie' ? (d.runtime || 0) : ((d.episode_run_time && d.episode_run_time[0]) || 45),
    seasons: seasons && seasons.length ? seasons : null,
    totalEpisodes: seasons && seasons.length ? seasons.reduce((a, s) => a + s.episodes, 0) : null,
    providers, providersCheckedAt: nowIso(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   OPERACIONES
   Cada una recibe (doc, me, args, env). Fíjate en lo que NO reciben: ninguna
   operación personal acepta un identificador de usuario. El «quién» sale del
   secreto y no viaja en la petición.
   ══════════════════════════════════════════════════════════════════════════════ */
const buscarItem = (doc, id) => (doc.items || []).find((i) => i.id === id && !i.deletedAt);
const miembro = (doc, id) => (doc.users || []).find((u) => u.id === id && !u.deletedAt);
function siguienteOrden(doc, status){
  let max = 0;
  (doc.items || []).forEach((i) => Object.values(i.participants || {}).forEach((p) => { if (p.status === status) max = Math.max(max, p.order || 0); }));
  return max + 1024;
}
function nuevaParte(status, o){
  return { status, order: o.order, progress: o.progress || null, hype: o.hype != null ? o.hype : 2,
    rating: null, startedAt: status === 'wish' ? null : nowIso(),
    finishedAt: (status === 'done' || status === 'dropped') ? nowIso() : null, updatedAt: nowIso() };
}
const sellar = (it, u) => { if (it.participants[u]) it.participants[u].updatedAt = nowIso(); it.updatedAt = nowIso(); };
/* sólo se aceptan personas que estén de verdad en este grupo */
const delGrupo = (doc, ids) => (Array.isArray(ids) ? ids : []).map(okId).filter((id) => id && miembro(doc, id));

const OPS = {
  async addItem(doc, me, a, env){
    const tmdbId = okInt(a.tmdbId, 1, 99999999);
    const type = a.type === 'movie' ? 'movie' : 'tv';
    const status = STATUSES.indexOf(a.status) >= 0 ? a.status : 'wish';
    const hype = okInt(a.hype, 1, 3) || 2;
    if (!tmdbId) throw new Fallo(400, 'datos');
    let it = (doc.items || []).find((i) => i.tmdbId === tmdbId && !i.deletedAt);
    if (!it){
      const ficha = await fichaTmdb(env, type, tmdbId);       // la ficha la trae el servidor
      it = Object.assign({ id: uid('itm_'), addedBy: me, addedAt: nowIso(), participants: {}, notes: [], deletedAt: null }, ficha);
      doc.items = [it].concat(doc.items || []);
    }
    if (!it.participants[me]) it.participants[me] = nuevaParte(status, { order: siguienteOrden(doc, status), hype });
    it.updatedAt = nowIso();
    return { itemId: it.id };
  },
  async removeItem(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    it.deletedAt = nowIso(); it.updatedAt = nowIso();
  },
  /* estado y progreso SÍ son compartidos: es el contrato del colapso. Mover una
     tarjeta colapsada mueve a todo el que esté dentro, y eso es la app. */
  async setStatus(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const status = STATUSES.indexOf(a.status) >= 0 ? a.status : null; if (!status) throw new Fallo(400, 'datos');
    const orden = siguienteOrden(doc, status);
    delGrupo(doc, a.userIds).forEach((u) => {
      const p = it.participants[u]; if (!p) return;
      p.status = status; p.order = orden;
      if (status === 'watching' && it.type === 'tv' && !p.progress) p.progress = { s: 1, e: 0 };
      if (status === 'wish'){ p.progress = null; p.rating = null; p.finishedAt = null; }
      if (status === 'done' || status === 'dropped') p.finishedAt = nowIso();
      if (status === 'watching'){ p.startedAt = p.startedAt || nowIso(); p.finishedAt = null; }
      sellar(it, u);
    });
  },
  async setProgress(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const s = okInt(a.progress && a.progress.s, 1, 200), e = okInt(a.progress && a.progress.e, 0, 2000);
    if (s == null || e == null) throw new Fallo(400, 'datos');
    delGrupo(doc, a.userIds).forEach((u) => { const p = it.participants[u]; if (!p) return; p.progress = { s, e }; sellar(it, u); });
  },
  /* ── de aquí abajo, sólo sobre uno mismo: no hay parámetro que decir otra cosa ── */
  async splitOut(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const p = it.participants[me]; if (!p) throw new Fallo(400, 'no-estas');
    p.order = siguienteOrden(doc, p.status); sellar(it, me);
  },
  async joinUsers(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const target = okId(a.target); if (!target || !miembro(doc, target)) throw new Fallo(400, 'datos');
    const t = it.participants[target]; if (!t) throw new Fallo(400, 'datos');
    const mia = it.participants[me] || nuevaParte(t.status, { order: t.order });
    it.participants[me] = Object.assign({}, mia, { status: t.status, order: t.order, progress: t.progress ? Object.assign({}, t.progress) : null });
    sellar(it, me);
  },
  async setHype(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const v = okInt(a.value, 1, 3); if (v == null) throw new Fallo(400, 'datos');
    const p = it.participants[me]; if (!p) throw new Fallo(400, 'no-estas');
    p.hype = v; sellar(it, me);
  },
  async setRating(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const v = okInt(a.value, 1, 5); if (v == null) throw new Fallo(400, 'datos');
    const p = it.participants[me]; if (!p) throw new Fallo(400, 'no-estas');
    p.rating = v; sellar(it, me);
  },
  async addNote(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const text = okStr(a.text, 600).trim(); if (!text) throw new Fallo(400, 'datos');
    it.notes = (it.notes || []).concat([{ id: uid('n_'), by: me, text, at: nowIso(), deletedAt: null }]);
    it.updatedAt = nowIso();
  },
  async removeNote(doc, me, a){
    const it = buscarItem(doc, okId(a.id)); if (!it) throw new Fallo(404, 'sin-item');
    const n = (it.notes || []).find((x) => x.id === okId(a.noteId) && !x.deletedAt);
    if (!n) throw new Fallo(404, 'sin-nota');
    if (n.by !== me) throw new Fallo(403, 'no-es-tuya');       // sólo se borran las propias
    n.deletedAt = nowIso(); it.updatedAt = nowIso();
  },
  async updateProfile(doc, me, a){
    const u = miembro(doc, me); if (!u) throw new Fallo(401, 'sin-clave');
    u.name = okName(a.name); u.emoji = okEmoji(a.emoji); u.color = okColor(a.color); u.updatedAt = nowIso();
  },
  async removeUser(doc, me, a){
    const id = okId(a.userId); if (!id) throw new Fallo(400, 'datos');
    if (id !== me && doc.owner !== me) throw new Fallo(403, 'solo-quien-lo-creo');
    if (id === doc.owner && me !== doc.owner) throw new Fallo(403, 'solo-quien-lo-creo');
    const u = miembro(doc, id); if (!u) throw new Fallo(404, 'sin-persona');
    u.deletedAt = nowIso(); u.secretHash = null;               // su clave deja de valer al instante
    (doc.items || []).forEach((i) => { if (i.participants[id]){ delete i.participants[id]; i.updatedAt = nowIso(); } });
  },
  async createInvite(doc, me, a, env){
    const resto = randomSecret();
    doc.invites = (doc.invites || []).filter((i) => !i.usedAt && new Date(i.expiresAt) > new Date()).slice(-20);
    doc.invites.push({ codeHash: await sha256(resto), by: me, createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), usedAt: null });
    return { url: (env.APP_URL || '') + '#i=' + doc.group + '.' + resto };
  },
};

/* ══════════════════════════════════════════════════════════════════════════════
   RUTAS
   ══════════════════════════════════════════════════════════════════════════════ */
function cors(env, req){
  const origen = req.headers.get('Origin') || '';
  const permitidos = (env.APP_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = permitidos.indexOf(origen) >= 0;
  return {
    'Access-Control-Allow-Origin': ok ? origen : (permitidos[0] || 'null'),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const json = (data, status, cabeceras) =>
  new Response(JSON.stringify(data), { status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cabeceras || {}) });

export default {
  async fetch(req, env){
    const cab = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cab });
    const url = new URL(req.url);
    const ruta = url.pathname.replace(/\/+$/, '') || '/';

    try {
      /* — crear un grupo. Sólo tú, con la clave de administración. — */
      if (ruta === '/admin/group' && req.method === 'POST'){
        if (!env.ADMIN_KEY || !sameHash(await sha256(req.headers.get('X-Admin-Key') || ''), await sha256(env.ADMIN_KEY)))
          throw new Fallo(401, 'sin-permiso');
        const body = await req.json();
        const group = String(body.group || '').toLowerCase();
        if (!GROUP_OK.test(group)) throw new Fallo(400, 'nombre-de-grupo', 'minúsculas, números y guiones, de 2 a 31 caracteres');
        const existente = await leerGrupo(env, group);
        if (existente.doc) throw new Fallo(409, 'ya-existe');
        const resto = randomSecret();
        const yo = { id: uid('u_'), name: okName(body.ownerName), emoji: okEmoji(body.ownerEmoji || '🐻'),
          color: okColor(body.ownerColor || '#FF8FD0'), joinedAt: nowIso(), secretHash: await sha256(resto), deletedAt: null };
        const doc = { version: VERSION, group, createdAt: nowIso(), updatedAt: nowIso(), owner: yo.id, users: [yo], invites: [], items: [] };
        await escribirGrupo(env, group, doc, null, 'sofa club · nace el grupo ' + group);
        return json({ group, link: (env.APP_URL || '') + '#s=' + group + '.' + resto }, 200, cab);
      }

      /* — entrar con tu secreto — */
      if (ruta === '/api/session' && req.method === 'POST'){
        const { group, me, doc } = await identificar(env, req);
        return json({ state: vistaPublica(doc, me), group }, 200, cab);
      }

      /* — unirse con una invitación de un solo uso — */
      if (ruta === '/api/join' && req.method === 'POST'){
        const body = await req.json();
        const partes = partirSecreto(body.invite);
        if (!partes) throw new Fallo(400, 'invitacion-invalida');
        const hash = await sha256(partes.resto);
        let secreto = null, meId = null;
        const { doc } = await conGrupo(env, partes.group, async (d) => {
          const inv = (d.invites || []).find((i) => !i.usedAt && sameHash(i.codeHash, hash) && new Date(i.expiresAt) > new Date());
          if (!inv) throw new Fallo(401, 'invitacion-invalida');
          inv.usedAt = nowIso();
          const resto = randomSecret();
          const u = { id: uid('u_'), name: okName(body.name), emoji: okEmoji(body.emoji), color: okColor(body.color),
            joinedAt: nowIso(), secretHash: await sha256(resto), deletedAt: null };
          d.users.push(u);
          secreto = partes.group + '.' + resto; meId = u.id;
        });
        return json({ secret: secreto, group: partes.group, state: vistaPublica(doc, meId) }, 200, cab);
      }

      /* — una operación sobre el tablero — */
      if (ruta === '/api/op' && req.method === 'POST'){
        const { group, me } = await identificar(env, req);
        const body = await req.json();
        const op = OPS[String(body.op || '')];
        if (!op) throw new Fallo(400, 'operacion-desconocida');
        const { doc, extra } = await conGrupo(env, group, async (d) => {
          if (!miembro(d, me)) throw new Fallo(401, 'sin-clave');    // te han podido quitar entre medias
          return op(d, me, body.args || {}, env);
        });
        return json(Object.assign({ state: vistaPublica(doc, me) }, extra || {}), 200, cab);
      }

      /* — buscador de TMDB, con el token a este lado — */
      if (ruta === '/api/search' && req.method === 'GET'){
        await identificar(env, req);
        const q = okStr(url.searchParams.get('q'), 120).trim();
        if (!q) return json({ results: [] }, 200, cab);
        const j = await tmdb(env, '/search/multi', { query: q, include_adult: 'false', page: '1' });
        const results = (j.results || [])
          .filter((r) => r.media_type === 'tv' || r.media_type === 'movie')
          .slice(0, 14)
          .map((r) => ({ tmdbId: r.id, type: r.media_type,
            title: okStr(r.title || r.name, 160), originalTitle: okStr(r.original_title || r.original_name || r.title || r.name, 160),
            year: Number(String(r.release_date || r.first_air_date || '').slice(0, 4)) || null,
            poster: r.poster_path || null }));
        return json({ results }, 200, cab);
      }

      /* — refresco de plataformas, en segundo plano — */
      if (ruta === '/api/refresh' && req.method === 'POST'){
        const { group, me } = await identificar(env, req);
        const { doc } = await conGrupo(env, group, async (d) => {
          const corte = Date.now() - 7 * 86400000;
          const viejos = (d.items || []).filter((i) => !i.deletedAt && i.tmdbId
            && (!i.providersCheckedAt || new Date(i.providersCheckedAt) < corte)).slice(0, 6);
          for (const it of viejos){
            try { const f = await fichaTmdb(env, it.type, it.tmdbId); it.providers = f.providers; it.providersCheckedAt = f.providersCheckedAt; }
            catch (e){ break; }
          }
        });
        return json({ state: vistaPublica(doc, me) }, 200, cab);
      }

      return json({ error: 'sin-ruta' }, 404, cab);
    } catch (e){
      const status = e instanceof Fallo ? e.status : 500;
      const code = e instanceof Fallo ? e.code : 'error';
      if (status >= 500) console.error(e);
      return json({ error: code, detalle: e instanceof Fallo ? e.message : undefined }, status, cab);
    }
  },
};
