/* Servidor de desarrollo para probar en el móvil sin pasar por Pages.
 *
 *   node servir.js
 *
 * Sirve la carpeta tal cual y, sobre todo, manda «no-store» en todo: el problema
 * de iterar contra Pages no es sólo que tarde en construir, es que luego el móvil
 * se queda diez minutos con la copia vieja y parece que tu cambio no funciona.
 * Aquí cada recarga trae el archivo de verdad.
 *
 * Sin dependencias, como el resto del proyecto.                                */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PUERTO = Number(process.argv[2]) || 8788;
const RAIZ = __dirname;
const MARCAS = path.join(RAIZ, '.marcados.jsonl');

/* Con «?marcar=1» se inyecta el inspector y se añade SU hash a la CSP, en vez de
   relajarla: así lo que se prueba sigue teniendo la misma política que
   producción. El index.html del disco no se toca, y a Pages no llega nada. */
function conInspector(html){
  let js;
  try { js = fs.readFileSync(path.join(RAIZ, 'marcar.js'), 'utf8'); }
  catch (e){ return html; }
  const hash = crypto.createHash('sha256').update(js, 'utf8').digest('base64');
  return html
    .replace(/script-src ([^;]+);/, "script-src $1 'sha256-" + hash + "';")
    /* y 'self', que es a donde el inspector manda lo que marcas: la app nunca
       habla con su propio origen, así que en producción esto no está */
    .replace(/connect-src ([^;]+);/, "connect-src $1 'self';")
    .replace('</body>', '<script>' + js + '</script></body>');
}
const TIPOS = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.md':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  const pedido = decodeURIComponent(req.url.split('?')[0]);
  const consulta = req.url.split('?')[1] || '';

  /* el inspector deja aquí lo que marques con el dedo */
  if (req.method === 'POST' && pedido === '/_marca'){
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; if (cuerpo.length > 20000) req.destroy(); });
    req.on('end', () => {
      try {
        const m = JSON.parse(cuerpo);
        fs.appendFileSync(MARCAS, JSON.stringify(m) + '\n');
        console.log('  marcado: ' + m.elemento + (m.accion ? '   [' + m.accion + ']' : '')
          + '   ' + m.caja.ancho + '×' + m.caja.alto + 'px');
        res.writeHead(204); res.end();
      } catch (e){ res.writeHead(400); res.end('mal'); }
    });
    return;
  }

  const rel = pedido === '/' ? 'index.html' : pedido.replace(/^\/+/, '');
  const destino = path.resolve(RAIZ, rel);
  /* no salirse de la carpeta, ni siquiera en un servidor de juguete */
  if (!destino.startsWith(RAIZ)){ res.writeHead(403); return res.end('fuera'); }
  /* ni servir .git ni ningún oculto: esto puede acabar detrás de un túnel
     público, y entonces «es sólo local» deja de ser cierto */
  if (rel.split(/[\\/]/).some((t) => t.startsWith('.'))){ res.writeHead(403); return res.end('no'); }
  fs.readFile(destino, (e, datos) => {
    if (e){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('no está: ' + rel); }
    const esIndex = rel === 'index.html';
    const marcando = /(^|&)marcar=1(&|$)/.test(consulta);
    const salida = (esIndex && marcando) ? Buffer.from(conInspector(datos.toString('utf8')), 'utf8') : datos;
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(salida);
  });
}).listen(PUERTO, '0.0.0.0', () => {
  const redes = [];
  Object.values(os.networkInterfaces()).forEach((lista) => (lista || []).forEach((i) => {
    if (i.family === 'IPv4' && !i.internal) redes.push(i.address);
  }));
  console.log('\n  Sofa Club, en local y sin caché\n');
  console.log('    aquí:      http://localhost:' + PUERTO + '/');
  redes.forEach((ip) => console.log('    móvil:     http://' + ip + ':' + PUERTO + '/'));
  console.log('\n  Añade «?marcar=1» a la URL y podrás señalar elementos con el dedo;');
  console.log('  cada uno se apunta en .marcados.jsonl y aquí abajo.');
  console.log('\n  El móvil tiene que estar en la misma wifi.');
  console.log('  Recuerda: si tocas el JavaScript, «node build-csp.js» antes de recargar.\n');
});
