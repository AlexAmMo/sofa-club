# Puesta en marcha, paso a paso

De cero a un club funcionando contra GitHub, Cloudflare y TMDB de verdad. Cada paso termina con una
**comprobación**: si no da lo que dice, no sigas — el fallo se arregla mucho mejor ahí que tres pasos
después.

Los comandos van en **PowerShell**, tu shell por defecto. Ojo con uno: en PowerShell `curl` no es
curl, es otra cosa disfrazada, así que hay que escribir **`curl.exe`**. Si prefieres Git Bash, quita
el `.exe` y listo.

Necesitas Node instalado (ya lo tienes), git, y las dos cuentas: la de GitHub nueva y una de
Cloudflare.

> **Atajo.** Si ya tienes recogidos los datos de los pasos 1 a 5, los pasos **6 a 10 los hace solos**:
>
> ```powershell
> cd C:\Users\alex\sofa-club
> .\configurar.ps1
> ```
>
> Escribe la URL del Worker, recalcula la CSP, te pide los tres secretos (los pregunta wrangler, y van
> de tu teclado a Cloudflare sin pasar por ningún archivo), despliega, ejecuta las comprobaciones y
> crea el club de prueba. Lo demás de esta guía sigue valiendo para entender qué está haciendo y para
> arreglarlo si algo se tuerce.

---

## La ficha

Ve rellenando esto según avanzas. **Los cuatro secretos no se escriben aquí ni en ningún archivo del
repo**: van a tu gestor de contraseñas y a `wrangler secret`.

| dato | de dónde sale | paso |
|---|---|---|
| usuario de GitHub | tú lo elegiste al crear la cuenta | — |
| repo público de la app | lo creas | 1 |
| repo privado de datos | lo creas | 1 |
| 🔒 token de GitHub | lo generas | 2 |
| 🔒 token de TMDB | cuenta gratuita | 3 |
| subdominio de workers.dev | Cloudflare te lo asigna | 4 |
| 🔒 `ADMIN_KEY` | te la inventas | 5 |
| URL del Worker | te la dice `wrangler deploy` | 7 |
| URL de la app | la forma Pages | 9 |
| 🔒 enlace del club de prueba | te lo devuelve el Worker | 10 |

---

## 1. Los dos repositorios

Ábrelos desde **un perfil de navegador distinto** al de tu cuenta de siempre, o acabarás creándolos
donde no toca. Compruébalo antes de darle a *Create*: arriba a la derecha tiene que aparecer la
cuenta nueva.

**Repo A — la app.** *New repository* → nombre `sofa-club` → **Public** → sin README.
Público no es opcional: GitHub Pages gratis lo exige. Por eso los datos van en otro sitio.

**Repo B — los datos.** *New repository* → nombre `sofa-club-data` → **Private** → **marca
«Add a README file»**. Ese README no es decorativo: crea la rama `main`, y sin rama el Worker no
puede escribir. **No crees la carpeta `data/`**: cada club aparece solo cuando lo creas.

En los dos: *Settings → Actions → General* → **Disable actions**. No hay nada que ejecutar, y así no
hay nada que pueda ejecutarse.

> **Comprobación.** Los dos repos existen, el de datos dice **Private** bajo el nombre, y al abrirlo
> se ve el README y el selector de rama pone `main`.

---

## 2. El token de GitHub

Este token vive **sólo dentro del Worker**. Ningún navegador lo ve nunca.

*Foto de perfil → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
Generate new token.*

Rellena así — aquí es donde se cometen los errores:

| campo | valor |
|---|---|
| Token name | `sofa-club-worker` |
| Expiration | **No expiration** (si caduca, la app deja de guardar sin avisar) |
| Repository access | **Only select repositories** → **`sofa-club-data` y sólo ése** |
| Permissions → Repository → **Contents** | **Read and write** |
| todo lo demás | déjalo en *No access* |

Al final la pantalla debe resumir **«1 repository» y «Contents: Read and write»**. Si dice «All
repositories», vuelve atrás.

Cópialo al salir: **empieza por `github_pat_`**. Si empieza por `ghp_` te has ido a la pestaña
equivocada — ése alcanza *todos* tus repos y no sirve.

> **Comprobación.** Lo que hay que medir es si el token puede **escribir**, no si puede leer: el repo
> de la app es público y lo lee cualquiera, con token o sin él, así que un `GET` no dice nada.
>
> El truco es mandar un `PUT` deliberadamente inválido. Si el token tiene permiso, GitHub llega a
> validar el cuerpo y contesta `422`; si no lo tiene, ni lo mira y contesta `403`. En ningún caso
> escribe nada, porque el cuerpo va vacío a propósito.
>
> ```powershell
> $t = "TOKEN"
> '{}' | Set-Content "$env:TEMP\vacio.json" -Encoding utf8
> foreach ($r in 'sofa-club-data','sofa-club') {
>   $c = curl.exe -s -o NUL -w "%{http_code}" -X PUT -H "Authorization: Bearer $t" `
>          -H "Content-Type: application/json" --data-binary "@$env:TEMP\vacio.json" `
>          "https://api.github.com/repos/USUARIO/$r/contents/zz-sonda.txt"
>   "{0,-16} {1}" -f $r, $c
> }
> Remove-Item "$env:TEMP\vacio.json"
> ```
>
> Lo correcto es **`sofa-club-data → 422`** y **`sofa-club → 403`**. Si el segundo también da 422, el
> token alcanza el repo de la app y el alcance está mal: rehaz el token.

---

## 3. El token de TMDB

Cuenta gratuita en [themoviedb.org](https://www.themoviedb.org) → *Ajustes → API* → si te pide
solicitar acceso, elige uso personal y describe la app en una línea; lo dan al momento.

En esa pantalla hay dos cosas y sólo una vale: copia el **API Read Access Token**, el largo, de
lectura v4. **No** la *API Key* corta.

> **Comprobación:**
>
> ```powershell
> $tmdb = "TOKEN_TMDB"
> curl.exe -s -H "Authorization: Bearer $tmdb" "https://api.themoviedb.org/3/search/multi?query=severance"
> ```
>
> Debe salir un JSON con resultados. Si dice `Invalid API key`, has copiado la corta.
..
---

## 4. Cloudflare y wrangler

Cuenta gratuita en [dash.cloudflare.com](https://dash.cloudflare.com). No hace falta dominio ni
tarjeta: el plan gratis de Workers da 100.000 peticiones al día, que para esto sobra muchísimo.

```powershell
cd C:\Users\alex\sofa-club\worker
npx wrangler login          # abre el navegador; autoriza
npx wrangler whoami
```

`whoami` te dice con qué cuenta has entrado. **Míralo**: si tienes varias sesiones de Cloudflare
abiertas es fácil autorizar la que no es.

El **subdominio de workers.dev** te lo asigna Cloudflare la primera vez. Está en el panel, en
*Workers & Pages* → arriba a la derecha, con forma `algo.workers.dev`. Si nunca has usado Workers, te
lo pedirá al desplegar. Apunta la parte de delante.

> **Comprobación.** `npx wrangler whoami` muestra la cuenta que esperabas y no da error de sesión.

---

## 5. La `ADMIN_KEY`

Ésta te la inventas tú. Es la llave que crea clubes, y nada más: no da acceso a los datos de nadie.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Al gestor de contraseñas. La vas a necesitar cada vez que crees un club.

---

## 6. Los cuatro valores no secretos

Abre `worker/wrangler.toml` y cambia `CUENTANUEVA` por tu usuario en las tres líneas donde aparece:

```toml
REPO       = "USUARIO/sofa-club-data"
BRANCH     = "main"
APP_URL    = "https://USUARIO.github.io/sofa-club/"
APP_ORIGIN = "https://USUARIO.github.io"
```

Tres detalles que cuestan un rato si se fallan:

- `REPO` apunta al **privado**, no al de la app.
- `APP_URL` lleva **barra al final**. Con ella se construyen los enlaces de invitación.
- `APP_ORIGIN` es sólo el origen: **sin** `/sofa-club/`. Si no coincide exacto con el origen desde el
  que se abre la página, el navegador bloquea las llamadas por CORS.

> **Comprobación.** `wrangler.toml` no contiene ningún token. Míralo ahora, antes del primer commit:
> es el archivo donde la gente acaba pegando uno «un momento, para probar».

---

## 7. Cargar los secretos y desplegar

Los tres secretos se escriben aquí, en tu terminal. Wrangler los guarda cifrados en Cloudflare y no
quedan en ningún archivo.

```powershell
cd C:\Users\alex\sofa-club\worker
npx wrangler secret put GITHUB_TOKEN     # el del paso 2
npx wrangler secret put TMDB_TOKEN       # el del paso 3
npx wrangler secret put ADMIN_KEY        # la del paso 5
npx wrangler deploy
```

`deploy` termina imprimiendo la URL. Apúntala: `https://sofa-club.TU-SUBDOMINIO.workers.dev`.

> **Comprobación** — dos llamadas que no tocan datos:
>
> ```powershell
> $w = "https://sofa-club.TU-SUBDOMINIO.workers.dev"
> curl.exe -s "$w/nada"
> curl.exe -s -X POST "$w/api/session" -H "Authorization: Bearer noesunaclave"
> curl.exe -s -X POST "$w/api/session" -H "Authorization: Bearer noexiste.aaaaaaaaaaaaaaaa"
> ```
>
> Las tres deben decir **`sin-ruta`**, **`sin-clave`** y **`sin-clave`**.
>
> La tercera es la interesante y merece una explicación, porque parece igual que la segunda y no lo
> es. `noexiste.aaaaaaaaaaaaaaaa` tiene la **forma** correcta de una clave, así que el Worker no la
> descarta de entrada: se va a GitHub a abrir `data/noexiste.json`. Si vuelve `sin-clave` es porque
> GitHub contestó 404 — es decir, **el token funciona**. Si vuelve `github`, no:
>
> | detalle | qué significa |
> |---|---|
> | `GitHub respondió 400` | lo guardado en `GITHUB_TOKEN` no tiene forma de token (¿quedó vacío?) |
> | `GitHub respondió 401` | el token es válido pero está caducado o revocado |
> | `GitHub respondió 404` | `REPO` mal escrito, o el token no alcanza ese repositorio |
>
> Es una prueba completa del camino Worker → GitHub sin usar ni una credencial tuya. Si no contesta
> nada, revisa `npx wrangler deployments list`.

---

## 8. Apuntar la app al Worker

En `index.html`, la constante de arriba del bloque de JavaScript:

```js
const WORKER_URL = 'https://sofa-club.TU-SUBDOMINIO.workers.dev';
```

Y después, **siempre**:

```powershell
cd C:\Users\alex\sofa-club
node build-csp.js
```

Eso mete la URL en `connect-src` y recalcula el hash del script. Si te lo saltas, el navegador bloquea
las llamadas y la app abre pero no guarda nada.

> **Comprobación.** `build-csp.js` imprime `connect-src → https://sofa-club.TU-SUBDOMINIO.workers.dev`.
> Si sigue apareciendo `tu-subdominio`, no has guardado el archivo.

---

## 9. Subir la app y encender Pages

**Primero, el acceso por SSH.** Aquí no se usa `gh`: es el ayudante de credenciales de *todas* tus
operaciones contra github.com y está autenticado como `alexZ2M`. Un alias de host deja la identidad
escrita en la propia URL del remoto, sin ningún estado global que confundir.

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\id_sofaclub -C "sofa-club"
```

Añade a `~/.ssh/config` (créalo si no existe):

```
Host github-sofaclub
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_sofaclub
  IdentitiesOnly yes
```

Copia el contenido de `id_sofaclub.pub` y pégalo en la cuenta nueva:
*Settings → SSH and GPG keys → New SSH key*.

```powershell
ssh -T git@github-sofaclub          # debe saludarte con el usuario NUEVO
```

Si te saluda con `alexZ2M`, para: el alias no está cogiendo la clave que toca.

**Ahora sí, el primer commit:**

```powershell
cd C:\Users\alex\sofa-club
git init -b main
git config user.name  "tu nombre"
git config user.email "USUARIO@users.noreply.github.com"
git remote add origin git@github-sofaclub:USUARIO/sofa-club.git
git add -A
git status                          # míralo: ningún .env, ningún token en wrangler.toml
git commit -m "sofa club"
git push -u origin main
```

**Encender Pages:** en el repo → *Settings → Pages* → *Source: **Deploy from a branch*** → rama
`main`, carpeta `/ (root)` → *Save*. Tarda un minuto largo la primera vez.

> **Comprobación:**
>
> ```powershell
> curl.exe -s -o NUL -w "%{http_code}`n" https://USUARIO.github.io/sofa-club/
> ```
>
> Un **200**. Ábrela en el navegador: debe salir el tablero en **modo demo** con datos de ejemplo y un
> aviso. Eso significa que la app carga y la CSP no la bloquea. Si la página sale en blanco, el hash
> de la CSP no cuadra: vuelve al paso 8.

---

## 10. Crear el club de prueba

Éste es el momento de la verdad: es la primera vez que el Worker escribe en GitHub.

Aquí no uso `curl.exe`: mandar un JSON por la línea de comandos en Windows es una fuente de disgustos
con las comillas. PowerShell trae su propio cliente y se acabó el problema.

```powershell
$w = "https://sofa-club.TU-SUBDOMINIO.workers.dev"
$admin = "TU_ADMIN_KEY"
$r = Invoke-RestMethod -Method Post -Uri "$w/admin/group" `
       -Headers @{ "X-Admin-Key" = $admin } -ContentType "application/json" `
       -Body '{"group":"prueba","ownerName":"Alex"}'
$r.link
```

Te imprime **tu enlace personal**: `https://USUARIO.github.io/sofa-club/#s=prueba.xxxxx`.
**Ese enlace eres tú**: quien lo tenga entra como tú. No lo reenvíes ni lo pegues en un chat.

Si te salta un error en vez del enlace: `401` es la `ADMIN_KEY` mal, `409` es que ese club ya existe,
y `502` es que el token de GitHub no llega — vuelve a la comprobación del paso 2.

El nombre del club va en minúsculas, números y guiones, de 2 a 31 caracteres. Si quieres color, tiene
que ser de seis dígitos (`#FF8FD0`); el bicho lo cambias luego en Ajustes, que es más cómodo que
pelearse con emojis en la terminal.

> **Comprobación.** Abre el repo **privado**: tiene que haber aparecido `data/prueba.json`, con un
> commit llamado *«sofa club · nace el grupo prueba»*. Ábrelo: verás tu persona y un `secretHash`.
> Que ahí haya un hash y no tu clave es justo lo que se quería.

---

## 11. El recorrido E2E

Ahora sí, con todo real. Ve marcando:

**Entrar.** Abre el enlace en el móvil. Debe entrar directo, y **la barra de direcciones se queda sin
el `#s=…`** — la clave se guarda y el enlace se limpia solo. Añádelo a la pantalla de inicio.

**Buscar y añadir.** Botón `+` → busca algo. Si salen resultados con carátula, TMDB funciona a través
del Worker. Añade una serie a *Nos apetece*.

**Escribir de verdad.** Muévela a *Viendo* y dale a *siguiente episodio*. En el repo privado tiene que
aparecer un commit nuevo. Los toques seguidos se funden: no verás un commit por episodio.

**Acentos.** Ponte de nombre algo con tilde en *Ajustes* y escribe una nota con eñes. Recarga. Si se
ve bien después de dar la vuelta entera, el `base64` está bien.

**Ser dos.** *Ajustes → invitar a alguien* → copia el enlace y ábrelo en **otro navegador o en
incógnito**. Elige nombre y bicho distintos y entra. Ahora sois dos personas con dos claves distintas.

**Que la separación funciona.** Desde la segunda sesión, ponle nota a algo. En la primera, recarga: la
nota aparece **atribuida a la segunda persona**, no a ti. Y tu nota sigue siendo la tuya.

**Que un club no ve al otro.** Crea un segundo club (paso 10 con `"group":"prueba2"`) y
ábrelo. No debe verse ni un título ni una persona del primero. Con los dos en el mismo dispositivo
aparece el selector de club en la cabecera.

**Sin conexión.** Pon el móvil en modo avión, mueve una tarjeta — se pinta igual y la barra dice que
hay cambios por subir. Quita el modo avión: sube solo.

**Cuando acabes**, borra los clubes de prueba: en el repo privado, `data/prueba.json` y
`data/prueba2.json` → *Delete file*. Los enlaces dejan de valer al instante.

---

## Si algo falla

El Worker contesta siempre con un código corto. Búscalo aquí:

| lo que ves | qué pasa | qué hacer |
|---|---|---|
| `sin-ruta` | el Worker vive, la ruta no existe | comprueba la URL |
| `sin-permiso` en `/admin/group` | la `ADMIN_KEY` no coincide | ¿la cargaste con `wrangler secret put`? ¿la copiaste entera? |
| `sin-clave` | la clave no vale o te sacaron del club | pide un enlace nuevo |
| `github` | el token no puede escribir | alcance del token (paso 2), `REPO` bien escrito, rama `main` existe |
| `sin-tmdb` | falta `TMDB_TOKEN` | cárgalo y vuelve a desplegar |
| `conflicto` | dos cambios a la vez | se reintenta solo; si persiste, recarga |
| la app abre pero **no guarda nada** | CORS o CSP | `APP_ORIGIN` exacto y sin ruta · ¿ejecutaste `build-csp.js`? |
| la página sale **en blanco** | el hash de la CSP no cuadra | `node build-csp.js` y vuelve a subir |
| entra en **modo demo** con el enlace bueno | `WORKER_URL` sigue con el marcador | paso 8 |

Para ver qué está pasando por dentro, con el móvil delante:

```powershell
cd C:\Users\alex\sofa-club\worker
npx wrangler tail
```

---

## Las reglas, otra vez

1. **Nada de esto se commitea.** Ni en `wrangler.toml`, ni en un `.env`, ni en estos documentos.
2. **Nada de esto se pega en un chat**, incluido el mío: queda escrito en la conversación. Para
   probar cosas conmigo, crea un club desechable y compárteme sólo ese enlace.
3. **Los enlaces personales no se reenvían.** Quien lo tenga *es* esa persona. Para dar acceso a
   alguien se genera una invitación, que es de un solo uso y caduca en siete días.
4. Una vez al año, comprueba que el token de GitHub sigue acotado a un solo repositorio.
