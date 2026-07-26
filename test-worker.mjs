/* ══════════════════════════════════════════════════════════════════════════════
   Pruebas del Worker contra un GitHub y un TMDB de mentira, en memoria.
   Lo que se demuestra aquí es exactamente lo que se prometió:
     · nadie puede escribir en nombre de otro
     · un club no puede ver ni tocar otro
     · los metadatos los pone el servidor, no el cliente
     · los secretos no salen nunca del Worker
   ══════════════════════════════════════════════════════════════════════════════ */
import worker from './worker/src/index.js';

/* ── GitHub de mentira: cuatro archivos en un objeto ── */
const archivos = new Map();          // ruta → { texto, sha }
let shaSeq = 0;
const b64 = {
  enc: (s) => Buffer.from(s, 'utf8').toString('base64'),
  dec: (s) => Buffer.from(s, 'base64').toString('utf8'),
};

/* ── TMDB de mentira ── */
const FICHAS = {
  95396: { id: 95396, name: 'Separación', original_name: 'Severance', first_air_date: '2022-02-18',
    poster_path: '/sev.jpg', genres: [{ name: 'Drama' }], genre_ids: [18], vote_average: 8.4,
    overview: 'Memoria partida en dos.',
    episode_run_time: [47], seasons: [{ season_number: 0, episode_count: 3 }, { season_number: 1, episode_count: 9 }, { season_number: 2, episode_count: 10 }],
    'watch/providers': { results: { ES: { flatrate: [{ provider_name: 'Apple TV+', logo_path: '/a.jpg' }] } } } },
  915935: { id: 915935, title: 'Anatomía de una caída', original_title: "Anatomie d'une chute", release_date: '2023-08-23',
    poster_path: '/ana.jpg', genres: [{ name: 'Drama' }], genre_ids: [18], vote_average: 7.7,
    overview: 'Un juicio que es una autopsia.',
    runtime: 151, 'watch/providers': { results: { ES: {} } } },
};

/* plataformas tal y como las lista TMDB para España */
const PLATAFORMAS = [{ provider_id: 8, provider_name: 'Netflix' }, { provider_id: 350, provider_name: 'Apple TV+' }];

globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
const ultimoDiscover = {};           // con qué parámetros se llamó a /discover

globalThis.fetch = async (url, opts) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  const o = opts || {};
  if (u.hostname === 'api.github.com'){
    const ruta = decodeURIComponent(u.pathname.split('/contents/')[1] || '');
    if (o.method === 'PUT'){
      const body = JSON.parse(o.body);
      const actual = archivos.get(ruta);
      if (actual && body.sha !== actual.sha) return new Response('conflicto', { status: 409 });
      if (!actual && body.sha) return new Response('conflicto', { status: 409 });
      const sha = 'sha' + (++shaSeq);
      archivos.set(ruta, { texto: b64.dec(body.content), sha });
      return new Response(JSON.stringify({ content: { sha } }), { status: 200 });
    }
    const f = archivos.get(ruta);
    if (!f) return new Response('no', { status: 404 });
    return new Response(JSON.stringify({ content: b64.enc(f.texto), sha: f.sha }), { status: 200 });
  }
  if (u.hostname === 'api.themoviedb.org'){
    const crudo = (f) => ({ id: f.id, media_type: f.name ? 'tv' : 'movie', name: f.name, title: f.title,
      original_name: f.original_name, original_title: f.original_title,
      first_air_date: f.first_air_date, release_date: f.release_date, poster_path: f.poster_path,
      vote_average: f.vote_average, genre_ids: f.genre_ids });
    if (u.pathname.startsWith('/3/search/multi')){
      const q = (u.searchParams.get('query') || '').toLowerCase();
      const pag = Number(u.searchParams.get('page') || '1');
      const todas = Object.values(FICHAS)
        .filter((f) => ((f.name || f.title) + ' ' + (f.original_name || f.original_title)).toLowerCase().includes(q))
        .map(crudo);
      /* una ficha por página, y una persona colada en la primera: así se ve si
         el Worker pide la página que le han dicho y si filtra a las personas */
      const results = todas.slice(pag - 1, pag);
      if (pag === 1) results.push({ id: 999, media_type: 'person', name: 'Un actor famosísimo' });
      return new Response(JSON.stringify({ results, page: pag, total_pages: todas.length || 1 }), { status: 200 });
    }
    if (u.pathname.startsWith('/3/watch/providers/')){
      return new Response(JSON.stringify({ results: PLATAFORMAS }), { status: 200 });
    }
    if (u.pathname.startsWith('/3/discover/')){
      const tipo = u.pathname.endsWith('/tv') ? 'tv' : 'movie';
      /* el de mentira sólo obedece a lo que las pruebas comprueban: el tipo, la
         categoría y la plataforma. Lo demás se devuelve tal cual para poder
         mirar con qué parámetros se le llamó. */
      ultimoDiscover[tipo] = Object.fromEntries(u.searchParams);
      let fs = Object.values(FICHAS).filter((f) => (f.name ? 'tv' : 'movie') === tipo);
      const gen = u.searchParams.get('with_genres');
      if (gen){ const ids = gen.split('|').map(Number); fs = fs.filter((f) => (f.genre_ids || []).some((g) => ids.includes(g))); }
      const prov = u.searchParams.get('with_watch_providers');
      if (prov === '350') fs = fs.filter((f) => f.id === 95396);
      return new Response(JSON.stringify({ results: fs.map(crudo) }), { status: 200 });
    }
    const id = Number(u.pathname.split('/').pop());
    const f = FICHAS[id];
    if (!f) return new Response('no', { status: 404 });
    return new Response(JSON.stringify(f), { status: 200 });
  }
  throw new Error('petición inesperada a ' + u.hostname);
};

const env = { REPO: 'cuenta/sofa-club', BRANCH: 'main', APP_URL: 'https://x.github.io/sofa-club/',
  APP_ORIGIN: 'https://x.github.io', GITHUB_TOKEN: 'gh', TMDB_TOKEN: 'tm', ADMin: 0, ADMIN_KEY: 'clave-admin' };

const pedir = async (ruta, { metodo = 'POST', clave, admin, cuerpo } = {}) => {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://x.github.io' };
  if (clave) headers.Authorization = 'Bearer ' + clave;
  if (admin) headers['X-Admin-Key'] = admin;
  const r = await worker.fetch(new Request('https://w.dev' + ruta, {
    method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env);
  return { status: r.status, body: await r.json() };
};
const op = (clave, op, args) => pedir('/api/op', { clave, cuerpo: { op, args: args || {} } });

let fallos = 0;
const ok = (nombre, cond, extra) => {
  console.log((cond ? '  OK  ' : ' FALLA') + ' · ' + nombre + (!cond && extra ? '  → ' + extra : ''));
  if (!cond) fallos++;
};

/* ══ preparación: dos clubes independientes ══ */
const gPareja = await pedir('/admin/group', { admin: 'clave-admin', cuerpo: { group: 'pareja', ownerName: 'Alex', ownerEmoji: '🐻' } });
const gAmigos = await pedir('/admin/group', { admin: 'clave-admin', cuerpo: { group: 'amigos', ownerName: 'Alex', ownerEmoji: '🐻' } });
const claveAlex = gPareja.body.link.split('#s=')[1];
const claveAmigos = gAmigos.body.link.split('#s=')[1];

ok('se crea un club y devuelve enlace', gPareja.status === 200 && !!claveAlex, JSON.stringify(gPareja.body));
ok('sin clave de administración no se crea nada',
  (await pedir('/admin/group', { admin: 'inventada', cuerpo: { group: 'colados' } })).status === 401);
ok('no se puede repetir el nombre de un club',
  (await pedir('/admin/group', { admin: 'clave-admin', cuerpo: { group: 'pareja' } })).status === 409);

/* invitar y que entre otra persona */
const inv = await op(claveAlex, 'createInvite');
const codigo = inv.body.url.split('#i=')[1];
const alta = await pedir('/api/join', { cuerpo: { invite: codigo, name: 'Nuria', emoji: '🐰', color: '#FFE08A' } });
const claveNuria = alta.body.secret;
ok('una invitación da de alta y devuelve una clave propia', alta.status === 200 && !!claveNuria && claveNuria !== claveAlex);
ok('esa invitación no vale dos veces',
  (await pedir('/api/join', { cuerpo: { invite: codigo, name: 'Colado' } })).status === 401);

/* ── el enlace de grupo: uno solo, varias personas ──
   En un club aparte, porque aquí entran veintitantas personas de mentira y no
   tienen por qué salir luego en las cuentas de los demás. */
console.log('\n  — enlace para un grupo —');
const gPanas = await pedir('/admin/group', { admin: 'clave-admin', cuerpo: { group: 'panas', ownerName: 'Alex', ownerEmoji: '🐻' } });
const clavePanas = gPanas.body.link.split('#s=')[1];
const grupal = await op(clavePanas, 'createInvite', { grupo: true });
const codGrupo = grupal.body.url.split('#i=')[1];
ok('el enlace de grupo se anuncia como tal', grupal.body.grupo === true && !!grupal.body.inviteId);
const entran = [];
for (const n of ['Bruno', 'Carmen', 'Dani']){
  entran.push(await pedir('/api/join', { cuerpo: { invite: codGrupo, name: n, emoji: '🦊', color: '#FFE08A' } }));
}
ok('entran varias personas con el mismo enlace', entran.every((r) => r.status === 200));
ok('y cada una sale con una clave distinta',
  new Set(entran.map((r) => r.body.secret)).size === 3 && !entran.some((r) => r.body.secret === claveAlex));
const trasGrupo = (await pedir('/api/session', { clave: clavePanas })).body.state;
const invG = trasGrupo.invites.find((i) => i.id === grupal.body.inviteId);
ok('el dueño ve cuántos han entrado', invG && invG.usados === 3 && invG.maxUsos === 20, JSON.stringify(invG));
ok('y no ve el código con el que se entra', !JSON.stringify(trasGrupo.invites).includes('codeHash'));

/* anularlo es lo que convierte «se me ha escapado el enlace» en un botón */
ok('se puede anular', (await op(clavePanas, 'revokeInvite', { id: grupal.body.inviteId })).status === 200);
ok('y deja de valer en el acto',
  (await pedir('/api/join', { cuerpo: { invite: codGrupo, name: 'Tarde' } })).status === 401);
ok('anular dos veces no cuela', (await op(clavePanas, 'revokeInvite', { id: grupal.body.inviteId })).status === 404);
ok('un enlace anulado desaparece de la lista',
  !((await pedir('/api/session', { clave: clavePanas })).body.state.invites || []).some((i) => i.id === grupal.body.inviteId));

/* el tope existe para que un enlace reenviado tenga final */
const corto = await op(clavePanas, 'createInvite', { grupo: true });
const codCorto = corto.body.url.split('#i=')[1];
let entradas = 0;
for (let i = 0; i < 21; i++){
  if ((await pedir('/api/join', { cuerpo: { invite: codCorto, name: 'P' + i, emoji: '🐻', color: '#FFE08A' } })).status === 200) entradas++;
}
ok('el enlace de grupo se agota en el tope y no admite uno más', entradas === 20, entradas + ' entradas');
ok('y el club de al lado no se entera de nada de esto',
  (await pedir('/api/session', { clave: claveAlex })).body.state.users.length === 2);

const sesion = await pedir('/api/session', { clave: claveNuria });
const idAlex = sesion.body.state.users.find((u) => u.name === 'Alex').id;
const idNuria = sesion.body.state.me;

/* ══ 1. identidad ══ */
console.log('\n  — identidad —');
const add = await op(claveAlex, 'addItem', { tmdbId: 95396, type: 'tv', status: 'watching', title: 'TÍTULO FALSO DEL CLIENTE' });
const itemId = add.body.itemId;
const item0 = add.body.state.items.find((i) => i.id === itemId);
ok('el título lo pone TMDB, no el cliente', item0.title === 'Separación', item0.title);
ok('las temporadas también, y sin la de especiales', item0.totalEpisodes === 19, String(item0.totalEpisodes));
ok('y la nota de TMDB viene con la ficha', item0.score === 8.4, String(item0.score));
const trasVer = (await op(claveAlex, 'setStatus', { id: itemId, userIds: [idAlex], status: 'watching' }))
  .body.state.items.find((i) => i.id === itemId);
ok('pasar a «viendo» te deja en el primer episodio, no en el cero',
  trasVer.participants[idAlex].progress.s === 1 && trasVer.participants[idAlex].progress.e === 1,
  JSON.stringify(trasVer.participants[idAlex].progress));

/* las ganas van de 1 a 5 desde que la tarjeta enseña cinco corazones */
ok('las ganas llegan hasta 5',
  (await op(claveAlex, 'setHype', { id: itemId, value: 5 })).body.state.items
    .find((i) => i.id === itemId).participants[idAlex].hype === 5);
ok('un 6 se queda en 5', (await op(claveAlex, 'setHype', { id: itemId, value: 6 })).body.state.items
  .find((i) => i.id === itemId).participants[idAlex].hype === 5);
ok('y un 0 en 1: fuera de rango se recorta, no se guarda a medias',
  (await op(claveAlex, 'setHype', { id: itemId, value: 0 })).body.state.items
    .find((i) => i.id === itemId).participants[idAlex].hype === 1);
/* «no mando el valor» tiene que ser un error, no un 1 silencioso */
ok('y no mandar ganas ninguna es un error, no el mínimo',
  (await op(claveAlex, 'setHype', { id: itemId, value: null })).status === 400);
ok('lo mismo con un título sin id de TMDB',
  (await op(claveAlex, 'addItem', { tmdbId: null, type: 'tv', status: 'wish' })).status === 400);
ok('y con un progreso a medias',
  (await op(claveAlex, 'setProgress', { id: itemId, userIds: [idAlex], progress: { s: null, e: 3 } })).status === 400);

// Nuria se apunta y puntúa; ¿puede tocar la nota de Alex?
await op(claveNuria, 'joinUsers', { id: itemId, target: idAlex });
await op(claveAlex, 'setStatus', { id: itemId, userIds: [idAlex, idNuria], status: 'done' });
await op(claveNuria, 'setRating', { id: itemId, value: 1 });
const trasNota = (await op(claveAlex, 'setRating', { id: itemId, value: 5 })).body.state.items.find((i) => i.id === itemId);
ok('cada nota cae en su dueño', trasNota.participants[idAlex].rating === 5 && trasNota.participants[idNuria].rating === 1,
  JSON.stringify({ alex: trasNota.participants[idAlex].rating, nuria: trasNota.participants[idNuria].rating }));

// intento explícito de suplantación: colar un userId ajeno en los argumentos
const intento = await op(claveNuria, 'setRating', { id: itemId, value: 1, userId: idAlex, user: idAlex, me: idAlex });
const trasIntento = intento.body.state.items.find((i) => i.id === itemId);
ok('colar un userId ajeno no cambia nada de Alex', trasIntento.participants[idAlex].rating === 5,
  'quedó en ' + trasIntento.participants[idAlex].rating);

const nota = await op(claveNuria, 'addNote', { id: itemId, text: 'esto lo escribo yo', by: idAlex, autor: idAlex });
const n0 = nota.body.state.items.find((i) => i.id === itemId).notes[0];
ok('el autor de una nota lo pone el servidor', n0.by === idNuria, n0.by === idAlex ? 'la firmó como Alex' : n0.by);
ok('no se puede borrar la nota de otro', (await op(claveAlex, 'removeNote', { id: itemId, noteId: n0.id })).status === 403);
ok('la propia sí', (await op(claveNuria, 'removeNote', { id: itemId, noteId: n0.id })).status === 200);

const perfil = await op(claveNuria, 'updateProfile', { name: 'Nuria N', emoji: '🐰', color: '#FFE08A', id: idAlex });
const alexTrasPerfil = perfil.body.state.users.find((u) => u.id === idAlex);
ok('cambiar tu perfil no toca el de otro', alexTrasPerfil.name === 'Alex', alexTrasPerfil.name);

ok('quien no creó el club no puede echar a nadie',
  (await op(claveNuria, 'removeUser', { userId: idAlex })).status === 403);

/* estado y progreso SÍ son compartidos: es el contrato del colapso */
const movido = await op(claveNuria, 'setStatus', { id: itemId, userIds: [idAlex, idNuria], status: 'watching' });
const it2 = movido.body.state.items.find((i) => i.id === itemId);
ok('mover una tarjeta compartida sí mueve a los dos (es el diseño)',
  it2.participants[idAlex].status === 'watching' && it2.participants[idNuria].status === 'watching');

/* salirse de un título no es borrarlo del club: sólo desaparece tu parte */
const compartido = (await op(claveAlex, 'addItem', { tmdbId: 915935, type: 'movie', status: 'wish' })).body.itemId;
await op(claveNuria, 'joinUsers', { id: compartido, target: idAlex });
const trasSalir = (await op(claveAlex, 'leaveItem', { id: compartido })).body.state.items.find((i) => i.id === compartido);
ok('salirse de un título quita tu parte', !!trasSalir && !trasSalir.participants[idAlex]);
ok('y deja intacta la de quien sigue dentro', !!trasSalir && !!trasSalir.participants[idNuria]);
ok('salirse dos veces no cuela', (await op(claveAlex, 'leaveItem', { id: compartido })).status === 400);
ok('cuando se sale el último, el título sí desaparece',
  !(await op(claveNuria, 'leaveItem', { id: compartido })).body.state.items.some((i) => i.id === compartido));
ok('y nadie puede sacar a otro: no hay parámetro que lo diga',
  (await op(claveAmigos, 'leaveItem', { id: itemId })).status === 404);

/* ══ 2. aislamiento entre clubes ══ */
console.log('\n  — clubes —');
const desdeAmigos = await pedir('/api/session', { clave: claveAmigos });
ok('el club de amigos no ve los títulos de la pareja', desdeAmigos.body.state.items.length === 0,
  desdeAmigos.body.state.items.length + ' títulos');
ok('ni a su gente', !desdeAmigos.body.state.users.some((u) => u.name.startsWith('Nuria')));
ok('una clave de amigos no puede tocar un título de la pareja',
  (await op(claveAmigos, 'setStatus', { id: itemId, userIds: [idAlex], status: 'dropped' })).status === 404);
const inventada = await pedir('/api/session', { clave: 'pareja.' + 'z'.repeat(24) });
ok('una clave inventada no entra', inventada.status === 401);
ok('una clave con otro club por delante tampoco',
  (await pedir('/api/session', { clave: 'amigos.' + claveAlex.split('.')[1] })).status === 401);

/* ══ 3. los secretos no salen ══ */
console.log('\n  — secretos —');
const crudo = JSON.stringify(sesion.body);
ok('la respuesta no lleva ningún secretHash', !/secretHash/.test(crudo));
/* de las invitaciones sí sale con qué contarlas —para poder enseñar «3 de 20
   han entrado» y anularlas—, pero el código con el que se entra, jamás */
ok('ni el código de ninguna invitación', !/codeHash/.test(crudo));
ok('ni la clave de nadie', !crudo.includes(claveAlex.split('.')[1]));
const enDisco = archivos.get('data/pareja.json').texto;
ok('en disco se guarda el hash, nunca la clave', /secretHash/.test(enDisco) && !enDisco.includes(claveAlex.split('.')[1]));

/* ══ 4. acentos y expulsión ══ */
console.log('\n  — varios —');
await op(claveAlex, 'addItem', { tmdbId: 915935, type: 'movie', status: 'wish' });
const conAcentos = JSON.parse(archivos.get('data/pareja.json').texto);
const peli = conAcentos.items.find((i) => i.tmdbId === 915935);
ok('los acentos sobreviven al viaje por base64', peli.title === 'Anatomía de una caída', peli.title);
ok("y los apóstrofos del título original", peli.originalTitle === "Anatomie d'une chute", peli.originalTitle);

const fuera = await op(claveAlex, 'removeUser', { userId: idNuria });
ok('quien creó el club sí puede echar', fuera.status === 200);
ok('y la clave del expulsado deja de valer al instante',
  (await pedir('/api/session', { clave: claveNuria })).status === 401);

/* ══ 5. crear clubes siendo ya de alguno ══ */
console.log('\n  — crear un club sin la llave maestra —');

const nuevo = await pedir('/api/group', { clave: claveAlex, cuerpo: { group: 'curro', name: 'Álex', emoji: '🐙', color: '#FF8FD0' } });
ok('quien ya está en un club puede crear otro', nuevo.status === 200 && !!nuevo.body.secret, JSON.stringify(nuevo.body).slice(0, 120));
ok('y el club nuevo es suyo, con su propia clave',
  nuevo.body.secret.split('.')[0] === 'curro' && nuevo.body.secret !== claveAlex);
ok('con un identificador de persona distinto al del otro club',
  nuevo.body.state.me !== idAlex, nuevo.body.state.me + ' vs ' + idAlex);
ok('el perfil que mandó es el que se guarda',
  nuevo.body.state.users[0].name === 'Álex' && nuevo.body.state.users[0].emoji === '🐙');

ok('sin ninguna clave no se crea nada',
  (await pedir('/api/group', { cuerpo: { group: 'colados', name: 'X' } })).status === 401);
ok('con una clave inventada tampoco',
  (await pedir('/api/group', { clave: 'pareja.' + 'z'.repeat(24), cuerpo: { group: 'colados2', name: 'X' } })).status === 401);
ok('ni con la clave de alguien a quien echaron',
  (await pedir('/api/group', { clave: claveNuria, cuerpo: { group: 'colados3', name: 'X' } })).status === 401);
ok('no se puede pisar el nombre de un club que ya existe',
  (await pedir('/api/group', { clave: claveAlex, cuerpo: { group: 'pareja', name: 'X' } })).status === 409);
ok('ni colar un nombre con travesía de directorios',
  (await pedir('/api/group', { clave: claveAlex, cuerpo: { group: '../fuera', name: 'X' } })).status === 400);
ok('ni con mayúsculas o espacios',
  (await pedir('/api/group', { clave: claveAlex, cuerpo: { group: 'Mi Club', name: 'X' } })).status === 400);

const claveCurro = nuevo.body.secret;
ok('el club nuevo no ve los títulos del viejo',
  (await pedir('/api/session', { clave: claveCurro })).body.state.items.length === 0);
ok('y el viejo sigue sin enterarse del nuevo',
  !JSON.stringify((await pedir('/api/session', { clave: claveAlex })).body).includes('curro'));

/* ══ 6. el buscador ══ */
console.log('\n  — buscador —');
const busq = await pedir('/api/search?q=a', { metodo: 'GET', clave: claveAlex });
ok('la búsqueda sólo devuelve series y películas, nunca personas',
  busq.body.results.every((r) => r.type === 'tv' || r.type === 'movie'), JSON.stringify(busq.body.results));
ok('la primera página trae lo que TMDB pone en su primera página',
  busq.body.results.length === 1 && busq.body.results[0].tmdbId === 95396, JSON.stringify(busq.body.results));
const busq2 = await pedir('/api/search?q=a&page=2', { metodo: 'GET', clave: claveAlex });
ok('«ver más» pide la página siguiente y trae cosas distintas',
  busq2.body.results.length === 1 && busq2.body.results[0].tmdbId === 915935, JSON.stringify(busq2.body.results));
ok('una página no repite lo que ya había en la anterior',
  !busq2.body.results.some((r) => busq.body.results.some((p) => p.tmdbId === r.tmdbId)));
ok('un mismo título no sale dos veces dentro de una página',
  new Set(busq.body.results.map((r) => r.type + r.tmdbId)).size === busq.body.results.length);
ok('los resultados traen la nota de TMDB, que es lo que filtra por valoración',
  busq.body.results[0].score === 8.4, JSON.stringify(busq.body.results[0]));
ok('una página que se sale de rango no revienta, devuelve vacío',
  (await pedir('/api/search?q=a&page=99', { metodo: 'GET', clave: claveAlex })).body.results.length === 0);
ok('sin clave no se busca', (await pedir('/api/search?q=a', { metodo: 'GET' })).status === 401);

/* ══ 7. el catálogo sólo con filtros ══ */
console.log('\n  — catálogo por filtros —');
const desc = await pedir('/api/discover?sort=rel&page=1', { metodo: 'GET', clave: claveAlex });
ok('sin decir el tipo salen series y películas mezcladas',
  desc.body.results.length === 2 && new Set(desc.body.results.map((r) => r.type)).size === 2, JSON.stringify(desc.body.results));
ok('cada resultado sabe si es serie o peli, aunque TMDB no lo diga en /discover',
  desc.body.results.every((r) => r.type === 'tv' || r.type === 'movie'));
const soloTv = await pedir('/api/discover?type=tv', { metodo: 'GET', clave: claveAlex });
ok('pidiendo sólo series, sólo vienen series',
  soloTv.body.results.length === 1 && soloTv.body.results[0].type === 'tv');
await pedir('/api/discover?genres=18,10765', { metodo: 'GET', clave: claveAlex });
ok('varias categorías se piden como «cualquiera de ellas», no como «todas a la vez»',
  ultimoDiscover.tv.with_genres === '18|10765', ultimoDiscover.tv.with_genres);
const porPlat = await pedir('/api/discover?provs=Apple%20TV%2B', { metodo: 'GET', clave: claveAlex });
ok('el nombre de la plataforma se traduce al id que entiende TMDB',
  ultimoDiscover.tv.with_watch_providers === '350' && ultimoDiscover.tv.watch_region === 'ES', JSON.stringify(ultimoDiscover.tv));
ok('y filtra de verdad', porPlat.body.results.length === 1 && porPlat.body.results[0].tmdbId === 95396);
ok('una plataforma que TMDB no conoce no devuelve el catálogo entero',
  (await pedir('/api/discover?provs=Plataforma%20Inventada', { metodo: 'GET', clave: claveAlex })).body.results.length === 0);
/* sin década no debe colarse ningún filtro de fechas: «no me has dicho nada» no
   es «dame los años 1900», que es justo lo que pasaba cuando Number(null)=0 */
await pedir('/api/discover?sort=rel', { metodo: 'GET', clave: claveAlex });
ok('sin década no se filtra por fechas',
  !ultimoDiscover.tv['first_air_date.gte'] && !ultimoDiscover.tv['first_air_date.lte']
  && !ultimoDiscover.movie['primary_release_date.gte'], JSON.stringify(ultimoDiscover.tv));
ok('ni por nota, ni por plataforma, si nadie las ha pedido',
  !ultimoDiscover.tv['vote_average.gte'] && !ultimoDiscover.tv.with_watch_providers);
await pedir('/api/discover?dec=1990', { metodo: 'GET', clave: claveAlex });
ok('una década se traduce a un intervalo de fechas del campo que toca en cada tipo',
  ultimoDiscover.tv['first_air_date.gte'] === '1990-01-01' && ultimoDiscover.tv['first_air_date.lte'] === '1999-12-31'
  && ultimoDiscover.movie['primary_release_date.gte'] === '1990-01-01', JSON.stringify(ultimoDiscover.tv));
await pedir('/api/discover?dec=old', { metodo: 'GET', clave: claveAlex });
ok('«antes de los 90» es un tope, no un intervalo',
  ultimoDiscover.tv['first_air_date.lte'] === '1989-12-31' && !ultimoDiscover.tv['first_air_date.gte']);
await pedir('/api/discover?sort=score', { metodo: 'GET', clave: claveAlex });
ok('ordenar por nota exige un mínimo de votos, o lo copan los votados una vez',
  ultimoDiscover.tv.sort_by === 'vote_average.desc' && Number(ultimoDiscover.tv['vote_count.gte']) >= 200);
ok('sin clave no se mira el catálogo',
  (await pedir('/api/discover?type=tv', { metodo: 'GET' })).status === 401);

console.log('\n' + (fallos ? fallos + ' PRUEBA(S) FALLIDA(S)' : 'todas las pruebas del Worker pasan'));
process.exit(fallos ? 1 : 0);
