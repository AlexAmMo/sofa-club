# Sofa Club 🛋️

Tablero kanban privado de series y películas para verlas en compañía. Admite **varios clubes
independientes** — la pareja por un lado, los amigos por otro — que no se ven ni se tocan entre sí.

Cada persona tiene **su propio estado y su propio progreso** en cada título. La interfaz muestra un
solo control cuando coincidís y se desdobla en uno por persona cuando no. Un mismo título puede
aparecer a la vez en varias columnas, y eso es correcto.

El progreso enseña la temporada, el episodio y también **el número absoluto** — «T22 · E5 · nº 1093»
—, porque quien ve anime tiene delante un reproductor que cuenta así. Solo aparece cuando aporta
algo: en una serie de una temporada sería decir dos veces el mismo número.

---

## Las tres piezas

| pieza | dónde vive | quién la ve |
|---|---|---|
| `index.html` | repo **público** `sofa-club`, servido por Pages | todo el mundo |
| `worker/` | Cloudflare. La autoridad: identidad, permisos, TMDB y escritura | nadie, solo responde |
| `data/<club>.json` | repo **privado** `sofa-club-data` | solo el Worker |

Son dos repositorios a propósito. Pages en el plan gratuito exige repo público, y ahí no pueden estar
vuestras notas y puntuaciones; el repo de datos va privado y no sirve ninguna página. Además el token
del Worker se acota **solo al repo de datos**, así que ni siquiera alcanza al de la app.

**El navegador nunca ve un token de GitHub ni de TMDB.** Cada persona sostiene un secreto propio que
solo sirve para hablar con el Worker y que lleva dentro a qué club pertenece.

De ahí salen las tres garantías, y ninguna depende de la buena fe:

1. **Identidad.** Las operaciones personales — nota, ganas, comentarios, perfil — no llevan
   parámetro de usuario. El «quién» sale del secreto. Escribir en nombre de otro no está prohibido:
   es que no se puede expresar.
2. **Clubes.** El club va dentro del secreto y determina qué archivo se abre. Un secreto de un club
   no puede nombrar el archivo de otro.
3. **Metadatos.** Al añadir un título solo se acepta el id de TMDB; la ficha la trae el Worker. El
   cliente no puede inyectar ni un título.

Lo compartido sigue compartido a propósito: **estado y progreso** los puede mover cualquiera del
club, porque mover una tarjeta colapsada mueve a todos los que van dentro. Eso es la app, no un
descuido.

---

## Puesta en marcha

> **El paso a paso completo, con las comprobaciones de cada tramo, está en
> [`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md).** Lo de aquí abajo es el resumen.

### 1. Una cuenta de GitHub aparte

**Hazlo en una cuenta nueva, no en la que usas para tus proyectos.** Todos los GitHub Pages de una
cuenta comparten un mismo origen web (`usuario.github.io`), y eso significa `localStorage` y cookies
compartidos entre tus webs. Una cuenta dedicada corta ese hilo de raíz y no cuesta nada.

Ábrela en un **perfil de navegador distinto**, o acabarás creando el repo bajo tu cuenta de siempre.

### 2. Los dos repos

**`sofa-club` (público)** — sube `index.html`, `.nojekyll`, `LEEME.md` y `CLAUDE.md`.
En **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

**`sofa-club-data` (privado)** — créalo vacío salvo un `README.md` cualquiera, para que exista la rama
`main`. **`data/` no lo crees a mano**: cada club aparece solo cuando lo creas en el paso 6.

En los dos: **Settings → Actions → General → Disable actions**.

### 3. El token de GitHub (para el Worker, no para el navegador)

**Developer settings → Personal access tokens → Fine-grained tokens.**

- *Repository access*: **Only select repositories** → **`sofa-club-data` y solo ese**.
- *Permissions → Repository permissions → **Contents: Read and write***. Nada más.
- *Account permissions*: todo en **No access**.

Tiene que empezar por `github_pat_`. Un token clásico (`ghp_`) alcanza toda la cuenta: no sirve.

### 4. La clave de TMDB

Cuenta gratis en [themoviedb.org](https://www.themoviedb.org) → **Ajustes → API** → copia el
**API Read Access Token** (el largo, de lectura v4).

### 5. Desplegar el Worker

```bash
cd worker
# edita wrangler.toml: REPO, APP_URL y APP_ORIGIN con tu cuenta nueva
npx wrangler login
npx wrangler secret put GITHUB_TOKEN     # el del paso 3
npx wrangler secret put TMDB_TOKEN       # el del paso 4
npx wrangler secret put ADMIN_KEY        # invéntate una larga; es tu llave maestra
npx wrangler deploy
```

Te dará una URL tipo `https://sofa-club.TU-SUBDOMINIO.workers.dev`. **Ponla en `index.html`**, en la
constante `WORKER_URL` de arriba del archivo, y ejecuta:

```bash
node build-csp.js      # mete la URL en la CSP y recalcula el hash del script
```

Sin ese paso el navegador bloquea las llamadas y la app no guarda nada.

### 6. Crear un club

Uno por cada grupo. El nombre va en minúsculas, sin espacios:

```bash
curl -X POST https://sofa-club.TU-SUBDOMINIO.workers.dev/admin/group \
  -H "X-Admin-Key: TU_ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"group":"pareja","ownerName":"Alex","ownerEmoji":"🐻"}'
```

Te devuelve **tu enlace personal**. Ábrelo y ya estás dentro.

**Y esto sólo hace falta una vez.** A partir de ahí, cualquiera que esté dentro de un club puede
crear otros desde *tus clubes → crear un club nuevo*, sin pasar por la terminal ni conocer la
`ADMIN_KEY`. Crear un club escribe en el repositorio, así que no puede hacerlo quien dé con la URL
por casualidad — pero sí quien ya fue invitado, que es donde está la puerta de verdad.

### 7. Invitar

Desde **Ajustes → invitar a alguien**. Genera un enlace **de un solo uso y siete días de validez**.
Quien lo abre elige nombre, bicho y color, y el Worker le crea **su propia clave** — distinta de la
tuya y de la de todos.

### Varios clubes en el mismo móvil

En cuanto tienes más de uno, en la cabecera aparece el nombre del club: tócalo y sale **tus clubes**,
con lo que llevas en cada uno y a quién tienes dentro. Cambiar es instantáneo.

Sigues siendo **una persona distinta en cada club**, con su clave: eso no cambia, y es lo que impide
que un club toque los datos de otro. Lo que sí sabe que eres la misma persona es tu móvil, y por eso
puede hacer dos cosas que no cuestan ni una petición ni le cuentan nada a nadie:

- **preseleccionar tu nombre, bicho y color** al entrar en un club nuevo, para que no lo teclees otra
  vez (puedes cambiarlo allí mismo, y ser otra persona si te apetece);
- **avisarte de lo que ya tienes en el otro club**: «en «pareja» la tienes en 👀 viendo, por la
  T2 E3». Eso lo ves sólo tú y sólo en ese móvil.

Desde ahí también puedes **salir de un club en ese dispositivo**: se borran de él tu clave y su copia
del tablero. El club sigue igual para los demás; para volver necesitarás otra invitación.

Añadid la página a la pantalla de inicio y queda como una app.

---

## Sin claves

Abierto sin nada configurado, arranca en **modo demo** con datos de ejemplo y un aviso. Nada se
guarda. Sirve para enseñarlo antes de montar nada.

---

## Cómo funciona por dentro

- **Escrituras optimistas.** El cambio se pinta al instante y la operación sale detrás; la respuesta
  del Worker manda y corrige cualquier desvío. Los toques repetidos sobre lo mismo (episodios, ganas,
  notas) se funden en un solo envío, así que ni esperas ni se genera un commit por episodio.
- **Sin conexión** se encola y se sube al volver.
- **Conflictos.** El Worker es el único que escribe: lee, aplica y guarda, y si otra invocación se le
  adelanta reintenta con el archivo fresco.
- **Refresco** al recuperar el foco y cada 60 s.
- **Secretos.** En el repo solo se guarda un hash SHA-256; la clave en claro no está en ningún sitio
  salvo en el móvil de su dueño. Echar a alguien invalida su clave al instante.
- **TMDB** lo proxea el Worker, con caché de seis horas en el borde.

De regalo, el `git log` del repo es el historial de vuestros clubes.

---

## Pruebas

```bash
node test-worker.mjs    # 44 · identidad, aislamiento entre clubes, secretos, buscador
node test-app.js        # 45 · saneado antes del DOM, claves, copias locales, perfil, episodios, hojas
```

`test-worker.mjs` levanta un GitHub y un TMDB de mentira en memoria y comprueba lo prometido: que
colar un `userId` ajeno no cambia la nota de nadie, que el autor de un comentario lo pone el
servidor, que una clave de un club no toca los datos de otro, que los secretos no salen nunca en las
respuestas ni en disco, y que expulsar a alguien invalida su clave en el acto.

---

## Seguridad

### Qué protege qué

- **El secreto personal** es lo único que hay en cada navegador. Solo sirve para hablar con el
  Worker, solo alcanza a su club, y solo permite hacer de su dueño.
- **El token de GitHub** vive únicamente en el Worker. Está acotado a este repositorio y a
  Contenidos: no puede tocar ningún otro repo, ni borrar este, ni actuar en tu nombre.
- **La `ADMIN_KEY`** es tu llave maestra: crea clubes. No la repartas ni la metas en el repo.
- **CSP con hash.** Solo se ejecuta el JavaScript cuyo SHA-256 está declarado en el `<meta>` de
  `index.html`, y `connect-src` solo permite el Worker. Un script inyectado no arranca y no tendría a
  dónde exfiltrar nada. **Si tocas el JavaScript, ejecuta `node build-csp.js`.**
- **Saneado en dos capas.** El Worker valida todo lo que entra; el navegador vuelve a sanear todo lo
  que sale del Worker antes de pintarlo — nombres, notas y textos de TMDB los escriben personas.

### Lo que ya no es un problema

Antes, quien tenía el enlace podía escribir en el repositorio. Ahora **nadie más que tú escribe en
el repo**, así que un miembro no puede modificar `index.html`, y por tanto no puede usar el origen
compartido de Pages para nada. Además la revocación es por persona: quitar a alguien es un botón, no
rotar el token y repartir enlaces nuevos a todo el mundo.

### Lo que sigue sin arreglo técnico

Cualquier miembro de un club puede mover, puntuar lo suyo, añadir y **borrar títulos** del club. Es
un tablero compartido, no un sistema de permisos por casilla. Y si le pasas tu propio enlace a
alguien, esa persona *es* tú: los enlaces son personales.

---

## Trabajar en este repo sin liarla con tus otras cuentas

Este proyecto vive en una cuenta de GitHub distinta de la habitual. Para que no se crucen:

**No añadas esta cuenta a `gh`.** El `gh` de tu máquina es el ayudante de credenciales de *todas* las
operaciones HTTPS contra github.com; si algún día hay dos cuentas ahí, un `gh auth switch` cambia la
identidad de todos tus proyectos a la vez y en silencio.

Usa SSH con un alias de host, que escribe la identidad en la propia URL del remoto:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_sofaclub -C "sofa-club"
```

```
# ~/.ssh/config
Host github-sofaclub
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_sofaclub
  IdentitiesOnly yes
```

```bash
git remote add origin git@github-sofaclub:CUENTANUEVA/sofa-club.git
git config user.name  "tu nombre"
git config user.email "TUUSUARIO@users.noreply.github.com"
```

Así no hay ningún estado global que confundir: cualquier otro repo tuyo sigue usando
`https://github.com/…` con tu cuenta de siempre, y desde aquí es imposible alcanzarla.

---

Fichas y carátulas de [TMDB](https://www.themoviedb.org), que no avala este proyecto.
