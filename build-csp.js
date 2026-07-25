/* Recalcula el hash del <script> en línea y lo mete en la CSP.
   Hay que ejecutarlo cada vez que se toque el JavaScript de index.html:
       node build-csp.js
   Si el hash no cuadra, el navegador bloquea el script y la página no arranca. */
const fs = require('fs');
const crypto = require('crypto');

const file = 'index.html';
let h = fs.readFileSync(file, 'utf8');

/* la etiqueta de apertura va sola en su línea, para no confundirla con ninguna
   mención en un comentario */
const m = h.match(/\n<script>\n/);
const close = h.lastIndexOf('</scr' + 'ipt>');
if (!m || close < 0) { console.error('no encuentro el bloque de JavaScript en línea'); process.exit(1); }

const js = h.slice(m.index + m[0].length - 1, close);
const hash = crypto.createHash('sha256').update(js, 'utf8').digest('base64');

if (!/script-src 'sha256-[^']*'/.test(h)) { console.error('no encuentro la directiva script-src en la CSP'); process.exit(1); }
const yaEstaba = h.includes("script-src 'sha256-" + hash + "'");
h = h.replace(/script-src 'sha256-[^']*'/, "script-src 'sha256-" + hash + "'");

/* connect-src tiene que apuntar al Worker que hayas puesto arriba del archivo:
   si no coincide, el navegador bloquea las llamadas y la app no guarda nada. */
const w = js.match(/const WORKER_URL = '([^']+)'/);
if (!w) { console.error('no encuentro WORKER_URL en el script'); process.exit(1); }
let origen;
try { origen = new URL(w[1]).origin; } catch (e) { console.error('WORKER_URL no es una URL válida: ' + w[1]); process.exit(1); }
h = h.replace(/connect-src [^;"]*/, 'connect-src ' + origen + ' ');

fs.writeFileSync(file, h);
console.log('sha256-' + hash + (yaEstaba ? '  (sin cambios)' : '  (actualizado)'));
console.log('connect-src → ' + origen);
console.log('CSP lista (' + js.length + ' caracteres de script)');
