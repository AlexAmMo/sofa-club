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
| Interfaz | completa, verificada en navegador y **en producción** |
| Worker | completo, 44 pruebas contra GitHub y TMDB simulados |
| Navegador | 45 pruebas de saneado, claves, copias locales, perfil, numeración y hojas |
| Despliegue | **hecho**: Worker en Cloudflare, app en Pages, dos repos en la cuenta AlexAmMo |
| E2E real | **hecho** el 25 de julio de 2026 contra GitHub, Cloudflare y TMDB de verdad |

En producción:

- app: `https://alexammo.github.io/sofa-club/` (repo público `AlexAmMo/sofa-club`)
- Worker: `https://sofa-club.mysofaclub.workers.dev`
- datos: repo privado `AlexAmMo/sofa-club-data` — **vacío**: los clubes de prueba se borraron
- el remoto de git usa el alias SSH `github-sofaclub` (clave `~/.ssh/id_sofaclub`)

### Lo que queda pendiente, y no es código

1. **Rotar las credenciales.** Durante la puesta en marcha del 25 de julio los cuatro secretos
   pasaron por una conversación de chat: los dos tokens de GitHub, el de TMDB y la `ADMIN_KEY`. Se
   dan por quemados. Revocar los de GitHub en su pantalla, regenerar el de TMDB y cambiar la
   `ADMIN_KEY` con `wrangler secret put`.
2. **Crear el club de verdad** con la `ADMIN_KEY` nueva y repartir invitaciones. Ese enlace no se
   pega en ningún chat: quien lo tiene *es* su dueño.

Decisión aplazada: **dominio propio**. Se puede acortar la URL sin comprar nada renombrando el repo
a `alexammo.github.io` (se serviría en la raíz), y eso **no** rompe las claves de nadie porque el
path no forma parte del origen. Cambiar de dominio sí las rompería, así que si algún día se hace,
mejor antes de repartir enlaces.

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
| El progreso enseña temporada **y número absoluto**: «T22 · E5 · nº 1093» | quien ve anime tiene delante un reproductor que dice «episodio 1093», no «T22 E5». Ver §5 |

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

**Por qué crear un club no pide la `ADMIN_KEY` pero sí una clave.** Crear un club escribe un archivo
en el repositorio, así que abrirlo del todo convertiría el repo privado en almacenamiento gratuito
para cualquiera que diera con la URL del Worker. Pero exigir la llave maestra obligaba a abrir una
terminal cada vez. La línea está en `/api/group`: **pide un secreto válido de cualquier club**, es
decir, demuestra que alguien te invitó. La puerta ya la guarda la invitación; esto sólo se apoya en
ella. Hay además un tope de 200 clubes como cortafuegos, por si alguien invitado se desmadra. El
primer club de todos sigue siendo cosa de `/admin/group`.

**Por qué el progreso enseña dos números.** TMDB modela el anime por temporadas, como una serie
occidental, pero quien lo ve cuenta en absoluto: el reproductor dice «episodio 1093», no «T22 E5». Y
TMDB no es coherente ni consigo mismo — en One Piece los episodios llevan numeración absoluta dentro
de la temporada y en Naruto o Hunter x Hunter no —, así que no hay regla que escribir. El número
absoluto ya se calculaba (`absEp`, para la barra de progreso); lo único que faltaba era enseñarlo.
`epTxt` lo añade **sólo cuando aporta**: en una serie de una temporada sería decir dos veces el mismo
número. No hace falta ningún proveedor nuevo ni cambia el formato de datos.

**Por qué el buscador mira una segunda página, pero no siempre.** TMDB ordena por popularidad y
mezcla personas entre los resultados, así que una temporada concreta de una franquicia grande cae a
menudo por debajo del puesto 20. Se pide la segunda página **sólo si la primera no llenó la lista**:
la mayoría de búsquedas siguen siendo una única petición y la segunda se paga cuando hacía falta.

**Por qué se pinta por zonas y no el documento entero.** Era `root.innerHTML = view()` en cada cambio
de estado. Como los nodos salían nuevos, **las animaciones CSS se reproducían desde el principio**: la
de entrada de las tarjetas arranca en `opacity:0`, así que cualquier repintado desvanecía el tablero
entero y lo traía de vuelta. Eso, unido a que el repaso de cada minuto emitía siempre, es lo que se
veía como un parpadeo constante. Ahora hay cinco zonas (`rhead`, `rmain`, `rnav`, `rfloat`, `rsheet`),
cada una recuerda el HTML que pintó y sólo toca el DOM si ha cambiado. Los envoltorios llevan
`display:contents`, o sea que **no generan caja** y para el diseño la estructura es la de siempre —
importa, porque la cabecera es `position:sticky` y meterla en un `div` normal la dejaría pegada a un
contenedor de su propia altura, que es como no pegarla a nada.

**Por qué las tarjetas sólo se animan si son nuevas.** `data-anim="in"` lo llevaban todas siempre.
Ahora se compara con las que había en el repintado anterior (`vistas`). Las animaciones deliberadas
—`land`, `split`, `join`— siguen intactas: ésas las pide `flash()` a propósito.

**Por qué los gestos no pasan por el estado.** Deslizar una tarjeta hacía un `setS` por `pointermove`:
unas sesenta reconstrucciones del documento por segundo, cada una reproduciendo la animación de
entrada de todo. Ahora el gesto escribe el estilo del elemento que se mueve y el estado sólo se entera
al soltar, que es cuando de verdad ha pasado algo. Lo mismo con el arrastre de escritorio, el dock, la
hoja que se baja con el dedo y las carátulas de la ruleta.

**Por qué se puede arrastrar la hoja desde cualquier sitio.** Al principio sólo valía la barrita —21 px
de alto— y había que recorrer 90 px enteros: en el móvil resultaba casi imposible cerrarla así. Ahora
se arrastra desde todo el cuerpo de la hoja, que es lo que la gente intenta antes de buscar el
tirador, y basta con soltarla con impulso (`v > .4 px/ms`) o recorrer un 22 % de su alto. Dos reglas
sostienen el invento sin romper nada: **no se decide al tocar, se decide al mover** —descartar al
`pointerdown` todo lo que fuera `[data-a]` dejaba el gesto reducido otra vez a la barrita, porque casi
todo el contenido de una hoja está dentro de algo pulsable—, y sólo se arrastra **si el contenido está
arriba del todo**; si está desplazado, tirar hacia abajo es leer. Los campos de texto quedan fuera,
que ahí arrastrar significa seleccionar.

**Por qué las hojas empujan una entrada en el historial.** Sin eso, el botón atrás del móvil hacía lo
que hace en cualquier página: salirse — y en la app instalada, cerrarla. Ahora cada hoja abierta es
una entrada, y **quien manda sobre cuántas hay abiertas es el historial**: al volver, `popstate` dice
a qué profundidad quedarse y `recortarPila()` recorta. Por eso cerrar nunca toca el estado a mano,
sino que pide un paso atrás y espera a que llegue. Las hojas además se apilan, así que contestar a una
confirmación devuelve al título que estabas mirando y no al tablero.

**Por qué CSP con hash.** GitHub Pages no permite cabeceras, así que va en un `<meta>` con el SHA-256
del bloque de script. Bloquea cualquier script inyectado, y `connect-src` limita la salida al Worker.

**Por qué `.gitattributes` con `* -text`.** Git en Windows convierte los finales de línea, y el hash
de la CSP se calcula sobre el contenido exacto. Sin eso, el archivo que sirve Pages podría no cuadrar
con su propio hash y la página no arrancaría, con una pantalla en blanco por toda pista.

---

## 6. Mapa de archivos

```
sofa-club/
├── index.html          la app entera. Un archivo, sin build
├── .nojekyll           Pages sirve tal cual
├── .gitattributes      `* -text`: sin conversión de finales de línea  ← protege el hash de la CSP
├── build-csp.js        recalcula el hash del script y el connect-src  ← OBLIGATORIO tras tocar JS
├── servir.js           servidor local con `no-store`, para probar en el móvil sin esperar a Pages
├── test-app.js         45 pruebas: saneado antes del DOM, claves, copias locales, perfil, episodios, hojas
├── test-worker.mjs     44 pruebas: identidad, clubes, secretos, creación de clubes, buscador
├── worker/
│   ├── src/index.js    el Worker
│   ├── wrangler.toml   REPO, BRANCH, APP_URL, APP_ORIGIN
│   └── package.json    type: module
├── LEEME.md            qué es y cómo funciona
├── CREDENCIALES.md     qué credenciales hacen falta, con qué alcance y cómo se rotan
├── CLAUDE.md           reglas para sesiones de Claude Code (¡la cuenta de GitHub!)
└── HANDOFF.md          este archivo
```

Dentro de `index.html`, en orden: tokens CSS y estilos · configuración y claves · saneadores y
`publicView` · `IMG`/`aplicarLocal`/`sanear`/`createApi` · `demoSeed` · constantes de la interfaz ·
`cardHtml`/`buildCards` · cabecera, tablero, nav · las nueve hojas · `zonas`/`render` · navegación
entre hojas · acciones · gestos · arranque.

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
// además: isDemo, hasTmdb, authFailed, repoName, retry, boot
// invitaciones: unirse(perfil)  hayInvitacion()  clubInvitado()  invitacionSobraba()
// crear un club estando ya en otro: crearClub(nombre, {name,emoji,color})
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

**`test-worker.mjs`** (44): el título lo pone TMDB y no el cliente · colar un `userId` ajeno no cambia
la nota de nadie · el autor de un comentario lo pone el servidor · no se borra la nota de otro · quien
no creó el club no echa a nadie · un club no ve los títulos ni la gente de otro · una clave con otro
club por delante no entra · los secretos no salen en las respuestas ni en disco · expulsar invalida la
clave al instante · los acentos sobreviven al base64 · quien está en un club puede crear otro pero
quien no tiene clave no, ni con una inventada, ni con la de alguien a quien echaron · el buscador
nunca devuelve personas, mira la segunda página cuando la primera no llena la lista y no repite un
título que salga en las dos.

**`test-app.js`** (40): saneadores contra entradas hostiles · varias claves conviviendo · renovar la
clave de un club sustituye la vieja · una invitación se recoge pero no se guarda · cada club guarda
su copia local y una copia manipulada se sanea al leerla · salir de un club se lleva su clave y su
copia y no toca las demás · el perfil del dispositivo se recuerda con acentos y se sanea · el número
absoluto de episodio suma bien las temporadas anteriores y no se enseña cuando sería el mismo número ·
la pila de hojas se recorta a la profundidad que pide el historial, y volver desde una confirmación
apilada devuelve al detalle y no al tablero (`absEp`, `epTxt` y `recortarPila` se extraen de
`index.html` por su nombre y se evalúan solas, para probar el código de verdad y no una copia que
envejecería en silencio).

**En navegador, midiendo con un `MutationObserver` por zona** (que es la única forma honesta de
comprobar que algo *no* se repinta): veinte repintados sin cambios de estado tocan **cero nodos** ·
cambiar de pestaña toca cabecera y tablero, nada más · abrir una hoja toca la hoja y la barra, y **no
el tablero** · escribir cinco letras en el buscador toca la hoja dos veces (las del rebote), deja el
tablero intacto y conserva el foco y el cursor · **deslizar una tarjeta entera no toca un solo nodo**,
y al soltar pasada la mitad se mueve de verdad · la hoja se desliza al abrirse y no vuelve a hacerlo
mientras escribes · atrás cierra la hoja sin salir de la página, y desde una confirmación apilada
devuelve al título · el botón de cerrar mide 44×44 · sin errores de consola ni scroll horizontal.

**En navegador, con dos clubes sembrados y un Worker de mentira en local:** el chip del club aparece
sólo con más de uno · cambiar de club repinta el tablero al instante desde la copia local · la pista
cruzada sale en el detalle y al añadir · salir de un club deja el otro intacto y conserva el perfil ·
sin errores de consola, sin scroll horizontal a 390 px y con las zonas pulsables de la cabecera en
44 px (que son 24 y 18 px de caja, ampliados con `::after`).

**E2E real, 25 de julio de 2026**, contra el Worker, GitHub y TMDB de verdad, desde la URL pública:

- el enlace mágico entra y **borra solo el `#s=` de la barra**
- TMDB busca en español y trae carátulas · las plataformas (`watch/providers`) también llegan
- cada operación aterriza en el repo privado, **un commit por operación**
- `"Álex Muñoz"` y `🐙` sobreviven intactos a navegador → Worker → base64 → GitHub
- en el repositorio sólo hay `secretHash`; la clave en claro no aparece
- una invitación se canjea **una vez**: al segundo intento, `invitacion-invalida`
- **la suplantación es inexpresable**: desde la clave de Nuria, colando el id de Álex en cuatro
  parámetros distintos, sólo se puntuó a sí misma. La nota de Álex no se movió
- un club no abre el archivo de otro, ni con travesía de directorios en el nombre
- crear un club desde la interfaz, sin `ADMIN_KEY`, funciona y normaliza el nombre
  («Cine de Barrio» → `cine-de-barrio`)
- el archivo que sirve Pages es **byte a byte idéntico** al local y su hash de CSP cuadra

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
- **La bienvenida es lo que canjea las invitaciones.** Si algún día se toca la condición que la
  muestra, ojo: durante el E2E se descubrió que sólo aparecía cuando no tenías identidad válida, así
  que en un móvil que ya estaba en un club **el enlace de invitación no hacía nada** — ni hoja, ni
  aviso, ni clave. Entrar en un segundo club era imposible. Ahora la condición incluye
  `Api.hayInvitacion()`, y quitarlo reabre el mismo agujero.
- **Un `GET` no mide el alcance de un token de GitHub.** El repo de la app es público y responde 200
  a cualquiera, con token o sin él. Para saber si un token puede escribir en un repositorio hay que
  mandar un `PUT` con el cuerpo vacío: `422` significa autorizado (falló la validación), `403` que
  no. Esa sonda no escribe nada. La comprobación equivocada estuvo un rato en la guía y hacía pensar
  que el token estaba mal cuando estaba perfecto.
- **En PowerShell, `curl` no es curl** — es `Invoke-WebRequest` disfrazado. Hay que escribir
  `curl.exe`. Y mandar JSON por `-d` desde PowerShell es una fuente de disgustos con las comillas:
  para eso está `Invoke-RestMethod`, que no tiene el problema.
- **Una animación CSS gana a un estilo en línea.** Está en la cascada por encima, así que mientras
  `.sheet.anim` estuviera puesta con `animation-fill-mode:both`, el `transform` que escribe el
  arrastre **no se veía**: la hoja no seguía al dedo aunque el atributo dijera lo contrario. Por eso
  el relleno es `backwards` y no `both`, y por eso `fijarHoja()` quita la clase antes de arrastrar.
  Ojo al comprobarlo: mirar `el.style.transform` no sirve de nada, hay que medir
  `getBoundingClientRect()`.
- **Restaurar la transición y cambiar la propiedad en el mismo tick no anima.** El navegador compara
  con el estilo de *antes* del cambio, donde la transición era `none`. Entre las dos cosas hay que
  forzar un recálculo leyendo `offsetHeight`. Se hace así y no con `requestAnimationFrame` para que
  la hoja vuelva a su sitio aunque el navegador no esté dando fotogramas.
- **El navegador de las pruebas no siempre pinta.** En las comprobaciones con Playwright se midió
  **un fotograma en 300 ms**: todo lo que dependa de transiciones o animaciones queda congelado y da
  resultados que parecen fallos. Lo que sí es fiable ahí es la geometría sin transición. Si una
  medida de animación sale rara, comprueba primero el reloj de fotogramas.
- **El alto de las hojas no se mide en `vh`, y hay motivo.** `100vh` es el viewport **grande**, el de
  la barra de URL escondida, mientras que `.ov` ocupa el visible. Con `92vh` la hoja podía pedir más
  alto del que había y, al estar pegada abajo con `align-items:flex-end`, desbordaba **hacia arriba**:
  el borde superior, el tirador y el botón de cerrar se salían de la pantalla. Ahora es
  `min(92dvh,92%)` — `dvh` sigue al viewport visible y el `%` se mide contra el propio contenedor —
  y `.ov` reserva arriba el hueco de la muesca. Volver a `vh` reabre el recorte, y sólo se ve en un
  móvil de verdad: en el navegador de escritorio no pasa nunca.
- **Los envoltorios de zona (`.rgn`) llevan `display:contents` y no es decorativo.** Si alguno pasa a
  generar caja, la cabecera `sticky` se queda pegada a un contenedor de su propia altura y deja de
  funcionar, sin ningún error por ninguna parte.
- **`abrirHoja()` es la única forma correcta de abrir una hoja.** Un `setS({sheet:…})` directo la abre
  igual de bien y deja el historial descuadrado: a partir de ahí el botón atrás se come entradas que
  no existen o se sale de la app. Las únicas excepciones a propósito son la bienvenida —que no se
  cierra, porque todavía no eres de ningún club— y los saltos entre detalles del mismo nivel.
- **Lo que escribe un gesto a mano no está en el estado.** El `transform` de la tarjeta, la clase `on`
  de la línea de destino y la `over` del dock se pintan directamente sobre el elemento y desaparecen
  en cuanto se repinta esa zona. Es lo que se quiere, pero si añades un efecto nuevo de gesto,
  recuerda que nadie lo va a reconstruir por ti.
- Si alguna vez vuelve a hacer falta un `.ps1` en este proyecto, va en **UTF-8 con BOM**: PowerShell
  5.1 lee los `.ps1` sin BOM como ANSI y destroza los acentos hasta hacerlo irreparsable, antes
  incluso de llegar a la primera línea. Costó un rato averiguarlo.

---

## 10. Lo que sigue sin arreglo técnico

Cualquier miembro de un club puede mover, añadir y **borrar títulos**. Es un tablero compartido, no un
sistema de permisos por casilla. Y los enlaces son personales: si le pasas el tuyo a alguien, esa
persona *es* tú.

Un miembro puede además **crear clubes nuevos** en tu Worker, que escriben en tu repositorio. El tope
de 200 es un cortafuegos, no un sistema de cuotas: si alguien a quien invitaste abusa, se le quita del
club y sus clubes se borran a mano desde el repo.

**Perder el móvil es perder la clave.** No hay recuperación por correo porque no hay correos: el
remedio es que alguien del club te mande otra invitación. Y al revés, quien encuentre tu móvil
desbloqueado entra en tus clubes — como en cualquier app que no vuelve a pedir contraseña.

---

## 11. Ideas que se estudiaron y se descartaron

Por si vuelven a surgir, con el motivo:

| idea | por qué no |
|---|---|
| Estado global por persona en vez de por club | rompe el aislamiento y filtra lo privado. Ver §5 |
| Una cuenta que cruce clubes | cambia una garantía estructural por una comprobación. Ver §5 |
| Que cualquiera cree clubes sin autenticarse | convierte el repo privado en almacenamiento gratis |
| Dominio propio | el aislamiento de origen ya lo da la cuenta aparte, y cambiarlo después obliga a reinvitar a todo el mundo |
| Un solo repositorio | Pages gratis exige repo público, y las notas y puntuaciones no pueden ser públicas |
| Usar `gh` en esta carpeta | es el ayudante de credenciales global; ver `CLAUDE.md` |
