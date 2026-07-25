# Credenciales y configuración

> **En este archivo no se escribe ningún valor secreto.** Es la lista de qué hace falta, dónde va
> cada cosa y con qué alcance exacto. Los valores viven en tu gestor de contraseñas y en
> `wrangler secret`, que los guarda cifrados en Cloudflare.
>
> Esto es la **referencia**: qué es cada credencial, hasta dónde llega y cómo se rota. Para montarlo
> por primera vez, sigue [`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md), que va paso a paso y comprueba
> cada tramo antes de seguir.

---

## Resumen: cuatro credenciales y dónde vive cada una

| credencial | dónde vive | quién la ve | alcance |
|---|---|---|---|
| **Token de GitHub** | Cloudflare (`wrangler secret`) | solo el Worker | contenidos del repo **privado de datos**, y de ninguno más |
| **Token de TMDB** | Cloudflare (`wrangler secret`) | solo el Worker | lectura del catálogo |
| **`ADMIN_KEY`** | tu gestor de contraseñas | solo tú | crear clubes |
| **Secreto personal** | el navegador de cada persona | su dueño | su club, y solo como su dueño |

El navegador **nunca** ve los dos primeros. Es la diferencia entre esta arquitectura y la anterior.

---

## 1. Token de GitHub

**Dónde:** cuenta nueva → *Settings → Developer settings → Personal access tokens →
**Fine-grained tokens** → Generate new token*.

Configuración exacta — aquí es donde se cometen los errores:

- **Repository access** → *Only select repositories* → **solo el repo privado de datos**.
  No el repo público de la app: el Worker no tiene por qué tocarlo.
- **Repository permissions** → **Contents: Read and write**. Nada más.
- **Account permissions** → todo en **No access**.
- **Expiration** → sin caducidad, o tendrás que renovarlo y volver a desplegar.

Comprobación de que está bien: debe empezar por **`github_pat_`**. Si empieza por `ghp_` es un token
clásico, alcanza **todos** los repositorios de la cuenta y no sirve.

**Si se filtra:** revócalo en esa misma pantalla y pon uno nuevo con `wrangler secret put`. Nadie más
lo tiene, así que no hay que avisar a nadie ni tocar los enlaces de la gente.

---

## 2. Token de TMDB

**Dónde:** cuenta gratuita en [themoviedb.org](https://www.themoviedb.org) → *Ajustes → API*.

Copia el **API Read Access Token** — el largo, de lectura v4. **No** la *API Key* corta.

**Si se filtra:** poca cosa, es de solo lectura de un catálogo público. Regenéralo cuando puedas.

---

## 3. `ADMIN_KEY`

Te la inventas tú. Larga y aleatoria; sirve para crear clubes y nada más.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Guárdala en tu gestor de contraseñas: la necesitarás cada vez que crees un club nuevo.

**Si se filtra:** alguien podría crear clubes en tu Worker (ruido y consumo, no acceso a los tuyos).
Cámbiala con `wrangler secret put ADMIN_KEY` y listo.

---

## 4. Secretos personales

No los creas tú: los genera el Worker. El de dueño sale al crear el club; los demás salen al canjear
una invitación. Cada uno es de una persona y de un club.

Formato: `<club>.<24 caracteres>`. En el repo solo se guarda su **hash SHA-256**; el valor en claro no
existe en ningún sitio salvo en el móvil de su dueño.

**Si se filtra uno:** quítale a esa persona desde *Ajustes → quitar* y vuelve a invitarla. Su clave
deja de valer en el acto, y no hay que rotar nada más ni molestar al resto.

---

## Configuración no secreta

Estos valores sí son públicos y hay que ponerlos en los archivos:

| valor | dónde va | ejemplo |
|---|---|---|
| usuario de la cuenta nueva | — | `sofaclub-alex` |
| repo público de la app | `APP_URL` | `sofa-club` |
| repo privado de datos | `REPO` | `sofa-club-data` |
| rama | `BRANCH` | `main` |
| subdominio de workers.dev | `WORKER_URL` | `mi-subdominio` |
| nombre del Worker | `name` en `wrangler.toml` | `sofa-club` |

**`worker/wrangler.toml`**
```toml
name = "sofa-club"
[vars]
REPO       = "USUARIO/sofa-club-data"
BRANCH     = "main"
APP_URL    = "https://USUARIO.github.io/sofa-club/"
APP_ORIGIN = "https://USUARIO.github.io"
```

**`index.html`**, arriba del bloque de JavaScript:
```js
const WORKER_URL = 'https://sofa-club.SUBDOMINIO.workers.dev';
```

Y después, **siempre**:
```bash
node build-csp.js
```
que mete esa URL en `connect-src` y recalcula el hash del script. Si te lo saltas, el navegador
bloquea las llamadas y la app no guarda nada.

---

## Puesta en marcha, en orden

```bash
cd worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put TMDB_TOKEN
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

Crear un club (uno por grupo):

```bash
curl -X POST https://sofa-club.SUBDOMINIO.workers.dev/admin/group \
  -H "X-Admin-Key: TU_ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"group":"pareja","ownerName":"Alex","ownerEmoji":"🐻"}'
```

Devuelve **tu enlace personal**. Ábrelo y estás dentro. Invitar al resto se hace desde
*Ajustes → invitar a alguien*: enlaces de un solo uso y siete días.

---

## Reglas

1. **Nada de esto se commitea.** Ni en este archivo, ni en `wrangler.toml`, ni en un `.env`.
2. **Nada de esto se pega en un chat**, incluido el de Claude: queda escrito en la conversación. Para
   probar cosas conmigo, crea un club desechable y compárteme solo ese enlace.
3. Los enlaces personales **no se reenvían**: quien lo tenga *es* esa persona. Si hay que dar acceso a
   alguien, se genera una invitación nueva.
4. Revisa una vez al año que el token de GitHub sigue acotado a un solo repositorio.
