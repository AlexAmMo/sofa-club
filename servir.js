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

const PUERTO = Number(process.argv[2]) || 8788;
const RAIZ = __dirname;
const TIPOS = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.md':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon',
  /* sin este, el navegador descarta el manifiesto y no ofrece instalar la app */
  '.webmanifest':'application/manifest+json; charset=utf-8' };

http.createServer((req, res) => {
  const pedido = decodeURIComponent(req.url.split('?')[0]);
  const rel = pedido === '/' ? 'index.html' : pedido.replace(/^\/+/, '');
  const destino = path.resolve(RAIZ, rel);
  /* no salirse de la carpeta, ni siquiera en un servidor de juguete */
  if (!destino.startsWith(RAIZ)){ res.writeHead(403); return res.end('fuera'); }
  /* ni servir .git ni ningún oculto: esto puede acabar detrás de un túnel
     público, y entonces «es sólo local» deja de ser cierto */
  if (rel.split(/[\\/]/).some((t) => t.startsWith('.'))){ res.writeHead(403); return res.end('no'); }
  fs.readFile(destino, (e, datos) => {
    if (e){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('no está: ' + rel); }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(datos);
  });
}).listen(PUERTO, '0.0.0.0', () => {
  const redes = [];
  Object.values(os.networkInterfaces()).forEach((lista) => (lista || []).forEach((i) => {
    if (i.family === 'IPv4' && !i.internal) redes.push(i.address);
  }));
  console.log('\n  Sofa Club, en local y sin caché\n');
  console.log('    aquí:      http://localhost:' + PUERTO + '/');
  redes.forEach((ip) => console.log('    móvil:     http://' + ip + ':' + PUERTO + '/'));
  console.log('\n  El móvil tiene que estar en la misma wifi.');
  console.log('  Recuerda: si tocas el JavaScript, «node build-csp.js» antes de recargar.\n');
});
