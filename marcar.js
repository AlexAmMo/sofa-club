/* El inspector que se inyecta en la app cuando se abre con «?marcar=1».
 *
 * Vive aparte de index.html a propósito: en producción no existe. Lo mete el
 * servidor de desarrollo al vuelo y añade su hash a la CSP en vez de relajarla,
 * así que lo que pruebas tiene la misma política que producción. Nada de esto
 * llega a Pages y el hash de index.html no se toca.
 *
 * Para qué: para señalar un elemento con el dedo y que su referencia aparezca
 * del lado del ordenador, en vez de describirlo con palabras.
 *
 * Cómo se elige, que es lo que tiene miga en un móvil: no hay puntero que
 * flote, así que no puedes ver qué vas a coger antes de cogerlo. Aquí se
 * resuelve como se resuelve siempre: **apoyas el dedo y se resalta lo que hay
 * debajo; deslizas y el resalte te sigue; al levantar, eso es lo que se marca.**
 * Con ratón funciona igual y además se resalta al pasar por encima.           */
(function(){
  'use strict';

  var activo = false;
  var previo = null;      /* elemento resaltado ahora mismo */
  var marcas = [];

  /* ── piezas de pantalla ───────────────────────────────────────────────── */
  var css = 'position:fixed;z-index:99999;font-family:Nunito,sans-serif;box-sizing:border-box';

  var lupa = document.createElement('div');       /* el resalte */
  lupa.setAttribute('style', css + ';pointer-events:none;display:none;border:2px solid #FF4FA3;'
    + 'border-radius:6px;background:#FF4FA31f;box-shadow:0 0 0 9999px #0006');
  var etiqueta = document.createElement('div');   /* qué es lo que hay debajo */
  etiqueta.setAttribute('style', css + ';pointer-events:none;display:none;padding:4px 8px;border-radius:8px;'
    + 'background:#FF4FA3;color:#fff;font-size:11px;font-weight:800;white-space:nowrap;max-width:92vw;overflow:hidden');

  /* por encima de la barra de la app: si no, tapa «Tablero» y «Ajustes» */
  var barra = document.createElement('div');
  barra.setAttribute('style', css + ';left:8px;right:8px;bottom:calc(82px + env(safe-area-inset-bottom));'
    + 'display:flex;gap:8px;align-items:flex-end;pointer-events:none');

  var boton = document.createElement('button');
  boton.setAttribute('style', 'pointer-events:auto;height:44px;padding:0 15px;border-radius:999px;border:0;'
    + 'font:800 13px Nunito,sans-serif;background:#FFD84D;color:#1B1626;box-shadow:0 8px 22px -8px #000a');

  var verLista = document.createElement('button');
  verLista.setAttribute('style', 'pointer-events:auto;height:44px;padding:0 15px;border-radius:999px;border:0;'
    + 'font:800 13px Nunito,sans-serif;background:#1E1B2E;color:#fff;box-shadow:0 8px 22px -8px #000a;display:none');

  var lista = document.createElement('div');
  lista.setAttribute('style', css + ';left:8px;right:8px;bottom:calc(134px + env(safe-area-inset-bottom));'
    + 'max-height:42vh;overflow:auto;background:#14121F;border-radius:16px;padding:8px;display:none;'
    + 'box-shadow:0 18px 44px -14px #000c;color:#fff');

  /* identificadores estables: el atributo style se reserializa en cuanto mueves
     un elemento, así que buscarlos por su estilo no aguanta */
  lupa.dataset.marcar = 'lupa'; etiqueta.dataset.marcar = 'etiqueta';
  lista.dataset.marcar = 'lista'; barra.dataset.marcar = 'barra';
  boton.dataset.marcar = 'boton'; verLista.dataset.marcar = 'ver';
  [lupa, etiqueta, lista, barra].forEach(function(e){ document.body.appendChild(e); });
  barra.appendChild(boton); barra.appendChild(verLista);

  /* ── describir lo que hay debajo ──────────────────────────────────────── */
  function cadena(el){
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var c = (el.getAttribute('class') || '').trim();
    if (c) s += '.' + c.split(/\s+/).join('.');
    return s;
  }
  function describir(el){
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    var conAccion = el.closest('[data-a]'), tarjeta = el.closest('[data-card]'), hoja = el.closest('[data-sheet]');
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
      estilo: { fuente: cs.fontSize + ' / ' + cs.fontWeight, color: cs.color, fondo: cs.backgroundColor,
        radio: cs.borderRadius, relleno: cs.padding },
    };
  }

  /* ── resaltar ─────────────────────────────────────────────────────────── */
  function resaltar(el){
    previo = el;
    if (!el){ lupa.style.display = etiqueta.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    lupa.style.display = 'block';
    lupa.style.left = r.x + 'px'; lupa.style.top = r.y + 'px';
    lupa.style.width = r.width + 'px'; lupa.style.height = r.height + 'px';
    var a = el.closest('[data-a]');
    etiqueta.textContent = cadena(el) + (a ? '   [' + a.getAttribute('data-a') + ']' : '')
      + '   ' + Math.round(r.width) + '×' + Math.round(r.height);
    etiqueta.style.display = 'block';
    /* la etiqueta encima si cabe, y si no debajo */
    var arriba = r.y > 30;
    etiqueta.style.top = (arriba ? r.y - 26 : r.y + r.height + 6) + 'px';
    etiqueta.style.left = Math.max(4, Math.min(r.x, window.innerWidth - etiqueta.offsetWidth - 4)) + 'px';
  }
  /* la lupa no debe estorbar a elementFromPoint: por eso pointer-events:none */
  function debajo(x, y){
    var el = document.elementFromPoint(x, y);
    if (!el || el === document.body || el === document.documentElement) return null;
    if (barra.contains(el) || lista.contains(el)) return null;
    return el;
  }

  /* ── la lista de marcas ───────────────────────────────────────────────── */
  function pintarLista(){
    verLista.style.display = marcas.length ? 'block' : 'none';
    verLista.textContent = '≡ ' + marcas.length;
    if (!marcas.length){ lista.style.display = 'none'; return; }
    lista.innerHTML = '';
    marcas.forEach(function(m){
      var fila = document.createElement('div');
      fila.setAttribute('style', 'display:flex;align-items:center;gap:8px;padding:7px 4px 7px 10px;'
        + 'border-radius:11px;background:#ffffff0d;margin-bottom:6px');
      var t = document.createElement('div');
      t.setAttribute('style', 'flex:1;min-width:0;font:700 12px Nunito,sans-serif;line-height:1.35;overflow:hidden');
      t.innerHTML = '<div style="color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + escapar(m.elemento) + '</div>'
        + '<div style="color:#8B85A8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + escapar((m.accion ? '[' + m.accion + '] ' : '') + (m.texto || m.dentroDe)) + '</div>';
      var x = document.createElement('button');
      x.textContent = '✕';
      x.setAttribute('style', 'flex:none;width:44px;height:44px;border:0;border-radius:999px;background:#ffffff10;'
        + 'color:#FF6B8A;font:800 15px Nunito,sans-serif');
      x.addEventListener('click', function(ev){ ev.stopPropagation(); borrar(m.id); }, true);
      fila.appendChild(t); fila.appendChild(x);
      lista.appendChild(fila);
    });
    var todo = document.createElement('button');
    todo.textContent = 'borrar todas';
    todo.setAttribute('style', 'width:100%;height:40px;border:0;border-radius:11px;background:#FF6B8A22;'
      + 'color:#FF6B8A;font:800 12.5px Nunito,sans-serif;margin-top:2px');
    todo.addEventListener('click', function(ev){ ev.stopPropagation(); vaciar(); }, true);
    lista.appendChild(todo);
  }
  function escapar(s){ return String(s == null ? '' : s).replace(/[<>&"]/g, function(c){
    return ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' })[c]; }); }

  /* ── hablar con el servidor ───────────────────────────────────────────── */
  function pedir(ruta, cuerpo){
    return fetch(ruta, cuerpo
      ? { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(cuerpo) }
      : undefined).then(function(r){ return r.ok ? r.json().catch(function(){ return null; }) : null; });
  }
  function cargar(){ pedir('/_marcas').then(function(j){ marcas = (j && j.marcas) || []; pintarLista(); }); }
  function guardar(el){
    var m = describir(el);
    pedir('/_marca', m).then(function(j){
      if (!j) return;
      marcas.push(j.marca);
      pintarLista();
      lista.style.display = 'block';
    });
  }
  function borrar(id){ pedir('/_marca/borrar', { id: id }).then(function(){
    marcas = marcas.filter(function(m){ return m.id !== id; }); pintarLista(); }); }
  function vaciar(){ pedir('/_marca/vaciar', {}).then(function(){ marcas = []; pintarLista(); }); }

  /* ── el gesto ─────────────────────────────────────────────────────────── */
  boton.addEventListener('click', function(e){
    e.stopPropagation();
    activo = !activo;
    boton.style.background = activo ? '#FF4FA3' : '#FFD84D';
    boton.style.color = activo ? '#fff' : '#1B1626';
    boton.textContent = activo ? '⊹ tocando…' : '⊹ marcar';
    if (!activo) resaltar(null);
  }, true);
  verLista.addEventListener('click', function(e){
    e.stopPropagation();
    lista.style.display = lista.style.display === 'block' ? 'none' : 'block';
  }, true);

  function mio(e){ return barra.contains(e.target) || lista.contains(e.target); }

  /* con ratón: resaltar al pasar por encima, sin tocar nada */
  document.addEventListener('pointermove', function(e){
    if (!activo || mio(e)) return;
    resaltar(debajo(e.clientX, e.clientY));
  }, true);

  /* con el dedo: apoyar resalta, deslizar mueve el resalte, levantar marca */
  document.addEventListener('pointerdown', function(e){
    if (!activo || mio(e)) return;
    e.preventDefault(); e.stopPropagation();
    resaltar(debajo(e.clientX, e.clientY));
  }, true);
  document.addEventListener('pointerup', function(e){
    if (!activo || mio(e)) return;
    e.preventDefault(); e.stopPropagation();
    var el = debajo(e.clientX, e.clientY) || previo;
    if (el) guardar(el);
    resaltar(null);
  }, true);
  /* y que ningún clic llegue a la app mientras estás marcando */
  document.addEventListener('click', function(e){
    if (!activo || mio(e)) return;
    e.preventDefault(); e.stopPropagation();
  }, true);

  window.addEventListener('scroll', function(){ if (previo) resaltar(previo); }, true);

  boton.textContent = '⊹ marcar';
  cargar();
})();
