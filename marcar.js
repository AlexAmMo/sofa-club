/* El inspector que se inyecta en la app cuando se abre con «?marcar=1».
 *
 * Vive aparte de index.html a propósito: en producción no existe. Lo mete el
 * servidor de desarrollo al vuelo, y añade su hash a la CSP para que la política
 * siga siendo la misma de siempre en vez de relajarse. Nada de esto llega a
 * Pages, y el hash de index.html no se toca.
 *
 * Para qué: para poder señalar un elemento con el dedo en el móvil y que su
 * referencia aparezca del lado del ordenador, en vez de describirlo con
 * palabras. Lo que se apunta es lo que hace falta para encontrarlo en el
 * archivo: su `data-a` —que es como está cableada toda la interfaz—, sus clases,
 * su texto y su tamaño real en pantalla.                                       */
(function(){
  'use strict';
  var activo = false;

  var boton = document.createElement('button');
  boton.textContent = '⊹ marcar';
  boton.setAttribute('style', 'position:fixed;left:10px;bottom:calc(84px + env(safe-area-inset-bottom));'
    + 'z-index:9999;height:38px;padding:0 14px;border-radius:999px;font:800 13px Nunito,sans-serif;'
    + 'background:#FFD84D;color:#1B1626;box-shadow:0 8px 22px -8px #000a;border:0');
  document.body.appendChild(boton);

  var aviso = document.createElement('div');
  aviso.setAttribute('style', 'position:fixed;left:10px;right:10px;bottom:calc(130px + env(safe-area-inset-bottom));'
    + 'z-index:9999;padding:9px 12px;border-radius:14px;font:700 12.5px Nunito,sans-serif;'
    + 'background:#1E1B2E;color:#fff;box-shadow:0 8px 22px -8px #000a;display:none;text-align:center');
  document.body.appendChild(aviso);

  function decir(t, color){
    aviso.textContent = t;
    aviso.style.display = 'block';
    aviso.style.color = color || '#fff';
    clearTimeout(decir.t);
    decir.t = setTimeout(function(){ aviso.style.display = 'none'; }, 2600);
  }

  boton.addEventListener('click', function(e){
    e.stopPropagation();
    activo = !activo;
    boton.style.background = activo ? '#FF4FA3' : '#FFD84D';
    boton.textContent = activo ? '⊹ tocando…' : '⊹ marcar';
    decir(activo ? 'toca el elemento que quieras marcar' : 'marcar desactivado');
  }, true);

  /* «capture» y pointerdown: hay que ganarle al gesto de la app, que si no
     empieza a arrastrar la tarjeta en cuanto la tocas */
  ['pointerdown', 'pointerup', 'click'].forEach(function(tipo){
    document.addEventListener(tipo, function(e){
      if (!activo || e.target === boton) return;
      e.preventDefault();
      e.stopPropagation();
      if (tipo !== 'pointerdown') return;
      enviar(e.target);
    }, true);
  });

  function cadena(el){
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var c = (el.getAttribute('class') || '').trim();
    if (c) s += '.' + c.split(/\s+/).join('.');
    return s;
  }

  function describir(el){
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var conAccion = el.closest('[data-a]');
    var tarjeta = el.closest('[data-card]');
    var hoja = el.closest('[data-sheet]');
    var camino = [], p = el;
    while (p && p !== document.body && camino.length < 5){ camino.push(cadena(p)); p = p.parentElement; }
    return {
      cuando: new Date().toISOString(),
      elemento: cadena(el),
      camino: camino.join('  <  '),
      accion: conAccion ? conAccion.getAttribute('data-a') : null,
      dentroDe: hoja ? 'hoja' : (tarjeta ? 'tarjeta ' + tarjeta.getAttribute('data-card') : 'tablero'),
      texto: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      caja: { ancho: Math.round(r.width), alto: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
      pantalla: window.innerWidth + '×' + window.innerHeight,
      estilo: {
        fuente: cs.fontSize + ' / ' + cs.fontWeight,
        color: cs.color,
        fondo: cs.backgroundColor,
        radio: cs.borderRadius,
        relleno: cs.padding,
      },
    };
  }

  function destello(el){
    var previo = el.style.outline;
    el.style.outline = '3px solid #FF4FA3';
    setTimeout(function(){ el.style.outline = previo; }, 700);
  }

  function enviar(el){
    var m = describir(el);
    destello(el);
    fetch('/_marca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) })
      .then(function(r){ decir(r.ok ? 'marcado: ' + m.elemento.slice(0, 40) : 'no se pudo guardar', r.ok ? '#3DF5D0' : '#FF6B8A'); })
      .catch(function(){ decir('no se pudo guardar', '#FF6B8A'); });
  }

  decir('inspector puesto · dale a «marcar»');
})();
