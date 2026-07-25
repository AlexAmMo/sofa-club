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
- **El estado es de cada club, no de cada persona**, y no debe volverse global: con la regla del
  colapso, mover una tarjeta mueve a todos los que van en ella, así que un estado global dejaría a
  un club moviendo el tablero de otro. Todo lo que cruza clubes (estante, perfil preseleccionado,
  pistas de «esto ya lo tienes en el otro») se calcula **en el cliente**, desde las claves y las
  copias locales que ya tiene el dispositivo. Sin peticiones y sin contarle nada al servidor.
