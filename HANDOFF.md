# Sofa Club — documento de traspaso

Todo lo necesario para retomar el proyecto sin la conversación que lo originó: qué es, en qué estado
está, **por qué** cada decisión es como es, y qué falta.

---

## 1. Qué es

Tablero kanban privado de series y películas para verlas en compañía, pensado primero para una pareja
y luego generalizado a **varios clubes independientes** (la pareja por un lado, los amigos por otro).

Referencia de interacción: un project board de GitHub, tarjetas que se mueven entre columnas.
Referencia estética: la contraria — oscuro, redondeado y kawaii adulto. Todo en español de España,
microcopy en minúsculas y con humor seco.

Uso principal: **el móvil**, añadido a la pantalla de inicio.

## 2. Estado

| | |
|---|---|
| Interfaz | completa y verificada en navegador |
| Worker | completo, 28 pruebas contra GitHub y TMDB simulados |
| Navegador | 32 pruebas de saneado, claves, copias locales y perfil |
| Despliegue | **hecho**: Worker en Cloudflare, app en Pages, dos repos en la cuenta AlexAmMo |
| E2E real | **hecho** el 25 de julio de 2026 contra GitHub, Cloudflare y TMDB de verdad |

En producción:

- app: `https://alexammo.github.io/sofa-club/` (repo público `AlexAmMo/sofa-club`)
- Worker: `https://sofa-club.mysofaclub.workers.dev`
- datos: repo privado `AlexAmMo/sofa-club-data`
- el remoto de git usa el alias SSH `github-sofaclub` (clave `~/.ssh/id_sofaclub`)

Siguiente paso concreto: crear el club de verdad con `ADMIN_KEY` y repartir invitaciones.
`PUESTA-EN-MARCHA.md` tiene el paso a paso por si hay que rehacerlo desde cero.

---

## 3. La idea central: la regla del colapso

Es lo que distingue esta app de cualquier otro tablero, y todo lo demás se deriva de ella:

> **Se muestra un solo control cuando los valores coinciden, y se desdobla en uno por persona cuando
> difieren.**

- **Estado.** Cada persona tiene el suyo. Un título se dibuja **una vez por cada estado ocupado**, así
  que la misma serie puede aparecer a la vez en las cuatro columnas y eso es correcto, no un fallo.
- **Progreso.** Si todos van por el mismo episodio, un marcador y un par de botones. Si no, una fila
  por persona. Más de tres ritmos distintos → resumen «N ritmos distintos ›».
- **Mover.** Arrastrar o deslizar mueve a **todas las personas de la tarjeta**: estar juntos en una
  tarjeta ya significa que ibais juntos. Separarse es un acto deliberado («seguir yo solo»), y
  reunirse otro («me uno a ellos»).
- Clave de agrupación: **`(item, status, order)`**. `splitOut` da un `order` nuevo; `joinUsers` copia
  estado, `order` y progreso.

**Consecuencia que hay que respetar:** estado y progreso son compartidos *por contrato*. Cualquier
modelo de permisos tiene que permitir que un miembro mueva a otro. Lo personal es la nota, las ganas,
la autoría de los comentarios y el perfil.

---

## 4. Decisiones de producto y por qué

| decisión | por qué |
|---|---|
| Cuatro columnas: 💭 Nos apetece · 👀 Viendo · ✅ Terminado · 😴 Dejada | la cuarta recoge lo abandonado sin ensuciar «Viendo» ni borrar el recuerdo. Plegada por defecto en escritorio |
| Pelis y series juntas, con filtro | separarlas duplicaba el tablero para poca ganancia |
| Las pelis no pasan por «Viendo» | su botón es «ya la hemos visto» y saltan a Terminado |
| Nota por persona **y** media del grupo, también en «Dejada» | puntuar algo que abandonaste explica por qué lo abandonaste |
| Umbral de «aquí hubo debate 🥊»: horquilla > 2 | y su contrario, «todos igual, qué bonito 🫶», cuando coinciden exactamente |
| Ganas de 1 a 3 corazones en la wishlist | alimentan la ruleta, que pondera por la suma de los presentes |
| Notas = hilo de comentarios con autor | con N personas, un campo de texto compartido y pisable no aguanta |
| Ruleta: primero **quién ve esta noche** | con grupos, el sorteo tiene que pesar solo las ganas de los que están en el sofá |
| Estadísticas con conmutador mías / del grupo | |
| Buscar y añadir en hojas **separadas** | confusión real: una busca en el catálogo, la otra en lo que ya tenéis |
| Diseño sin límite de personas | decisión explícita del usuario, sabiendo que enfría algo la interfaz |
| Borrado con confirmación **y deshacer de 6 s** | `removeItem` solo se llama al expirar el plazo |

**Móvil (<900px):** pestañas por estado con contador · deslizar la tarjeta avanza o retrocede de
estado · pulsación larga (350 ms) levanta la tarjeta y abre un dock con los cuatro destinos ·
deslizar el fondo cambia de pestaña · barra inferior de 5 secciones con el «+» central.
**Escritorio (≥900px):** kanban de cuatro columnas con arrastre real.

Todos los gestos con **Pointer Events**, nunca con la API de drag & drop de HTML5: una sola
implementación para ratón y dedo, y control total de la animación.

**Estética:** cuatro paletas conmutables con `data-theme`; por defecto **Neón de medianoche**.
Nunito 400/600/800. Radios 20/28/999. Curva de muelle `cubic-bezier(.34,1.56,.64,1)`.
`prefers-reduced-motion` desactiva todo. La animación de **partirse y reunirse** una tarjeta es el
gesto característico: no debe leerse como un refresco de lista.

---

## 5. Decisiones técnicas y por qué

**Por qué no es un artefacto de claude.ai.** La CSP de los artefactos bloquea toda petición externa y
no existe estado compartido entre visitantes: no podría sincronizar ni traer carátulas.

**Por qué se reescribió el prototipo.** Claude Design entregó `.dc.html` + `support.js`, que descarga
React y Babel desde unpkg y compila en el navegador. Incompatible con «menos de un segundo». Se portó
a un `index.html` autocontenido. El README del handoff original decía lo mismo.

**Por qué un Worker y no el navegador contra GitHub.** La primera versión guardaba un token de
escritura en cada móvil. Eso hacía imposible dos cosas que se pidieron después: identidad garantizada
y clubes que no se pisen. Con el Worker **nadie más que el dueño escribe en el repo**, lo que además
mata el problema del origen compartido de Pages (un miembro ya no puede modificar `index.html`).

**Por qué el `userId` no existe en las operaciones personales.** `setRating(itemId, valor)`, no
`setRating(itemId, quién, valor)`. El «quién» sale del secreto que autentica. La suplantación no está
prohibida por una regla que se pueda olvidar: **no se puede expresar**. Es el corazón del diseño de
seguridad y no debe deshacerse.

**Por qué `addItem` solo acepta un id de TMDB.** La ficha la trae el Worker, así que el cliente no
puede inyectar metadatos. Reduce mucho la superficie de XSS.

**Por qué dos repositorios.** Pages gratis exige repo público, y ahí no pueden estar las notas y
puntuaciones. El repo de datos va privado (no sirve páginas, no necesita plan de pago) y el token del
Worker se acota **solo a él**.

**Por qué escrituras optimistas.** El diseño original decía «optimistas no», pero eso son 400-900 ms
de espera visible en cada gesto y un commit por episodio. Se pinta al instante, la operación sale
detrás y la respuesta del Worker manda. Los toques repetidos sobre lo mismo se **funden** en un envío.

**Por qué el estado es de cada club y no de cada persona.** Se estudió lo contrario — que tu estado
en un título fuera el mismo en todos tus clubes — y se descartó por tres motivos, el primero de los
cuales es de contrato:

1. **Rompería el aislamiento.** Mover una tarjeta mueve a *todas* las personas que van en ella: es la
   regla del colapso, y por eso `setStatus` recibe una lista de usuarios. Con estado global, un amigo
   arrastrando algo movería también el tablero de la pareja. No se arregla con «que cada uno mueva
   sólo lo suyo», porque eso mata la regla del colapso.
2. **Filtraría lo que no se quiso compartir.** La nota que pusiste en pareja aparecería en el club de
   amigos sola, en cuanto alguien añadiera ese título.
3. **«Viendo» no significa lo que parece.** No es *yo estoy viendo esto*, es *esto lo estamos viendo
   juntos*. Terminada con una persona y pendiente con otra es correcto: es rever algo acompañado.

**Dónde va entonces la comodidad de tener «un perfil con varios grupos».** En el cliente, no en el
servidor. El dispositivo ya guarda las claves de todos tus clubes, así que ya sabe que eres la misma
persona aunque el servidor no lo sepa y no tenga por qué saberlo. De ahí salen tres cosas, todas sin
una sola petición y sin que nadie de un club vea nada de otro: el **estante de clubes** con su
resumen, el **perfil del dispositivo** (`sc.me`) que se preselecciona al entrar en un club nuevo, y
las **pistas cruzadas** («en «pareja» la tienes en 👀 viendo, por la T2 E3»).

La alternativa era una cuenta de verdad, y ahí está la pega: hoy el club va *dentro* del secreto, así
que una clave no puede nombrar el archivo de otro club — la imposibilidad es estructural. Con una
cuenta, la credencial valdría para varios clubes y el aislamiento pasaría a depender de que una
comprobación esté bien escrita. Se cambiaría una garantía por una promesa para ahorrar teclear un
nombre.

**Por qué una copia local por club** (`sc.cache.<grupo>`) y no una sola ranura: con una sola, cambiar
de club dejaba el tablero en blanco hasta que contestaba el Worker, y no había forma de mirar los
otros clubes sin pedirlos. Se sanea **al leerla**, no al escribirla: es texto de `localStorage` y
acaba en el DOM.

**Por qué CSP con hash.** GitHub Pages no permite cabeceras, así que va en un `<meta>` con el SHA-256
del bloque de script. Bloquea cualquier script inyectado, y `connect-src` limita la salida al Worker.

---

## 6. Mapa de archivos

```
sofa-club/
├── index.html          la app entera. Un archivo, sin build
├── .nojekyll           Pages sirve tal cual
├── build-csp.js        recalcula el hash del script y el connect-src  ← OBLIGATORIO tras tocar JS
├── configurar.ps1      hace los pasos 6-10 de la puesta en marcha; los secretos los pide wrangler
├── test-app.js         20 pruebas: saneado antes del DOM, manejo de claves
├── test-worker.mjs     29 pruebas: identidad, clubes, secretos
├── worker/
│   ├── src/index.js    el Worker
│   ├── wrangler.toml   REPO, BRANCH, APP_URL, APP_ORIGIN
│   └── package.json    type: module
├── LEEME.md            qué es y cómo funciona
├── PUESTA-EN-MARCHA.md el paso a paso de cero a un club funcionando, con comprobaciones
├── CREDENCIALES.md     qué credenciales hacen falta y dónde va cada una
├── CLAUDE.md           reglas para sesiones de Claude Code (¡la cuenta de GitHub!)
└── HANDOFF.md          este archivo
```

Dentro de `index.html`, en orden: tokens CSS y estilos · configuración y claves · saneadores y
`publicView` · `IMG`/`aplicarLocal`/`sanear`/`createApi` · `demoSeed` · constantes de la interfaz ·
`cardHtml`/`buildCards` · cabecera, tablero, nav · las ocho hojas · `render` · acciones · gestos ·
arranque.

---

## 7. Contratos

### El `Api` del navegador (la interfaz solo habla con esto)

```js
getState()  subscribe(fn)  getSyncStatus()  imageUrl(path,size)  searchTitles(q,{signal})
addItem({tmdbId,type,status,hype})  removeItem(id)
setStatus(id,userIds,status)  setProgress(id,userIds,{s,e})
splitOut(id)  joinUsers(id,_,target)  setHype(id,_,v)  setRating(id,_,v)
addNote(id,text)  removeNote(id,noteId)
updateProfile({name,emoji,color})  createInvite()  removeUser(userId)
// además: isDemo, hasTmdb, authFailed, repoName, retry, boot, unirse(perfil), hayInvitacion
// clubes de este dispositivo (todo local, sin peticiones):
//   grupos() → [{secret,group,activo}]   estadoDeClub(g) → estado saneado o null
//   perfilDelDispositivo() → {name,emoji,color}|null
//   cambiarGrupo(secret)   salirDeClub(secret)   olvidarDispositivo()
```

Los parámetros `_` son restos del contrato antiguo: se ignoran. **No los uses para nada.**

### La API del Worker

```
POST /admin/group   X-Admin-Key         { group, ownerName, ownerEmoji, ownerColor } → { group, link }
POST /api/group     Bearer <secreto>    { group, name, emoji, color }              → { group, secret, state }
POST /api/session   Bearer <secreto>                                                 → { state, group }
POST /api/join                          { invite, name, emoji, color }               → { secret, state }
POST /api/op        Bearer <secreto>    { op, args }                                 → { state, ...extra }
GET  /api/search    Bearer <secreto>    ?q=                                          → { results }
POST /api/refresh   Bearer <secreto>                                                 → { state }
```

Secreto: `<club>.<24 caracteres>`. El club va dentro y determina el archivo que se abre.

### Datos (`data/<club>.json`, repo privado)

```js
{ version:3, group, createdAt, updatedAt, owner:<userId>,
  users:[{ id,name,emoji,color,joinedAt,secretHash,deletedAt }],
  invites:[{ codeHash,by,createdAt,expiresAt,usedAt }],
  items:[{ id,tmdbId,type,title,originalTitle,year,poster,genres,overview,runtime,
           seasons:[{number,episodes}],totalEpisodes,providers:[{name,logo}],providersCheckedAt,
           addedBy,addedAt,
           participants:{ <userId>:{ status,order,progress:{s,e},hype,rating,startedAt,finishedAt,updatedAt } },
           notes:[{ id,by,text,at,deletedAt }], updatedAt, deletedAt }] }
```

`secretHash` e `invites` **nunca** salen al cliente: los quita `vistaPublica()`.

---

## 8. Qué está verificado y cómo

**En navegador real** (Playwright, modo demo): cero errores de consola · sin scroll horizontal a
390 px · ningún objetivo táctil por debajo de 44 px · un título repartido en dos columnas se parte en
tres al usar «seguir yo solo» · el `+1` avanza solo tu ficha y deja al resto donde estaba · la ruleta
pondera y sortea · la CSP bloquea un script inyectado.

**`test-worker.mjs`** (29): el título lo pone TMDB y no el cliente · colar un `userId` ajeno no cambia
la nota de nadie · el autor de un comentario lo pone el servidor · no se borra la nota de otro · quien
no creó el club no echa a nadie · un club no ve los títulos ni la gente de otro · una clave con otro
club por delante no entra · los secretos no salen en las respuestas ni en disco · expulsar invalida la
clave al instante · los acentos sobreviven al base64.

**`test-app.js`** (32): saneadores contra entradas hostiles · varias claves conviviendo · renovar la
clave de un club sustituye la vieja · una invitación se recoge pero no se guarda · cada club guarda
su copia local y una copia manipulada se sanea al leerla · salir de un club se lleva su clave y su
copia y no toca las demás · el perfil del dispositivo se recuerda con acentos y se sanea.

**En navegador, con dos clubes sembrados y un Worker de mentira en local:** el chip del club aparece
sólo con más de uno · cambiar de club repinta el tablero al instante desde la copia local · la pista
cruzada sale en el detalle y al añadir · salir de un club deja el otro intacto y conserva el perfil ·
sin errores de consola, sin scroll horizontal a 390 px y con las zonas pulsables de la cabecera en
44 px (que son 24 y 18 px de caja, ampliados con `::after`).

**Lo que NO está verificado:** el viaje HTTP real contra GitHub y TMDB. Todo lo anterior corre contra
simulaciones en memoria.

---

## 9. Trampas conocidas

- **Tras tocar el JavaScript hay que ejecutar `node build-csp.js`.** Si no, el hash no cuadra y la
  página no arranca. Es a propósito.
- **La cuenta de GitHub de este proyecto no es la habitual.** Ver `CLAUDE.md`: aquí no se usa `gh`,
  porque es el ayudante de credenciales global y un `gh auth switch` cambiaría la identidad de todos
  los proyectos a la vez.
- Un byte de control (NUL) dentro del script hace que el hash de la CSP nunca cuadre: el parser de
  HTML lo convierte en `U+FFFD`. Ya pasó una vez. `build-csp.js` no lo detecta.
- `caches` no existe en Node: las pruebas del Worker lo simulan.
- **Pages cachea el HTML unos diez minutos.** Tras subir un cambio, el navegador sigue sirviendo el
  anterior un rato: para comprobarlo al momento hay que forzar recarga o añadir `?v=algo`. Pasó
  durante el E2E y parecía que el arreglo no funcionaba.
- La cabecera va justa de ancho a 390 px. Por eso el recuento de personas desaparece del estado de
  sincronización cuando hay chip de club (`syncLabel(corto)`), y por eso `.hsync span` lleva
  `nowrap` + elipsis: si se parte en dos líneas, descoloca toda la cabecera.
- `otrosIdx` (el índice de tus otros clubes) se calcula una vez y no se invalida. Es correcto porque
  cambiar de club **recarga la página**; si algún día el cambio deja de recargar, hay que invalidarlo.
- El repo de datos necesita tener la rama `main` creada (un `README` vale) antes del primer club.

---

## 10. Lo que sigue sin arreglo técnico

Cualquier miembro de un club puede mover, añadir y **borrar títulos**. Es un tablero compartido, no un
sistema de permisos por casilla. Y los enlaces son personales: si le pasas el tuyo a alguien, esa
persona *es* tú.
