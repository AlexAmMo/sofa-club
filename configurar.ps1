# Configura Sofa Club de una sentada. Ejecútalo TÚ, en tu terminal:
#
#     cd C:\Users\alex\sofa-club
#     .\configurar.ps1
#
# Los secretos los pregunta wrangler y viajan de tu teclado a Cloudflare. Este
# script no los guarda, no los imprime y no los escribe en ningún archivo.

# Necesita PowerShell 7 (usa -MaskInput y -SkipHttpErrorCheck, que no existen en
# la 5.1 que trae Windows). Si te ha abierto la vieja, se relanza solo en la 7.
if ($PSVersionTable.PSVersion.Major -lt 7) {
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if (-not $pwsh) {
    Write-Host "Este script necesita PowerShell 7 y no lo encuentro." -ForegroundColor Red
    Write-Host "Instálalo con:  winget install --id Microsoft.PowerShell" -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Estás en PowerShell $($PSVersionTable.PSVersion). Sigo en la 7…" -ForegroundColor DarkGray
  & $pwsh.Source -NoProfile -File $PSCommandPath
  exit $LASTEXITCODE
}

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$worker = Join-Path $raiz 'worker'

function Titulo($t){ Write-Host ""; Write-Host "── $t " -ForegroundColor Cyan -NoNewline; Write-Host ("─" * [Math]::Max(0, 60 - $t.Length)) -ForegroundColor DarkCyan }
function Bien($t){ Write-Host "  ✓ $t" -ForegroundColor Green }
function Mal($t){ Write-Host "  ✗ $t" -ForegroundColor Red; exit 1 }
function Nota($t){ Write-Host "    $t" -ForegroundColor DarkGray }

# ─────────────────────────────────────────────────────────────────────────────
Titulo "0 · antes de empezar"

if (-not (Test-Path (Join-Path $raiz 'index.html'))) { Mal "no encuentro index.html; ¿estás en la carpeta del proyecto?" }
Bien "proyecto encontrado en $raiz"

Push-Location $worker
$quien = (npx wrangler whoami 2>&1 | Out-String)
Pop-Location
if ($quien -match 'not authenticated|You are not logged in') {
  Write-Host "  No has entrado en Cloudflare. Lanzo el login…" -ForegroundColor Yellow
  Push-Location $worker; npx wrangler login; Pop-Location
} else {
  $correo = ([regex]::Match($quien, '[\w.\-+]+@[\w\-]+(?:\.[\w\-]+)+')).Value
  Bien ("sesión de Cloudflare activa" + $(if ($correo) { " ($correo)" } else { "" }))
  Nota "si esa NO es la cuenta que querías, sal con: npx wrangler logout"
}

# ─────────────────────────────────────────────────────────────────────────────
Titulo "1 · la URL del Worker"

# a minúsculas a propósito: los subdominios lo son, y en PowerShell -match no
# distingue mayúsculas, así que validar sin bajar antes no serviría de nada
Write-Host "  Puedes pegar la URL entera que te dio wrangler, o sólo el subdominio de tu cuenta." -ForegroundColor DarkGray
Nota "de https://sofa-club.mysofaclub.workers.dev, lo que necesito es 'mysofaclub'"
$sub = ([string](Read-Host "Subdominio de workers.dev (o la URL entera)")).Trim().ToLowerInvariant()

# si han pegado una URL, quedarse con el subdominio de la cuenta: en
# <worker>.<cuenta>.workers.dev y en <cuenta>.workers.dev es el mismo sitio,
# el tercero empezando por el final
$sub = $sub -replace '^https?://', '' -replace '/.*$', ''
if ($sub.EndsWith('.workers.dev')) {
  $trozos = $sub.Split('.')
  if ($trozos.Count -lt 3) { Mal "de esa URL no sé sacar el subdominio: $sub" }
  $sub = $trozos[$trozos.Count - 3]
}
if ($sub -notmatch '^[a-z0-9][a-z0-9-]{1,60}$') { Mal "eso no parece un subdominio: minúsculas, números y guiones" }
$w = "https://sofa-club.$sub.workers.dev"
Bien "el Worker vivirá en $w"

$idx = Join-Path $raiz 'index.html'
$html = Get-Content $idx -Raw
$nuevo = [regex]::Replace($html, "const WORKER_URL = '[^']+'", "const WORKER_URL = '$w'")
if ($nuevo -eq $html -and $html -notmatch [regex]::Escape($w)) { Mal "no encuentro la constante WORKER_URL en index.html" }
Set-Content -Path $idx -Value $nuevo -NoNewline
Bien "WORKER_URL escrito en index.html"

node (Join-Path $raiz 'build-csp.js')
if ($LASTEXITCODE -ne 0) { Mal "build-csp.js ha fallado" }
Bien "CSP recalculada (hash del script y connect-src)"

# ─────────────────────────────────────────────────────────────────────────────
Titulo "2 · los tres secretos"

Write-Host "  Wrangler te los va a pedir de uno en uno. Se pegan y no se ven: es normal." -ForegroundColor Yellow
Nota "GITHUB_TOKEN → el fine-grained, empieza por github_pat_"
Nota "TMDB_TOKEN   → el largo de lectura v4, empieza por eyJ"
Nota "ADMIN_KEY    → la que te inventaste"

Push-Location $worker
foreach ($s in 'GITHUB_TOKEN', 'TMDB_TOKEN', 'ADMIN_KEY') {
  Write-Host ""
  Write-Host "  → $s" -ForegroundColor Cyan
  npx wrangler secret put $s
  if ($LASTEXITCODE -ne 0) { Pop-Location; Mal "no se ha podido guardar $s" }
}
Bien "los tres secretos están en Cloudflare, cifrados"

# ─────────────────────────────────────────────────────────────────────────────
Titulo "3 · desplegar"

npx wrangler deploy
$fallo = $LASTEXITCODE -ne 0
Pop-Location
if ($fallo) { Mal "el despliegue ha fallado" }
Bien "Worker desplegado"

# ─────────────────────────────────────────────────────────────────────────────
Titulo "4 · comprobar que responde"

Start-Sleep -Seconds 2
$r1 = Invoke-WebRequest -SkipHttpErrorCheck -Uri "$w/nada" -TimeoutSec 20
if ($r1.Content -match 'sin-ruta') { Bien "el Worker está vivo (404 sin-ruta)" }
else { Mal "respuesta inesperada en $w/nada → $($r1.StatusCode) $($r1.Content)" }

$r2 = Invoke-WebRequest -SkipHttpErrorCheck -Method Post -Uri "$w/api/session" `
        -Headers @{ Authorization = "Bearer noesunaclave" } -TimeoutSec 20
if ($r2.Content -match 'sin-clave') { Bien "rechaza lo que no tiene forma de clave (401 sin-clave)" }
else { Mal "debería haber rechazado eso → $($r2.StatusCode) $($r2.Content)" }

# Ésta es la buena: una clave con la FORMA correcta de un club que no existe. El
# Worker no la descarta de entrada, así que va a GitHub a buscar ese club. Si
# vuelve 'sin-clave', GitHub contestó 404 y por tanto el token funciona. Si
# vuelve 'github', el token no sirve — y todo esto sin usar ni una credencial.
$r3 = Invoke-WebRequest -SkipHttpErrorCheck -Method Post -Uri "$w/api/session" `
        -Headers @{ Authorization = "Bearer noexiste.aaaaaaaaaaaaaaaa" } -TimeoutSec 25
if ($r3.Content -match 'sin-clave') { Bien "el token de GitHub funciona (llegó al repo y no encontró ese club)" }
elseif ($r3.Content -match 'github') {
  Mal "el token de GitHub NO sirve → $($r3.Content)`n     400 = lo guardado no tiene forma de token · 401 = caducado o revocado · 404 = REPO mal escrito o el token no alcanza ese repositorio"
}
else { Mal "respuesta inesperada → $($r3.StatusCode) $($r3.Content)" }

# ─────────────────────────────────────────────────────────────────────────────
Titulo "5 · el club de prueba"

Write-Host "  Esto es lo primero que escribe en GitHub de verdad." -ForegroundColor Yellow
$club = ([string](Read-Host "Nombre del club (Enter para 'prueba', o escribe 'no' para saltarlo)")).Trim().ToLowerInvariant()
if ($club -eq '') { $club = 'prueba' }

if ($club -ne 'no') {
  # el Worker sí distingue: su GROUP_OK sólo acepta minúsculas
  if ($club -notmatch '^[a-z0-9][a-z0-9-]{1,30}$') { Mal "nombre no válido: minúsculas, números y guiones, de 2 a 31" }
  $nombre = ([string](Read-Host "Tu nombre dentro del club")).Trim()
  if ($nombre -eq '') { $nombre = 'Alex' }
  $admin = Read-Host "ADMIN_KEY (la misma de antes)" -MaskInput

  $cuerpo = @{ group = $club; ownerName = $nombre } | ConvertTo-Json -Compress
  $res = Invoke-WebRequest -SkipHttpErrorCheck -Method Post -Uri "$w/admin/group" `
           -Headers @{ 'X-Admin-Key' = $admin } -ContentType 'application/json' -Body $cuerpo -TimeoutSec 30
  $admin = $null

  if ($res.StatusCode -eq 200) {
    $enlace = ($res.Content | ConvertFrom-Json).link
    Bien "club «$club» creado"
    Write-Host ""
    Write-Host "  TU ENLACE PERSONAL:" -ForegroundColor Magenta
    Write-Host "  $enlace" -ForegroundColor White
    Write-Host ""
    Nota "quien tenga ese enlace ES tú. No lo reenvíes ni lo pegues en un chat."
    Nota "en el repo privado debe haber aparecido data/$club.json"
  }
  elseif ($res.StatusCode -eq 401) { Mal "la ADMIN_KEY no coincide con la que cargaste en el paso 2" }
  elseif ($res.StatusCode -eq 409) {
    # relanzar el script no debe ser un drama: el club ya estaba, y ya está
    Bien "el club «$club» ya existía; no lo he tocado"
    Nota "tu enlace es el que te dio la primera vez. Si lo perdiste, crea otro club con otro nombre."
  }
  elseif ($res.StatusCode -eq 502) { Mal "el Worker no llega a GitHub: revisa el alcance del token y que REPO y la rama main sean correctos" }
  else { Mal "$($res.StatusCode) → $($res.Content)" }
}

# ─────────────────────────────────────────────────────────────────────────────
Titulo "lo que queda, y es a mano"

Write-Host @"
  1. Subir la app y encender Pages (paso 9 de PUESTA-EN-MARCHA.md):
       git push  →  Settings → Pages → main / (root)
  2. Abrir tu enlace en el móvil y hacer el recorrido del paso 11.

  El enlace no funcionará hasta que Pages esté encendido: apunta a
  https://alexammo.github.io/sofa-club/ y ahora mismo eso no existe todavía.
"@ -ForegroundColor Gray
Write-Host ""
