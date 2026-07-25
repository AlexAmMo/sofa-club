/* Pruebas de la parte del navegador: saneado antes del DOM y manejo de claves.
   La lógica de datos y los permisos viven en el Worker → test-worker.mjs        */
const fs = require('fs');
const vm = require('vm');
const h = fs.readFileSync('index.html', 'utf8');
const js = h.slice(h.indexOf('<script>') + 8, h.lastIndexOf('</scr' + 'ipt>'));
const cut = js.indexOf('const IMG = {');
if (cut < 0) { console.error('no encuentro el corte del bloque puro'); process.exit(1); }

const EXPORTS = '\nthis.API = { okId, okColor, okEmoji, okImgPath, safeItem, safeUser, publicView, readConfig, grupoDe,'
  + ' añadirSecreto, quitarSecreto, olvidarTodo, guardarCacheDe, leerCacheDe, borrarCacheDe, leerPerfil, guardarPerfil,'
  + ' leerGuardado: () => JSON.parse(localStorage.getItem(LS.cfg) || "null") };';
function cargar(hash, guardado, extra){
  const store = Object.assign({ 'sc.cfg': guardado ? JSON.stringify(guardado) : null }, extra || {});
  const sandbox = { console, URLSearchParams, TextEncoder, TextDecoder,
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    location: { hash: hash || '', pathname: '/sofa-club/', search: '', origin: 'https://x.github.io', hostname: 'x.github.io' },
    history: { replaceState: () => {} } };
  vm.createContext(sandbox);
  vm.runInContext(js.slice(0, cut) + EXPORTS, sandbox);
  sandbox.API.store = store;
  return sandbox.API;
}
const A = cargar();

let fallos = 0;
const ok = (n, cond, extra) => { console.log((cond ? '  OK  ' : ' FALLA') + ' · ' + n + (!cond && extra ? '  → ' + extra : '')); if (!cond) fallos++; };

/* ── 1. saneado de lo que llega del Worker y de TMDB ── */
console.log('  — saneado antes del DOM —');
ok('un color hostil cae al de por defecto', A.okColor('#f;background:url(https://evil.tld)') === '#8B85A8');
ok('un emoji con etiqueta HTML queda en texto inofensivo', !/[<>&"']/.test(A.okEmoji('<img src=x onerror=alert(1)>')));
ok('una ruta de carátula que se escapa del atributo se descarta', A.okImgPath('/x.jpg" onload="alert(1)') === null);
ok('una ruta legítima de TMDB pasa', A.okImgPath('/aBc-1_2.jpg') === '/aBc-1_2.jpg');
ok('un identificador con travesía de directorios se descarta', A.okId('../../otro') === null);

const sucio = A.safeItem({ id: 'i1', title: 'x'.repeat(5000), type: 'raro', year: 'alert(1)', runtime: {},
  participants: { u1: { status: 'watching', order: 1 }, 'mal id': { status: 'wish', order: 1 }, u2: { status: 'inventado', order: 1 } }, notes: [] });
ok('el título se recorta', sucio.title.length <= 160);
ok('un tipo inventado cae a serie', sucio.type === 'tv');
ok('un año no numérico se anula', sucio.year === null);
ok('un identificador de participante inválido se descarta', Object.keys(sucio.participants).join() === 'u1');
ok('un estado inventado se descarta', !sucio.participants.u2);

const vista = A.publicView({ users: [{ id: 'u1', name: 'A', emoji: '🐻', color: '#FF8FD0' }, { id: 'u2', deletedAt: 'x', name: 'B' }],
  items: [{ id: 'i1', title: 'X', participants: { u1: { status: 'wish', order: 1 } }, notes: [{ id: 'n1', by: 'u1', text: 'hola' }, { id: 'n2', deletedAt: 'x', text: 'fuera' }] }] }, 'u1');
ok('la gente dada de baja no se pinta', vista.users.length === 1);
ok('las notas borradas tampoco', vista.items[0].notes.length === 1);

/* ── 2. claves y clubes ── */
console.log('\n  — claves —');
const buena = 'pareja.' + 'a'.repeat(24);
const otra  = 'amigos.' + 'b'.repeat(24);

const c1 = cargar('#s=' + buena).readConfig();
ok('una clave válida del enlace se guarda y queda activa', c1.active === buena && c1.secrets.length === 1);
ok('el club se lee de la propia clave', A.grupoDe(buena) === 'pareja');
ok('una clave con forma rara se ignora', cargar('#s=noesunaclave').readConfig().secrets.length === 0);
ok('una clave con travesía de directorios se ignora', cargar('#s=' + encodeURIComponent('../otro') + '.aaaaaaaaaaaaaaaa').readConfig().secrets.length === 0);

const api2 = cargar('#s=' + otra, { secrets: [buena], active: buena });
const c2 = api2.readConfig();
ok('entrar en un segundo club conserva el primero', c2.secrets.length === 2 && c2.active === otra, JSON.stringify(c2.secrets));
ok('y los dos quedan guardados', (api2.leerGuardado().secrets || []).length === 2);

const api3 = cargar('#s=pareja.' + 'c'.repeat(24), { secrets: [buena, otra], active: otra });
const c3 = api3.readConfig();
ok('renovar la clave de un club sustituye la vieja, no la duplica',
  c3.secrets.filter((s) => A.grupoDe(s) === 'pareja').length === 1 && c3.secrets.length === 2, JSON.stringify(c3.secrets));

const c4 = cargar('#i=pareja.' + 'd'.repeat(24)).readConfig();
ok('una invitación se recoge pero no se guarda (es de un solo uso)',
  c4.invite === 'pareja.' + 'd'.repeat(24) && c4.secrets.length === 0);

/* ── 3. varios clubes en el mismo móvil ── */
console.log('\n  — varios clubes en el mismo móvil —');

const tablero = (me, titulo) => ({ me: me, users: [{ id: me, name: 'Alex', emoji: '🐻', color: '#FF8FD0' }],
  items: [{ id: 'i1', tmdbId: 42, title: titulo, type: 'tv', participants: { [me]: { status: 'done', order: 1, rating: 4 } }, notes: [] }] });

const api5 = cargar(null, { secrets: [buena, otra], active: buena });
api5.guardarCacheDe('pareja', tablero('u_a', 'Severance'));
api5.guardarCacheDe('amigos', tablero('u_b', 'Severance'));
ok('cada club guarda su propia copia local',
  api5.store['sc.cache.pareja'] && api5.store['sc.cache.amigos']
  && api5.store['sc.cache.pareja'] !== api5.store['sc.cache.amigos']);
ok('la copia de un club se lee entera y saneada',
  (api5.leerCacheDe('amigos') || {}).group === 'amigos' && api5.leerCacheDe('amigos').items.length === 1);
ok('un club sin copia local no inventa nada', api5.leerCacheDe('vecinos') === null);

const envenenada = { me: 'u_a', users: [{ id: 'u_a', name: 'A', emoji: '🐻', color: '#f;background:url(https://evil.tld)' }],
  items: [{ id: 'i9', tmdbId: 1, title: 'X', participants: { u_a: { status: 'done', order: 1 } }, notes: [],
    poster: '/x.jpg" onload="alert(1)' }] };
api5.guardarCacheDe('pareja', envenenada);
const leida = api5.leerCacheDe('pareja');
ok('una copia local manipulada se sanea al leerla, no al escribirla',
  leida.users[0].color === '#8B85A8' && leida.items[0].poster === null);

const api6 = cargar(null, { secrets: [buena, otra], active: otra });
api6.guardarCacheDe('pareja', tablero('u_a', 'Severance'));
const cfg6 = { secrets: [buena, otra], active: otra };
api6.quitarSecreto(cfg6, buena);
ok('salir de un club se lleva su clave y su copia local',
  cfg6.secrets.length === 1 && cfg6.active === otra && !api6.store['sc.cache.pareja']);
ok('y no toca la del club en el que sigues', cfg6.secrets[0] === otra);

const cfg7 = { secrets: [buena], active: buena };
api6.quitarSecreto(cfg7, buena);
ok('salir del último club deja el dispositivo sin club activo', cfg7.active === null && !cfg7.secrets.length);

/* ── 4. el perfil del dispositivo ── */
console.log('\n  — el perfil del dispositivo —');
const api8 = cargar();
ok('sin nada guardado no hay perfil que preseleccionar', api8.leerPerfil() === null);
api8.guardarPerfil({ name: 'Álex', emoji: '🐻', color: '#FF8FD0' });
ok('el perfil se recuerda con acentos incluidos', (api8.leerPerfil() || {}).name === 'Álex');
api8.guardarPerfil({ name: 'x'.repeat(300), emoji: '<img src=x onerror=alert(1)>', color: 'javascript:alert(1)' });
const sucioP = api8.leerPerfil();
ok('un perfil hostil se sanea antes de volver a la pantalla',
  sucioP.name.length <= 40 && !/[<>&"']/.test(sucioP.emoji) && sucioP.color === '#8B85A8');
api8.guardarPerfil({ name: '   ' });
ok('un nombre vacío no pisa el perfil bueno', api8.leerPerfil().name.length <= 40);

const api9 = cargar(null, { secrets: [buena, otra], active: buena });
api9.guardarPerfil({ name: 'Álex', emoji: '🐻', color: '#FF8FD0' });
api9.guardarCacheDe('pareja', tablero('u_a', 'Severance'));
api9.guardarCacheDe('amigos', tablero('u_b', 'Severance'));
api9.olvidarTodo({ secrets: [buena, otra] });
ok('salir del dispositivo se lleva claves, perfil y todas las copias locales',
  !api9.store['sc.cfg'] && !api9.store['sc.me'] && !api9.store['sc.cache.pareja'] && !api9.store['sc.cache.amigos']);

console.log('\n' + (fallos ? fallos + ' PRUEBA(S) FALLIDA(S)' : 'todas las pruebas del navegador pasan'));
process.exit(fallos ? 1 : 0);
