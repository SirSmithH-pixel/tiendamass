/* =========================================================
   app.js — JavaScript de Tienda Mass
   Menú responsivo + formularios con respuesta + contenido dinámico
   (index, productos, registro y encuesta)
========================================================= */
(function () {
  'use strict';

  /* ---------- Datos compartidos (datos.js) ---------- */
  const DB = window.MassDB || null;
  const sesion = () => (DB ? DB.usuarioActual() : null);
  const guardarDato = (tabla, obj) => { if (DB) DB.add(tabla, obj); };
  const ahora = () => new Date().toISOString();

  /* ---------- Utilidades ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nro = (p) => p + '-' + String(Date.now()).slice(-6);
  const soles = (n) => 'S/ ' + n.toFixed(2);
  const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const reCel = /^9\d{8}$/;
  const selOk = (s) => !s.selectedOptions[0].disabled;
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function mostrar(caja, tipo, html) {
    caja.className = 'respuesta' + (tipo === 'error' ? ' respuesta-error' : '');
    caja.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    caja.innerHTML = html;
    caja.hidden = false;
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function limpiar(form) {
    $$('.error-msg', form).forEach((e) => e.remove());
    $$('.is-invalid, .pregunta-error', form).forEach((e) => e.classList.remove('is-invalid', 'pregunta-error'));
  }

  function marcarError(el, msg) {
    el.classList.add('is-invalid');
    const s = document.createElement('small');
    s.className = 'error-msg';
    s.textContent = msg;
    (el.closest('.form-check') || el).insertAdjacentElement('afterend', s);
  }

  // reglas: [[elemento, esValido, mensaje], ...] -> devuelve lista de mensajes con error
  function validar(form, reglas) {
    limpiar(form);
    const fallos = [];
    reglas.forEach(([el, ok, msg]) => {
      if (!ok) { marcarError(el, msg); fallos.push(msg); }
    });
    return fallos;
  }

  function listaErrores(fallos) {
    return '<h3>Revisa el formulario</h3><p>Corrige los siguientes puntos para continuar:</p><ul>' +
      fallos.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>';
  }

  // Quita el error de un campo apenas el usuario lo corrige
  document.addEventListener('input', quitarError);
  document.addEventListener('change', quitarError);
  function quitarError(e) {
    const t = e.target;
    if (!t.classList) return;
    t.classList.remove('is-invalid');
    const n = (t.closest('.form-check') || t).nextElementSibling;
    if (n && n.classList.contains('error-msg')) n.remove();
  }

  function contador(area, max) {
    area.maxLength = max;
    const c = document.createElement('small');
    c.className = 'contador';
    area.insertAdjacentElement('afterend', c);
    const act = () => { c.textContent = area.value.length + ' / ' + max + ' caracteres'; };
    area.addEventListener('input', act);
    act();
    return act;
  }

  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('visible'), 1800);
  }

  /* =========================================================
     1. MENÚ RESPONSIVO (todas las páginas)
  ========================================================= */
  const btnMenu = $('.menu-toggle');
  const menu = $('.nav-enlaces');
  if (btnMenu && menu) {
    const cerrar = () => {
      menu.classList.remove('abierto');
      btnMenu.setAttribute('aria-expanded', 'false');
      btnMenu.textContent = '☰';
    };
    btnMenu.addEventListener('click', () => {
      const abierto = menu.classList.toggle('abierto');
      btnMenu.setAttribute('aria-expanded', String(abierto));
      btnMenu.textContent = abierto ? '✕' : '☰';
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 767) cerrar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  }

  /* =========================================================
     2. INDEX: contadores animados + formulario de contacto
  ========================================================= */
  const numeros = $$('.stat .number');
  if (numeros.length) {
    const animar = (el) => {
      const texto = el.textContent.trim();
      const meta = parseInt(texto.replace(/\D/g, ''), 10);
      const prefijo = texto.startsWith('+') ? '+' : '';
      const coma = texto.includes(',');
      const fmt = (n) => prefijo + (coma ? n.toLocaleString('en-US') : String(n));
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(meta); return; }
      const dur = 1500, t0 = performance.now();
      const paso = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = fmt(Math.round(meta * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((en) => { if (en.isIntersecting) { animar(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.4 });
      numeros.forEach((n) => io.observe(n));
    } else { numeros.forEach(animar); }
  }

  const fContacto = $('#formContacto');
  if (fContacto) {
    const caja = $('#respuestaContacto');
    const msj = $('#cMensaje');
    const actContador = contador(msj, 300);
    const us = sesion();
    if (us) { $('#cNombre').value = us.nombre; $('#cCorreo').value = us.email; }
    fContacto.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = $('#cNombre'), correo = $('#cCorreo'), asunto = $('#cAsunto'), local = $('#cLocal'), ok = $('#cAcepta');
      const fallos = validar(fContacto, [
        [nombre, nombre.value.trim().length >= 3, 'Ingresa tu nombre completo (mínimo 3 letras).'],
        [correo, reEmail.test(correo.value.trim()), 'Ingresa un correo electrónico válido.'],
        [asunto, selOk(asunto), 'Selecciona el tipo de mensaje.'],
        [local, selOk(local), 'Selecciona el local relacionado.'],
        [msj, msj.value.trim().length >= 10, 'Escribe un mensaje de al menos 10 caracteres.'],
        [ok, ok.checked, 'Debes aceptar el tratamiento de tus datos.'],
      ]);
      if (fallos.length) return mostrar(caja, 'error', listaErrores(fallos));
      const idMsg = nro('MSG');
      guardarDato('mensajes', {
        id: idMsg, fecha: ahora(), usuarioId: us ? us.id : null, nombre: nombre.value.trim(), correo: correo.value.trim().toLowerCase(),
        asunto: asunto.selectedOptions[0].text, local: local.selectedOptions[0].text, mensaje: msj.value.trim(),
        ofertas: $('#cOfertas').checked, respuesta: null,
      });
      const promo = $('#cOfertas').checked ? '<p>También te suscribimos a nuestras ofertas semanales.</p>' : '';
      const html =
        '<h3>¡Gracias, ' + esc(nombre.value.trim().split(' ')[0]) + '! Recibimos tu mensaje</h3>' +
        '<p>N° de ticket: <span class="nro">' + idMsg + '</span></p>' +
        '<p>Tipo: <strong>' + esc(asunto.selectedOptions[0].text) + '</strong> · Local: <strong>' + esc(local.selectedOptions[0].text) + '</strong></p>' +
        '<p>Te responderemos a <strong>' + esc(correo.value.trim()) + '</strong> en un plazo de 24 horas.</p>' + promo +
        (us ? '<p>Puedes ver la respuesta en <a href="cliente.html">Mi cuenta</a>.</p>' : '<p><a href="login.html">Crea una cuenta</a> para ver nuestra respuesta en línea.</p>');
      fContacto.reset();
      actContador();
      mostrar(caja, 'ok', html);
    });
    fContacto.addEventListener('reset', () => { limpiar(fContacto); caja.hidden = true; setTimeout(actContador, 0); });
  }

  /* =========================================================
     3. REGISTRO: validación dinámica + confirmación
  ========================================================= */
  const fRegistro = $('#formRegistro');
  if (fRegistro) {
    const caja = $('#respuestaRegistro');
    const tipo = $('#tipoDoc'), num = $('#numDoc');
    const obs = $('#observaciones');
    const actContador = contador(obs, 200);

    // El campo de documento cambia según el tipo elegido
    tipo.addEventListener('change', () => {
      const dni = tipo.value === 'DNI';
      num.maxLength = dni ? 8 : 12;
      num.placeholder = dni ? '12345678 (8 dígitos)' : 'Hasta 12 caracteres';
      num.value = '';
    });
    num.addEventListener('input', () => {
      num.value = tipo.value === 'DNI' ? num.value.replace(/\D/g, '') : num.value.replace(/[^A-Za-z0-9]/g, '');
    });
    $$('#telefono, #telEmergencia').forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, ''); }));

    fRegistro.addEventListener('submit', (e) => {
      e.preventDefault();
      const g = (id) => $('#' + id);
      const dni = tipo.value === 'DNI';
      const fallos = validar(fRegistro, [
        [g('nombres'), g('nombres').value.trim().length >= 2, 'Ingresa tus nombres.'],
        [g('apellidos'), g('apellidos').value.trim().length >= 2, 'Ingresa tus apellidos.'],
        [tipo, selOk(tipo), 'Selecciona el tipo de documento.'],
        [num, selOk(tipo) && (dni ? /^\d{8}$/.test(num.value) : /^[A-Za-z0-9]{9,12}$/.test(num.value)),
          dni ? 'El DNI debe tener exactamente 8 dígitos.' : 'El documento debe tener entre 9 y 12 caracteres.'],
        [g('telefono'), reCel.test(g('telefono').value), 'El celular debe tener 9 dígitos y empezar con 9.'],
        [g('correo'), reEmail.test(g('correo').value.trim()), 'Ingresa un correo electrónico válido.'],
        [g('direccion'), g('direccion').value.trim().length >= 5, 'Ingresa tu dirección completa.'],
        [g('sede'), selOk(g('sede')), 'Selecciona una sede.'],
        [g('puesto'), selOk(g('puesto')), 'Selecciona el puesto a asignar.'],
        [g('modalidad'), selOk(g('modalidad')), 'Selecciona la jornada laboral.'],
        [g('contactoEmergencia'), g('contactoEmergencia').value.trim().length >= 3, 'Ingresa el contacto de emergencia.'],
        [g('telEmergencia'), reCel.test(g('telEmergencia').value), 'El teléfono de emergencia debe tener 9 dígitos y empezar con 9.'],
        [g('terminos'), g('terminos').checked, 'Debes aceptar las políticas de privacidad.'],
        [g('declaracion'), g('declaracion').checked, 'Debes aceptar la autorización de tratamiento de datos.'],
      ]);
      if (fallos.length) return mostrar(caja, 'error', listaErrores(fallos));
      const txt = (id) => esc(g(id).selectedOptions[0].text);
      const idReg = nro('REG');
      guardarDato('solicitudes', {
        id: idReg, fecha: ahora(), nombres: g('nombres').value.trim(), apellidos: g('apellidos').value.trim(), tipoDoc: tipo.value, numDoc: num.value,
        telefono: g('telefono').value, correo: g('correo').value.trim(), direccion: g('direccion').value.trim(),
        sede: g('sede').selectedOptions[0].text, puesto: g('puesto').selectedOptions[0].text, jornada: g('modalidad').selectedOptions[0].text,
        contactoEmergencia: g('contactoEmergencia').value.trim(), telEmergencia: g('telEmergencia').value, observaciones: obs.value.trim(), estado: 'Nueva',
      });
      const html =
        '<h3>¡Registro enviado con éxito!</h3>' +
        '<p>N° de solicitud: <span class="nro">' + idReg + '</span></p>' +
        '<p><strong>' + esc(g('nombres').value.trim() + ' ' + g('apellidos').value.trim()) + '</strong> — ' + txt('puesto') + ' (' + txt('modalidad') + ') en la sede de ' + txt('sede') + '.</p>' +
        '<p>Enviaremos la confirmación a <strong>' + esc(g('correo').value.trim()) + '</strong>. El equipo de Recursos Humanos te contactará pronto.</p>';
      fRegistro.reset();
      num.maxLength = 12;
      actContador();
      mostrar(caja, 'ok', html);
    });
    fRegistro.addEventListener('reset', () => { limpiar(fRegistro); caja.hidden = true; setTimeout(actContador, 0); });
  }

  /* =========================================================
     4. ENCUESTA: barra de progreso + resultado
  ========================================================= */
  const fEncuesta = $('#formEncuesta');
  if (fEncuesta) {
    const caja = $('#respuestaEncuesta');
    const bloques = $$('.row > div', fEncuesta);
    const obligatorias = bloques.filter((b) => b.querySelector('label .text-asterisk'));
    const numero = (b) => parseInt(b.querySelector('label').textContent, 10);

    const respondida = (b) => {
      const s = b.querySelector('select');
      if (s) return selOk(s);
      const marcables = $$('input[type=radio], input[type=checkbox]', b);
      if (marcables.length) return marcables.some((m) => m.checked);
      const t = b.querySelector('input, textarea');
      return !!t && t.value.trim() !== '';
    };

    const progreso = () => {
      const hechas = obligatorias.filter(respondida).length;
      const pct = Math.round((hechas / obligatorias.length) * 100);
      $('#progTexto').textContent = hechas + ' de ' + obligatorias.length + ' preguntas obligatorias';
      $('#progPct').textContent = pct + '%';
      $('#progRelleno').style.width = pct + '%';
      $('#progBarra').setAttribute('aria-valuenow', pct);
    };
    fEncuesta.addEventListener('input', progreso);
    fEncuesta.addEventListener('change', progreso);
    progreso();

    fEncuesta.addEventListener('submit', (e) => {
      e.preventDefault();
      limpiar(fEncuesta);
      const faltan = obligatorias.filter((b) => !respondida(b));
      if (faltan.length) {
        faltan.forEach((b) => {
          b.classList.add('pregunta-error');
          // Se limpia el marcado cuando el usuario responde esa pregunta
          b.addEventListener('change', () => b.classList.remove('pregunta-error'), { once: true });
          b.addEventListener('input', () => b.classList.remove('pregunta-error'), { once: true });
        });
        return mostrar(caja, 'error',
          '<h3>Faltan preguntas por responder</h3><p>Responde las preguntas obligatorias: <strong>' +
          faltan.map(numero).join(', ') + '</strong>.</p>');
      }
      const notas = $$('select', fEncuesta).map((s) => s.value).filter((v) => /^[1-5]$/.test(v)).map(Number);
      const prom = notas.reduce((a, b) => a + b, 0) / (notas.length || 1);
      const nivel = prom >= 4.5 ? 'Excelente' : prom >= 3.5 ? 'Buena' : prom >= 2.5 ? 'Regular' : 'Por mejorar';
      const sel = (n) => esc(bloques[n - 1].querySelector('select').selectedOptions[0].text);
      const idEnc = nro('ENC');
      const us = sesion();
      guardarDato('encuestas', {
        id: idEnc, fecha: ahora(), usuarioId: us ? us.id : null, promedio: Math.round(prom * 10) / 10,
        recomienda: bloques[26].querySelector('select').selectedOptions[0].text, mejorar: bloques[28].querySelector('input').value.trim(),
      });
      mostrar(caja, 'ok',
        '<h3>¡Gracias por responder nuestra encuesta!</h3>' +
        '<p>N° de encuesta: <span class="nro">' + idEnc + '</span></p>' +
        '<p>Tu valoración promedio de la tienda: <strong>' + prom.toFixed(1) + ' / 5</strong> (' + nivel + ').</p>' +
        '<p>Recomendación: <strong>' + sel(27) + '</strong> · Aspecto a corregir: <strong>' + esc(bloques[28].querySelector('input').value.trim()) + '</strong></p>' +
        '<p>Tus respuestas nos ayudan a mejorar cada local.</p>');
      fEncuesta.reset();
      progreso();
    });
  }

  /* =========================================================
     5. PRODUCTOS: filtros en vivo + carrito + formulario de pedido
  ========================================================= */
  const buscar = $('#buscar');
  if (buscar) {
    const productos = [];
    const grids = $$('.catalogo-grid');
    grids.forEach((g) => {
      const titulo = g.previousElementSibling;
      $$('.producto-card', g).forEach((c, i) => {
        const p = {
          el: c, grid: g, titulo,
          cat: titulo.textContent.trim(),
          marca: $('.marca-producto', c).textContent.trim(),
          nombre: $('h3', c).textContent.trim(),
          precio: parseFloat($('.precio', c).textContent.replace(/[^\d.]/g, '')),
          orden: i,
        };
        // Precio y disponibilidad definidos por el administrador; existencias por almacén
        const ov = (DB && DB.get('productos')[p.nombre]) || {};
        const stock = DB && DB.get('inventario')[p.nombre];
        if (typeof ov.precio === 'number') { p.precio = ov.precio; $('.precio', c).textContent = soles(ov.precio); }
        if (ov.activo === false) { p.agotado = true; c.classList.add('agotado'); }
        if (stock && typeof stock.stock === 'number') {
          p.stock = stock.stock;
          if (p.stock === 0) { p.agotado = true; c.classList.add('agotado'); }
        }
        p.texto = norm(p.nombre + ' ' + p.marca + ' ' + p.cat);
        productos.push(p);
        $('img', c).loading = 'lazy';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-mass boton-mass btn-agregar';
        b.textContent = p.stock === 0 ? 'Sin stock' : p.agotado ? 'No disponible' : 'Agregar al pedido';
        b.disabled = !!p.agotado;
        b.addEventListener('click', () => agregar(p));
        $('.producto-info', c).appendChild(b);
      });
    });

    const selCat = $('#filtroCategoria'), selOrden = $('#orden');
    grids.forEach((g) => {
      const o = document.createElement('option');
      o.value = g.previousElementSibling.textContent.trim();
      o.textContent = o.value;
      selCat.appendChild(o);
    });

    const aplicar = () => {
      const q = norm(buscar.value.trim());
      const cat = selCat.value, ord = selOrden.value;
      let visibles = 0;
      productos.forEach((p) => {
        const ver = (cat === 'todas' || p.cat === cat) && p.texto.includes(q);
        p.el.classList.toggle('oculto', !ver);
        if (ver) visibles++;
      });
      grids.forEach((g) => {
        const cards = productos.filter((p) => p.grid === g);
        cards.sort((a, b) => ord === 'asc' ? a.precio - b.precio : ord === 'desc' ? b.precio - a.precio : a.orden - b.orden)
          .forEach((p) => g.appendChild(p.el));
        const hay = cards.some((p) => !p.el.classList.contains('oculto'));
        g.classList.toggle('oculto', !hay);
        g.previousElementSibling.classList.toggle('oculto', !hay);
      });
      $('#contador').textContent = 'Mostrando ' + visibles + ' de ' + productos.length + ' productos';
      $('#sinResultados').hidden = visibles !== 0;
    };
    buscar.addEventListener('input', aplicar);
    selCat.addEventListener('change', aplicar);
    selOrden.addEventListener('change', aplicar);
    aplicar();

    /* ----- Carrito ----- */
    const carrito = new Map();
    const COSTO_DELIVERY = 5;
    const lista = $('#carritoLista');
    const esDelivery = () => { const r = $('input[name=entrega]:checked'); return !!r && r.value === 'delivery'; };

    function agregar(p) {
      if (p.agotado) return;
      const it = carrito.get(p.nombre) || { nombre: p.nombre, precio: p.precio, cant: 0 };
      const stock = DB && DB.get('inventario')[p.nombre];
      if (stock && it.cant >= stock.stock) { toast('No hay más unidades disponibles de ' + p.nombre); return; }
      it.cant++;
      carrito.set(p.nombre, it);
      render();
      toast('✓ ' + p.nombre + ' agregado al pedido');
    }

    function render() {
      lista.innerHTML = '';
      let cant = 0, sub = 0;
      carrito.forEach((it) => {
        cant += it.cant; sub += it.cant * it.precio;
        const li = document.createElement('li');
        li.innerHTML =
          '<span class="it-nombre">' + esc(it.nombre) + '</span>' +
          '<span class="ctrl"><button type="button" data-acc="menos" aria-label="Quitar una unidad de ' + esc(it.nombre) + '">−</button>' +
          '<span>' + it.cant + '</span>' +
          '<button type="button" data-acc="mas" aria-label="Agregar una unidad de ' + esc(it.nombre) + '">+</button></span>' +
          '<span class="it-sub">' + soles(it.cant * it.precio) + '</span>' +
          '<button type="button" data-acc="quitar" aria-label="Eliminar ' + esc(it.nombre) + '">✕</button>';
        li.dataset.n = it.nombre;
        lista.appendChild(li);
      });
      const envio = cant > 0 && esDelivery() ? COSTO_DELIVERY : 0;
      $('#carritoCant').textContent = cant;
      $('#carritoVacio').hidden = cant > 0;
      $('#subTotal').textContent = soles(sub);
      $('#envio').textContent = soles(envio);
      $('#carritoTotal').textContent = soles(sub + envio);
      $('#vaciar').disabled = cant === 0;
    }

    lista.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acc]');
      if (!b) return;
      const n = b.closest('li').dataset.n;
      const it = carrito.get(n);
      if (b.dataset.acc === 'mas') {
        const stock = DB && DB.get('inventario')[n];
        if (stock && it.cant >= stock.stock) { toast('No hay más unidades disponibles de ' + n); return; }
        it.cant++;
      }
      else if (b.dataset.acc === 'menos') it.cant--;
      else it.cant = 0;
      if (it.cant <= 0) carrito.delete(n);
      render();
    });
    $('#vaciar').addEventListener('click', () => { carrito.clear(); render(); });

    /* ----- Formulario de pedido ----- */
    const fPedido = $('#formPedido');
    const caja = $('#respuestaPedido');
    const grupoDir = $('#grupoDireccion');
    const cambiarEntrega = () => { grupoDir.classList.toggle('oculto', !esDelivery()); render(); };
    $$('input[name=entrega]').forEach((r) => r.addEventListener('change', cambiarEntrega));
    const usP = sesion();
    const notaS = document.createElement('p');
    notaS.className = 'carrito-nota';
    notaS.innerHTML = usP && usP.rol === 'cliente'
      ? 'Comprando como <strong>' + esc(usP.nombre) + '</strong>. Sigue tu pedido en <a href="cliente.html">Mi cuenta</a>.'
      : '<a href="login.html">Inicia sesión</a> para ver el seguimiento de tu pedido en tu cuenta.';
    $('.nota', fPedido).insertAdjacentElement('afterend', notaS);
    if (usP) { $('#pNombre').value = usP.nombre; $('#pTelefono').value = usP.telefono || ''; $('#pDireccion').value = usP.direccion || ''; }
    $('#pTelefono').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
    cambiarEntrega();

    fPedido.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = $('#pNombre'), tel = $('#pTelefono'), local = $('#pLocal'), dir = $('#pDireccion'), pago = $('#pPago'), ok = $('#pAcepta');
      const delivery = esDelivery();
      const reglas = [
        [nombre, nombre.value.trim().length >= 3, 'Ingresa tu nombre completo.'],
        [tel, reCel.test(tel.value), 'El celular debe tener 9 dígitos y empezar con 9.'],
        [local, selOk(local), 'Selecciona el local.'],
        [pago, selOk(pago), 'Selecciona el medio de pago.'],
        [ok, ok.checked, 'Debes aceptar las condiciones del pedido.'],
      ];
      if (delivery) reglas.splice(3, 0, [dir, dir.value.trim().length >= 5, 'Ingresa la dirección de entrega.']);
      const fallos = validar(fPedido, reglas);
      if (carrito.size === 0) fallos.unshift('Agrega al menos un producto desde el catálogo.');
      if (fallos.length) return mostrar(caja, 'error', listaErrores(fallos));

      const items = Array.from(carrito.values());
      const inventario = DB ? DB.get('inventario') : {};
      const sinStock = items.filter((it) => inventario[it.nombre] && it.cant > inventario[it.nombre].stock);
      if (sinStock.length) {
        return mostrar(caja, 'error', '<h3>Existencias insuficientes</h3><p>Actualiza tu carrito: ' +
          sinStock.map((it) => esc(it.nombre) + ' tiene ' + inventario[it.nombre].stock + ' unidades disponibles').join(', ') + '.</p>');
      }
      const sub = items.reduce((a, it) => a + it.cant * it.precio, 0);
      const total = sub + (delivery ? COSTO_DELIVERY : 0);
      const entrega = delivery
        ? 'Delivery a <strong>' + esc(dir.value.trim()) + '</strong> (45–60 min aprox.)'
        : 'Recojo en tienda <strong>' + esc(local.selectedOptions[0].text) + '</strong> (listo en 30 min aprox.)';
      const idPed = nro('PED');
      guardarDato('pedidos', {
        id: idPed, fecha: ahora(), usuarioId: usP && usP.rol === 'cliente' ? usP.id : null, nombre: nombre.value.trim(), telefono: tel.value,
        correo: usP ? usP.email : '', entrega: delivery ? 'delivery' : 'recojo', local: local.selectedOptions[0].text,
        direccion: delivery ? dir.value.trim() : '', pago: pago.selectedOptions[0].text, notas: $('#pNotas').value.trim(),
        items: items.map((it) => ({ nombre: it.nombre, precio: it.precio, cant: it.cant })), subtotal: sub, envio: delivery ? COSTO_DELIVERY : 0, total, estado: 'Pendiente',
      });
      if (DB) {
        items.forEach((it) => {
          if (inventario[it.nombre]) inventario[it.nombre].stock -= it.cant;
        });
        DB.set('inventario', inventario);
        items.forEach((it) => {
          const producto = productos.find((p) => p.nombre === it.nombre);
          if (!producto || typeof producto.stock !== 'number') return;
          producto.stock -= it.cant;
          if (producto.stock <= 0) {
            producto.agotado = true;
            producto.el.classList.add('agotado');
            const boton = $('.btn-agregar', producto.el);
            boton.disabled = true;
            boton.textContent = 'Sin stock';
          }
        });
      }
      const html =
        '<h3>¡Pedido registrado, ' + esc(nombre.value.trim().split(' ')[0]) + '!</h3>' +
        '<p>N° de pedido: <span class="nro">' + idPed + '</span></p>' +
        '<ul>' + items.map((it) => '<li>' + it.cant + ' × ' + esc(it.nombre) + ' — ' + soles(it.cant * it.precio) + '</li>').join('') + '</ul>' +
        '<p>' + entrega + '</p>' +
        '<p>Pago: <strong>' + esc(pago.selectedOptions[0].text) + '</strong> · Total: <strong>' + soles(total) + '</strong></p>' +
        (usP && usP.rol === 'cliente' ? '<p>Consulta el estado en <a href="cliente.html">Mi cuenta</a>.</p>' : '');
      carrito.clear();
      fPedido.reset();
      cambiarEntrega();
      mostrar(caja, 'ok', html);
    });
    fPedido.addEventListener('reset', () => { limpiar(fPedido); caja.hidden = true; setTimeout(cambiarEntrega, 0); });
  }
})();
