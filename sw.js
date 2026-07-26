/* ══════════════════════════════════════════════════════════════════════════════
   Service worker — lo mínimo para que el móvil pueda instalar la app.

   Va **primero a la red, siempre**, y la caché es sólo el paracaídas de cuando
   no hay conexión. Es deliberado y es al revés de lo que se suele hacer:

   · El JavaScript de esta app se ejecuta porque su SHA-256 está declarado en la
     CSP del propio `index.html`. Un service worker que sirviera de la caché
     podría dar un `index.html` viejo cuyo hash ya no cuadra, y entonces el
     navegador bloquea el script y la pantalla se queda **en blanco** — el peor
     fallo posible, y sin forma de arreglarlo desde el móvil.
   · La app es un solo archivo y Pages lo sirve rápido. Lo que se ganaría
     cacheando es poco; lo que se arriesga es todo.

   Con ir primero a la red, un despliegue nuevo se coge en la siguiente carga y
   no hay nada que invalidar a mano.
   ══════════════════════════════════════════════════════════════════════════════ */

const CACHE = 'sofa-club-v1';

/* La portada se guarda ya al instalar. Sin esto, la primera visita no pasa por
   aquí —el service worker se registra cuando la página ya ha cargado— y la app
   no sabría abrirse sin conexión hasta la segunda vez. */
self.addEventListener('install', (e) => e.waitUntil(
  caches.open(CACHE)
    .then((c) => c.add('./'))
    .catch(() => {})                      /* sin red al instalar: ya se cogerá */
    .then(() => self.skipWaiting())
));

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  /* Las operaciones no se tocan: sólo se mira lo que se puede repetir sin
     consecuencias. Un POST a /api/op no se cachea ni se reintenta desde aquí —
     de eso ya se encarga la cola de la propia app. */
  if (req.method !== 'GET') return;
  /* Ni el Worker ni TMDB ni las fuentes: sólo lo que sirve este mismo origen.
     Lo de fuera tiene sus propias cabeceras de caché y sus propios permisos. */
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r && r.ok){
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./')))
  );
});
