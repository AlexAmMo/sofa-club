/* Convierte la app en una biblioteca de componentes que Claude Design pueda abrir.
 *
 *   node diseno/generar.js
 *
 * Por qué existe: `index.html` es un archivo de 170 KB con todo dentro, y eso no
 * es una biblioteca de componentes. Claude Design trabaja con una vista previa
 * por pieza. Esto las fabrica **leyendo los estilos de verdad** de `index.html`,
 * así que las vistas previas no pueden envejecer: si tocas el CSS, se regeneran
 * y ya está. El maquetado sale de `fragmentos.json`, que se sacó de la app en
 * marcha (ver «volver a extraer» al final).
 *
 * Lo que sale de aquí es HTML plano. Nada de React ni de compilar en el
 * navegador: por ahí se empezó una vez y se tuvo que deshacer entero.          */
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const APP = path.join(AQUI, '..', 'index.html');
const html = fs.readFileSync(APP, 'utf8');
const frag = JSON.parse(fs.readFileSync(path.join(AQUI, 'fragmentos.json'), 'utf8'));

/* los estilos, tal cual los sirve la app */
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

/* Sólo para las vistas previas: lo que en la app está pegado a la pantalla aquí
   tiene que quedarse dentro de su tarjeta. No se toca nada de la app.          */
const CSS_PREVIA = `
body{margin:0;padding:26px;background:var(--bg);font-family:Nunito,sans-serif}
.previa{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:26px}
.previa h2{font-size:13px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;
  color:var(--text-dim);margin:0}
.marco{position:relative;width:390px;height:740px;overflow:hidden;border-radius:30px;
  background:var(--bg);box-shadow:0 0 0 1px #ffffff1a;flex:none}
.marco header,.marco nav,.marco .fab,.marco .ov{position:absolute}
.marco nav{left:0;right:0;bottom:0}
.suelto header,.suelto nav{position:static}
.fila{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
.col1{width:330px}
.muestra{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;color:var(--text-dim)}
.muestra i{width:34px;height:34px;border-radius:12px;display:block;flex:none;box-shadow:0 0 0 1px #ffffff1a}
.paleta{background:var(--surface);border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:12px;width:250px}
.paleta b{font-size:14px;font-weight:800;color:var(--text)}
`;

/* una página de vista previa: la primera línea es la que lee el panel */
const pagina = (grupo, titulo, cuerpo, tema) =>
  `<!-- @dsCard group="${grupo}" -->\n`
  + '<!doctype html><html lang="es"' + (tema ? ` data-theme="${tema}"` : '') + '><head><meta charset="utf-8">'
  + `<title>${titulo}</title>`
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&display=swap">'
  + `<style>${css}${CSS_PREVIA}</style></head><body><div class="previa">${cuerpo}</div></body></html>\n`;

/* ── las paletas se leen del propio CSS, para que no puedan desincronizarse ── */
function paletas(){
  const temas = [['(por defecto) malva', ':root'], ['cielo', '[data-theme="cielo"]'],
    ['ciruela', '[data-theme="ciruela"]'], ['neón de medianoche', '[data-theme="neon"]']];
  return temas.map(([nombre, selector]) => {
    const i = css.indexOf(selector + '{');
    const bloque = css.slice(i, css.indexOf('}', i));
    const vars = [...bloque.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)];
    if (!vars.length) return '';
    return '<div class="paleta"><b>' + nombre + '</b>'
      + vars.map(([, n, v]) => `<div class="muestra"><i style="background:${v}"></i>--${n} · ${v}</div>`).join('')
      + '</div>';
  }).join('');
}

const tarjetas = Object.entries(frag.tarjetas || {})
  .map(([estado, marca]) => `<div class="col1"><h2>${estado}</h2>${marca}</div>`).join('');

/* Cada columna vacía tiene su bicho, su frase y su color: son cuatro dibujos
   distintos, no un estado genérico, y por eso van todos. La quinta es la de
   «no hay nada con esos filtros», que dice otra cosa muy distinta. */
const vacias = Object.entries((frag.vacias && frag.vacias.naturales) || {})
  .map(([estado, marca]) => `<div class="col1"><h2>${estado}</h2><div class="cards">${marca}</div></div>`).join('');

const paginas = [
  ['fundamentos.html', pagina('Fundamentos', 'Paletas de Sofa Club',
    '<h2>cuatro paletas conmutables</h2><div class="fila">' + paletas() + '</div>')],

  /* si un fragmento no se extrajo, su sección no se pinta: mejor que un hueco */
  ['tarjetas.html', pagina('Componentes', 'Tarjetas',
    '<h2>la tarjeta en sus cuatro estados</h2><div class="fila">' + tarjetas + '</div>')],

  ['vacias.html', pagina('Componentes', 'Columnas vacías',
    '<h2>cada columna vacía dice lo suyo</h2><div class="fila">' + vacias + '</div>'
    + (frag.vacias && frag.vacias.filtrada
      ? '<h2>y cuando el filtro no encuentra nada</h2><div class="fila"><div class="col1"><div class="cards">'
        + frag.vacias.filtrada + '</div></div></div>' : ''))],

  ['hoja.html', pagina('Componentes', 'Hoja',
    '<h2>hoja, tirador y salida</h2><div class="fila"><div class="marco">' + (frag.hoja || '') + '</div></div>')],

  ['cabecera.html', pagina('Componentes', 'Cabecera y navegación',
    '<h2>cabecera</h2><div class="fila suelto">' + (frag.cabecera || '') + '</div>'
    + '<h2>barra inferior y botón de añadir</h2><div class="fila"><div class="marco">'
    + (frag.nav || '') + (frag.fab || '') + '</div></div>')],
];

paginas.forEach(([nombre, contenido]) => {
  fs.writeFileSync(path.join(AQUI, nombre), contenido);
  console.log('  ' + nombre + '  (' + Math.round(contenido.length / 1024) + ' KB)');
});
console.log('\n  ' + paginas.length + ' vistas previas, con el CSS vivo de index.html');
console.log('  para volver a extraer el maquetado hay que abrir la app y sacar el outerHTML;');
console.log('  el CSS, en cambio, se relee en cada pasada y nunca se queda viejo.\n');
