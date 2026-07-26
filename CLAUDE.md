# Sofa Club — notas para sesiones de Claude Code

## Cuenta de GitHub: NO es alexZ2M

Este repositorio vive en una **cuenta de GitHub distinta** de la habitual, a propósito, para que sus
GitHub Pages no compartan origen web con los demás proyectos.

Reglas, sin excepciones:

- **No uses `gh` aquí.** El `gh` de esta máquina es el ayudante de credenciales de todas las
  operaciones HTTPS contra github.com y está autenticado como `alexZ2M`. Un `gh auth switch`
  cambiaría la identidad de *todos* los proyectos a la vez.
- El remoto usa el alias SSH `github-sofaclub`, no `github.com`. Si `git remote -v` no lo muestra,
  para y avisa antes de empujar nada.
- La autoría va configurada en el repo (`git config user.email`). No la cambies al global.

Y al revés: si estás trabajando en cualquier otro proyecto, **no toques nada de esta carpeta ni de
`~/.ssh/config`**.

## Tras editar el JavaScript de `index.html`

```bash
node build-csp.js
```

La CSP declara el SHA-256 del bloque de script. Si no lo recalculas, el navegador lo bloquea y la
página no arranca. Es a propósito.

## Para probar en el móvil sin esperar a Pages

```bash
node servir.js          # sirve la carpeta con no-store, en la wifi local
```

Manda `no-store` en todo, que es lo que importa: contra Pages el móvil se queda
diez minutos con la copia vieja y parece que tu cambio no funciona.

## Antes de dar nada por bueno

```bash
node test-worker.mjs
node test-app.js
```

## Lo que no se toca sin pensarlo dos veces

- Las operaciones personales del Worker (`setRating`, `setHype`, `addNote`, `updateProfile`,
  `splitOut`) **no reciben identificador de usuario** y no deben recibirlo nunca. El «quién» sale del
  secreto. Añadir ese parámetro reabre la suplantación.
- `vistaPublica()` es lo que impide que salgan `secretHash` e `invites` en las respuestas.
- Los saneadores del navegador (`okColor`, `okEmoji`, `okImgPath`, `safeItem`) son la última frontera
  antes del DOM: los textos de TMDB los editan terceros. `leerCacheDe()` también sanea, porque la
  copia local es texto de `localStorage` y acaba en el DOM.
- **Se pinta por zonas y cada una compara su HTML antes de tocar el DOM.** No vuelvas a un
  `innerHTML` del documento entero: las animaciones CSS se reproducen en cada repintado y eso es un
  parpadeo constante. Los envoltorios `.rgn` llevan `display:contents` porque la cabecera es
  `sticky`; si generan caja, deja de pegarse.
- **Las hojas se abren con `abrirHoja()`, nunca con `setS({sheet:…})`.** Cada hoja es una entrada del
  historial, y ahí es donde vive la verdad sobre cuántas hay abiertas: por eso el botón atrás del
  móvil cierra la hoja en vez de salirse de la app. Abrirla a mano descuadra el historial.
- **Los gestos escriben estilos, no estado.** Un `setS` por `pointermove` reconstruía el documento
  sesenta veces por segundo. Lo que pinta un gesto se pierde al repintar esa zona, y así debe ser.
- **El service worker va a la red primero, y la caché es sólo el paracaídas de estar sin
  cobertura.** No lo inviertas «para que cargue rápido»: el JavaScript se ejecuta porque su SHA-256
  está en la CSP del propio `index.html`, así que servir un `index.html` viejo de la caché es una
  pantalla en blanco, en el móvil y sin forma de arreglarla desde ahí. Si algún día se cachea de
  verdad, la caché tiene que llevar la versión en el nombre y vaciarse en cada despliegue.
- **La app ya no es un solo archivo.** Para poder instalarse necesita `manifest.webmanifest`, `sw.js`
  y los PNG de `iconos/` — el manifiesto y el service worker no admiten ir en línea, y iOS no acepta
  un icono SVG. `index.html` sigue siendo la app entera; esos cuatro son el envoltorio.
- **Hay contratos que están escritos en dos sitios y tienen que decir lo mismo.** El navegador y el
  Worker validan por separado a propósito, pero si no coinciden, la app pinta una cosa y el servidor
  guarda otra —o responde 400 y el cambio se deshace solo delante del usuario—. Los que hay hoy:
  el **rango de ganas** (1–5, por defecto 3: `HYPE_MAX`/`HYPE_POR_DEFECTO` en el Worker, `clampN` en
  `safeItem`), el **primer episodio al pasar a «viendo»** (`{s:1,e:1}` en los dos), y la **lista de
  operaciones** — una `op` que el navegador sepa mandar y el Worker no sepa recibir es un 400.
- **Una página del cliente es una página de TMDB.** El buscador ya no pide una segunda página para
  rellenar la primera: con paginación de verdad, ese relleno sólo hacía que dos páginas seguidas se
  solapasen y «ver más» pareciera agotado antes de tiempo.
- **El estado es de cada club, no de cada persona**, y no debe volverse global: con la regla del
  colapso, mover una tarjeta mueve a todos los que van en ella, así que un estado global dejaría a
  un club moviendo el tablero de otro. Todo lo que cruza clubes (estante, perfil preseleccionado,
  pistas de «esto ya lo tienes en el otro») se calcula **en el cliente**, desde las claves y las
  copias locales que ya tiene el dispositivo. Sin peticiones y sin contarle nada al servidor.
