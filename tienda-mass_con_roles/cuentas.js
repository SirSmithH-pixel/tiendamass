/* =========================================================
   cuentas.js — Login, panel del cliente y panel del administrador
   Cada página declara su tipo con <body data-page="login|cliente|admin">
========================================================= */
(function () {
  'use strict';
  const DB = window.MassDB;
  const page = document.body.dataset.page;
  if (!DB || !page) return;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const soles = (n) => 'S/ ' + Number(n).toFixed(2);
  const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const reCel = /^9\d{8}$/;
  const ESTADOS = ['Pendiente', 'En preparación', 'Listo', 'Entregado', 'Cancelado'];
  const CLASE = { 'Pendiente': 'pend', 'En preparación': 'prep', 'Listo': 'listo', 'Entregado': 'ok', 'Cancelado': 'cancel' };
  const badge = (e) => '<span class="estado estado-' + (CLASE[e] || 'pend') + '">' + esc(e) + '</span>';
  const paginaRol = (rol) => rol === 'admin' ? 'admin.html' : rol === 'almacen' ? 'almacen.html' : 'cliente.html';
  const nombreRol = (rol) => rol === 'admin' ? 'Administrador' : rol === 'almacen' ? 'Almacén' : 'Cliente';

  function guardarMensajeChat(usuario, remitente, texto) {
    const chats = DB.get('chats');
    let chat = chats.find((c) => c.usuarioId === usuario.id);
    if (!chat) {
      chat = { id: usuario.id, usuarioId: usuario.id, nombre: usuario.nombre, email: usuario.email, mensajes: [] };
      chats.unshift(chat);
    }
    chat.nombre = usuario.nombre;
    chat.email = usuario.email;
    chat.mensajes.push({
      id: DB.uid('CHAT'), remitente, texto: texto.trim(), fecha: new Date().toISOString(),
    });
    DB.set('chats', chats);
  }

  function htmlChatMensajes(chat, lado) {
    const mensajes = chat ? chat.mensajes : [];
    return mensajes.length ? mensajes.map((m) =>
      '<article class="chat-burbuja ' + (m.remitente === lado ? 'chat-propio' : 'chat-ajeno') + '">' +
      '<p>' + esc(m.texto) + '</p><time datetime="' + esc(m.fecha) + '">' + fecha(m.fecha) + '</time></article>').join('')
      : '<p class="chat-vacio">¡Hola! Escribe aquí para iniciar la conversación con Tienda Mass.</p>';
  }

  function aviso(el, tipo, html) {
    el.className = 'respuesta' + (tipo === 'error' ? ' respuesta-error' : '');
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = html;
    el.hidden = false;
  }
  const errores = (l) => '<h3>Revisa los datos</h3><ul>' + l.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';

  function tabs(raiz, alCambiar) {
    const botones = $$('.tab-btn', raiz);
    const mostrar = (id) => {
      botones.forEach((b) => { const a = b.dataset.tab === id; b.classList.toggle('activa', a); b.setAttribute('aria-selected', a); });
      $$('.panel-tab', raiz).forEach((p) => { p.hidden = p.id !== 'tab-' + id; });
      if (alCambiar) alCambiar(id);
    };
    botones.forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.tab)));
    return mostrar;
  }

  /* =========================================================
     LOGIN / REGISTRO DE CLIENTES
  ========================================================= */
  if (page === 'login') {
    const u = DB.usuarioActual();
    if (u) { location.replace(paginaRol(u.rol)); return; }
    const caja = $('#respuestaAuth');
    tabs($('#auth'), () => { caja.hidden = true; })('ingreso');

    const entrar = (user) => {
      aviso(caja, 'ok', '<h3>¡Bienvenido, ' + esc(user.nombre.split(' ')[0]) + '!</h3><p>Ingresaste como <strong>' +
        nombreRol(user.rol) + '</strong>. Te estamos redirigiendo…</p>');
      setTimeout(() => { location.href = paginaRol(user.rol); }, 900);
    };

    $('#formLogin').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#lEmail').value.trim(), clave = $('#lClave').value;
      if (!reEmail.test(email) || !clave) return aviso(caja, 'error', errores(['Ingresa tu correo y tu contraseña.']));
      const r = DB.login(email, clave);
      if (!r.ok) return aviso(caja, 'error', errores([r.error]));
      entrar(r.user);
    });

    $$('[data-demo]').forEach((b) => b.addEventListener('click', () => {
      const demo = {
        cliente: ['cliente@mass.pe', 'cliente123'],
        admin: ['admin@mass.pe', 'admin123'],
        almacen: ['almacen@mass.pe', 'almacen123'],
      }[b.dataset.demo];
      $('#lEmail').value = demo[0];
      $('#lClave').value = demo[1];
    }));

    const formCuenta = $('#formCuenta');
    const btnEnviarCodigo = $('#btnEnviarCodigo');
    const btnReenviarCodigo = $('#btnReenviarCodigo');
    let verificacion = null;
    let reenvioDisponible = 0;

    async function enviarCodigo() {
      const nombre = $('#rNombre').value.trim();
      const email = $('#rEmail').value.trim().toLowerCase();
      const tel = $('#rTel').value.trim();
      const fallos = [];
      if (nombre.length < 3) fallos.push('Ingresa tu nombre completo.');
      if (!reEmail.test(email)) fallos.push('Ingresa un correo válido.');
      if (tel && !reCel.test(tel)) fallos.push('El celular debe tener 9 dígitos y empezar con 9.');
      if (!$('#rAcepta').checked) fallos.push('Debes aceptar el tratamiento de tus datos.');
      if (DB.get('usuarios').some((x) => x.email === email)) fallos.push('Ese correo ya está registrado.');
      if (fallos.length) return aviso(caja, 'error', errores(fallos));

      const config = window.MASS_EMAIL_CONFIG || {};
      if (!window.emailjs || !config.serviceId || !config.templateId || !config.publicKey) {
        return aviso(caja, 'error', errores([
          'El código se enviará al correo que escribas arriba. Falta configurar EmailJS como remitente del sitio con su Service ID, Template ID y Public Key.',
        ]));
      }

      const numeros = new Uint32Array(1);
      window.crypto.getRandomValues(numeros);
      const codigo = String(100000 + (numeros[0] % 900000));
      btnEnviarCodigo.disabled = true;
      btnEnviarCodigo.textContent = 'Enviando código…';
      try {
        await window.emailjs.send(config.serviceId, config.templateId, {
          to_email: email,
          to_name: nombre,
          codigo_verificacion: codigo,
        }, { publicKey: config.publicKey });
        verificacion = { codigo, nombre, email, telefono: tel, vence: Date.now() + 10 * 60 * 1000, intentos: 0 };
        $('#correoVerificacion').textContent = email;
        $('#registroDatos').hidden = true;
        $('#verificarCorreo').hidden = false;
        $('#rCodigo').value = '';
        reenvioDisponible = Date.now() + 60 * 1000;
        btnReenviarCodigo.disabled = true;
        window.setTimeout(() => { btnReenviarCodigo.disabled = false; }, 60 * 1000);
        aviso(caja, 'ok', '<p>Enviamos un código a <strong>' + esc(email) + '</strong>. Ingresa el código antes de crear tu contraseña.</p>');
      } catch (error) {
        console.error('No se pudo enviar el código de verificación:', error);
        aviso(caja, 'error', errores(['No se pudo enviar el correo. Verifica la configuración de EmailJS e inténtalo nuevamente.']));
      } finally {
        btnEnviarCodigo.disabled = false;
        btnEnviarCodigo.textContent = 'Enviar código de verificación';
      }
    }

    formCuenta.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!verificacion || !verificacion.confirmada) {
        await enviarCodigo();
        return;
      }

      const clave = $('#rClave').value, repetir = $('#rClave2').value;
      const fallos = [];
      if (clave.length < 6) fallos.push('La contraseña debe tener al menos 6 caracteres.');
      if (clave !== repetir) fallos.push('Las contraseñas no coinciden.');
      if (DB.get('usuarios').some((x) => x.email === verificacion.email)) fallos.push('Ese correo ya está registrado.');
      if (fallos.length) return aviso(caja, 'error', errores(fallos));

      const r = DB.registrar({
        email: verificacion.email, telefono: verificacion.telefono,
        nombre: verificacion.nombre, clave, emailVerificado: true,
      });
      if (!r.ok) return aviso(caja, 'error', errores([r.error]));
      DB.iniciar(r.user);
      entrar(r.user);
    });

    $('#btnVerificarCodigo').addEventListener('click', () => {
      if (!verificacion || Date.now() > verificacion.vence) {
        verificacion = null;
        return aviso(caja, 'error', errores(['El código venció. Solicita uno nuevo para continuar.']));
      }
      if (verificacion.intentos >= 5) {
        verificacion = null;
        return aviso(caja, 'error', errores(['Se agotaron los intentos. Solicita un nuevo código.']));
      }
      const codigo = $('#rCodigo').value.trim();
      if (!/^\d{6}$/.test(codigo) || codigo !== verificacion.codigo) {
        verificacion.intentos++;
        return aviso(caja, 'error', errores(['El código no es válido. Revisa el correo e inténtalo nuevamente.']));
      }
      verificacion.confirmada = true;
      $('#verificarCorreo').hidden = true;
      $('#crearClave').hidden = false;
      $('#rClave').focus();
      aviso(caja, 'ok', '<p>Correo verificado. Ahora elige una contraseña para terminar.</p>');
    });
    $('#rCodigo').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#btnVerificarCodigo').click();
      }
    });

    btnReenviarCodigo.addEventListener('click', () => {
      if (Date.now() < reenvioDisponible) return;
      enviarCodigo();
    });

    $('#btnCambiarCorreo').addEventListener('click', () => {
      verificacion = null;
      $('#verificarCorreo').hidden = true;
      $('#crearClave').hidden = true;
      $('#registroDatos').hidden = false;
      $('#rCodigo').value = '';
      $('#rClave').value = '';
      $('#rClave2').value = '';
      caja.hidden = true;
      $('#rEmail').focus();
    });

    $('#rCodigo').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    $('#rTel').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
    $('#rEmail').addEventListener('input', (e) => {
      const invitado = DB.invitado(e.target.value);
      $('#notaRolRegistro').textContent = invitado
        ? 'Invitación para ' + nombreRol(invitado.rol) + '. El correo debe verificarse antes de crear la contraseña.'
        : 'Las cuentas nuevas se registran como Cliente; los roles de equipo requieren invitación.';
    });
  }

  /* =========================================================
     PANEL DEL CLIENTE
  ========================================================= */
  if (page === 'cliente') {
    const u0 = DB.usuarioActual();
    if (!u0) { location.replace('login.html'); return; }
    if (u0.rol !== 'cliente') { location.replace(paginaRol(u0.rol)); return; }

    const yo = () => DB.usuarioActual();
    const misPedidos = () => DB.get('pedidos').filter((p) => p.usuarioId === yo().id);
    const misMensajes = () => DB.get('mensajes').filter((m) => m.usuarioId === yo().id || (m.correo || '').toLowerCase() === yo().email);

    function pintar() {
      const u = yo(); if (!u) { location.replace('login.html'); return; }
      const ped = misPedidos(), msg = misMensajes();
      $('#hola').textContent = '¡Hola, ' + u.nombre.split(' ')[0] + '!';
      const gastado = ped.filter((p) => p.estado !== 'Cancelado').reduce((a, p) => a + p.total, 0);
      $('#resumenCliente').innerHTML =
        '<div class="kpi"><strong>' + ped.length + '</strong><span>Pedidos</span></div>' +
        '<div class="kpi"><strong>' + soles(gastado) + '</strong><span>Total comprado</span></div>' +
        '<div class="kpi"><strong>' + msg.filter((m) => m.respuesta).length + '/' + msg.length + '</strong><span>Mensajes respondidos</span></div>';

      $('#listaPedidos').innerHTML = ped.length ? ped.map((p) =>
        '<article class="tarjeta">' +
        '<header><strong>' + esc(p.id) + '</strong>' + badge(p.estado) + '</header>' +
        '<p class="sub">' + fecha(p.fecha) + ' · ' + (p.entrega === 'delivery' ? 'Delivery a ' + esc(p.direccion) : 'Recojo en ' + esc(p.local)) + '</p>' +
        '<ul>' + p.items.map((i) => '<li>' + i.cant + ' × ' + esc(i.nombre) + ' — ' + soles(i.cant * i.precio) + '</li>').join('') + '</ul>' +
        '<footer><span>Total: <strong>' + soles(p.total) + '</strong></span>' +
        (p.estado === 'Pendiente' ? '<button type="button" class="boton-mass boton-sec" data-cancelar="' + esc(p.id) + '">Cancelar pedido</button>' : '') +
        '</footer></article>').join('')
        : '<p class="vacio">Aún no tienes pedidos. <a href="productos.html">Ir al catálogo</a></p>';

      $('#listaMensajes').innerHTML = msg.length ? msg.map((m) =>
        '<article class="tarjeta"><header><strong>' + esc(m.asunto) + ' · ' + esc(m.local) + '</strong>' +
        badge(m.respuesta ? 'Entregado' : 'Pendiente').replace('Entregado', 'Respondido').replace('>Pendiente<', '>En espera<') + '</header>' +
        '<p class="sub">' + fecha(m.fecha) + ' · ' + esc(m.id) + '</p><p>' + esc(m.mensaje) + '</p>' +
        (m.respuesta ? '<div class="respuesta"><h3>Respuesta de Tienda Mass</h3><p>' + esc(m.respuesta) + '</p></div>' : '') +
        '</article>').join('')
        : '<p class="vacio">No has enviado mensajes. Escríbenos desde <a href="index.html#contacto">Contáctanos</a>.</p>';

      const chat = DB.get('chats').find((c) => c.usuarioId === u.id);
      $('#chatCliente').innerHTML =
        '<header class="chat-cabecera"><span class="chat-avatar">M</span><span><strong>Soporte Tienda Mass</strong><small>Atención al cliente</small></span></header>' +
        '<div class="chat-mensajes" id="chatMensajes" role="log" aria-live="polite" aria-label="Conversación con soporte">' +
        htmlChatMensajes(chat, 'cliente') + '</div>' +
        '<form id="formChatCliente" class="chat-compositor"><label class="sr-only" for="textoChatCliente">Escribe tu mensaje</label>' +
        '<textarea id="textoChatCliente" class="campo" rows="1" maxlength="1000" placeholder="Escribe un mensaje…" required></textarea>' +
        '<button type="submit" class="boton-mass" aria-label="Enviar mensaje">Enviar</button></form>';
      const areaChat = $('#chatMensajes');
      areaChat.scrollTop = areaChat.scrollHeight;
    }

    $('#listaPedidos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cancelar]'); if (!b) return;
      if (!confirm('¿Seguro que deseas cancelar el pedido ' + b.dataset.cancelar + '?')) return;
      DB.update('pedidos', b.dataset.cancelar, (p) => { if (p.estado === 'Pendiente') p.estado = 'Cancelado'; });
      pintar();
    });

    $('#chatCliente').addEventListener('submit', (e) => {
      if (e.target.id !== 'formChatCliente') return;
      e.preventDefault();
      const texto = $('#textoChatCliente').value.trim();
      if (!texto) return;
      guardarMensajeChat(yo(), 'cliente', texto);
      pintar();
      $('#textoChatCliente').focus();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === 'mass_chats') pintar();
    });

    // Perfil
    const llenar = () => { const u = yo(); $('#pfNombre').value = u.nombre; $('#pfEmail').value = u.email; $('#pfTel').value = u.telefono || ''; $('#pfDir').value = u.direccion || ''; };
    $('#pfTel').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
    $('#formPerfil').addEventListener('submit', (e) => {
      e.preventDefault();
      const caja = $('#respuestaPerfil');
      const nombre = $('#pfNombre').value.trim(), tel = $('#pfTel').value, dir = $('#pfDir').value.trim();
      const actual = $('#pfActual').value, nueva = $('#pfNueva').value;
      const f = [];
      if (nombre.length < 3) f.push('Ingresa tu nombre completo.');
      if (tel && !reCel.test(tel)) f.push('El celular debe tener 9 dígitos y empezar con 9.');
      if (nueva) {
        if (DB.hash(actual) !== yo().clave) f.push('La contraseña actual no es correcta.');
        if (nueva.length < 6) f.push('La nueva contraseña debe tener al menos 6 caracteres.');
      }
      if (f.length) return aviso(caja, 'error', errores(f));
      DB.update('usuarios', yo().id, (u) => { u.nombre = nombre; u.telefono = tel; u.direccion = dir; if (nueva) u.clave = DB.hash(nueva); });
      $('#pfActual').value = ''; $('#pfNueva').value = '';
      pintar();
      aviso(caja, 'ok', '<h3>Perfil actualizado</h3><p>Tus datos se guardaron' + (nueva ? ' y tu contraseña fue cambiada' : '') + '.</p>');
    });

    tabs($('#cuenta'))('pedidos');
    llenar(); pintar();
  }

  /* =========================================================
     PANEL DE ALMACÉN
  ========================================================= */
  if (page === 'almacen') {
    const u0 = DB.usuarioActual();
    if (!u0 || u0.rol !== 'almacen') { location.replace(u0 ? paginaRol(u0.rol) : 'login.html'); return; }

    const yo = () => DB.usuarioActual();
    const catalogo = window.CATALOGO || [];
    const raiz = $('#almacen');
    let tabActiva = 'pedidos';

    function inventario() {
      const existencias = DB.get('inventario');
      $('#tab-inventario').innerHTML = '<p class="nota">Registra o actualiza las existencias. Los productos con cero unidades se marcan sin stock en el catálogo.</p>' +
        '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Producto</th><th>Existencias</th><th>Última actualización</th><th></th></tr></thead><tbody>' +
        catalogo.map((p) => {
          const item = existencias[p.nombre];
          return '<tr data-stock-producto="' + esc(p.nombre) + '"><td data-l="Producto">' + esc(p.nombre) + '</td>' +
            '<td data-l="Existencias"><input class="campo stock-inp" type="number" min="0" step="1" value="' + (item ? item.stock : '') + '" placeholder="Sin registrar" aria-label="Existencias de ' + esc(p.nombre) + '"></td>' +
            '<td data-l="Actualización">' + (item ? fecha(item.fecha) : 'Sin registrar') + '</td>' +
            '<td><button type="button" class="boton-mass" data-guardar-stock>Guardar</button></td></tr>';
        }).join('') + '</tbody></table></div><div id="respuestaStock" class="respuesta" hidden></div>';
    }

    function pedidosAlmacen() {
      const estadosActivos = ['Pendiente', 'En preparación', 'Listo'];
      const pedidos = DB.get('pedidos').filter((p) => estadosActivos.includes(p.estado));
      $('#tab-pedidos').innerHTML = pedidos.length ? '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Pedido</th><th>Cliente</th><th>Productos</th><th>Entrega</th><th>Estado de preparación</th></tr></thead><tbody>' +
        pedidos.map((p) => '<tr><td data-l="Pedido"><strong>' + esc(p.id) + '</strong><br><small>' + fecha(p.fecha) + '</small></td>' +
          '<td data-l="Cliente">' + esc(p.nombre) + '<br><small>' + esc(p.telefono) + '</small></td>' +
          '<td data-l="Productos">' + p.items.map((i) => esc(i.nombre) + ' × ' + i.cant).join('<br>') + '</td>' +
          '<td data-l="Entrega">' + (p.entrega === 'delivery' ? 'Delivery' : 'Recojo') + ' · ' + esc(p.local) + '</td>' +
          '<td data-l="Estado"><select class="campo" data-estado-almacen="' + esc(p.id) + '">' +
          ['Pendiente', 'En preparación', 'Listo'].map((e) => '<option' + (e === p.estado ? ' selected' : '') + '>' + e + '</option>').join('') +
          '</select></td></tr>').join('') + '</tbody></table></div>'
        : '<p class="vacio">No hay pedidos pendientes de preparación.</p>';
    }

    function pintar() {
      $('#hola').textContent = 'Panel de almacén — ' + yo().nombre;
      if (tabActiva === 'inventario') inventario();
      else pedidosAlmacen();
      const bajos = Object.values(DB.get('inventario')).filter((p) => p.stock <= 5).length;
      $('#almacenResumen').innerHTML =
        '<div class="kpi"><strong>' + DB.get('pedidos').filter((p) => ['Pendiente', 'En preparación', 'Listo'].includes(p.estado)).length + '</strong><span>Pedidos activos</span></div>' +
        '<div class="kpi"><strong>' + bajos + '</strong><span>Productos con 5 unidades o menos</span></div>';
    }

    const mostrar = tabs(raiz, (id) => { tabActiva = id; pintar(); });
    raiz.addEventListener('change', (e) => {
      const select = e.target;
      if (select.dataset.estadoAlmacen) {
        DB.update('pedidos', select.dataset.estadoAlmacen, (p) => { p.estado = select.value; });
        pintar();
      }
    });
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-guardar-stock]');
      if (!b) return;
      const fila = b.closest('tr'), campo = $('.stock-inp', fila), valor = Number(campo.value);
      if (campo.value.trim() === '' || !Number.isInteger(valor) || valor < 0) {
        return aviso($('#respuestaStock'), 'error', errores(['Ingresa una cantidad entera de cero o más unidades.']));
      }
      const existencias = DB.get('inventario');
      existencias[fila.dataset.stockProducto] = { stock: valor, fecha: new Date().toISOString(), usuarioId: yo().id };
      DB.set('inventario', existencias);
      inventario();
      aviso($('#respuestaStock'), 'ok', '<h3>Existencias actualizadas</h3><p>' + esc(fila.dataset.stockProducto) + ': ' + valor + ' unidades.</p>');
      $('#almacenResumen').innerHTML =
        '<div class="kpi"><strong>' + DB.get('pedidos').filter((p) => ['Pendiente', 'En preparación', 'Listo'].includes(p.estado)).length + '</strong><span>Pedidos activos</span></div>' +
        '<div class="kpi"><strong>' + Object.values(existencias).filter((p) => p.stock <= 5).length + '</strong><span>Productos con 5 unidades o menos</span></div>';
    });
    window.addEventListener('storage', (e) => {
      if ((e.key === 'mass_inventario' && tabActiva === 'inventario') || (e.key === 'mass_pedidos' && tabActiva === 'pedidos')) pintar();
    });
    mostrar('pedidos');
    pintar();
  }

  /* =========================================================
     PANEL DEL ADMINISTRADOR
  ========================================================= */
  if (page === 'admin') {
    const u0 = DB.usuarioActual();
    if (!u0 || u0.rol !== 'admin') { location.replace('login.html'); return; }
    const yo = () => DB.usuarioActual();
    const catalogo = window.CATALOGO || [];
    const admins = () => DB.get('usuarios').filter((u) => u.rol === 'admin' && !u.bloqueado);
    let tabActiva = 'resumen';
    let chatUsuarioId = '';
    const tabla = (cab, filas) => '<div class="tabla-wrap"><table class="tabla"><thead><tr>' + cab.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + filas.join('') + '</tbody></table></div>';
    const opciones = (lista, sel) => lista.map((o) => '<option' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>').join('');

    /* ----- Resumen ----- */
    function resumen() {
      const ped = DB.get('pedidos'), validos = ped.filter((p) => p.estado !== 'Cancelado');
      const ventas = validos.reduce((a, p) => a + p.total, 0);
      const enc = DB.get('encuestas');
      const prom = enc.length ? (enc.reduce((a, e) => a + e.promedio, 0) / enc.length).toFixed(1) + ' / 5' : '—';
      const conteo = {};
      validos.forEach((p) => p.items.forEach((i) => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cant; }));
      const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const max = top.length ? top[0][1] : 1;
      const kpi = (v, t) => '<div class="kpi"><strong>' + v + '</strong><span>' + t + '</span></div>';
      $('#tab-resumen').innerHTML =
        '<div class="kpis">' + kpi(ped.length, 'Pedidos') + kpi(ped.filter((p) => p.estado === 'Pendiente').length, 'Pendientes') + kpi(soles(ventas), 'Ventas (sin cancelados)') +
        kpi(DB.get('usuarios').filter((x) => x.rol === 'cliente').length, 'Clientes') +
        kpi(DB.get('usuarios').filter((x) => x.rol === 'almacen').length, 'Personal de almacén') +
        kpi(DB.get('mensajes').filter((m) => !m.respuesta).length, 'Mensajes sin responder') + kpi(prom, 'Satisfacción (' + enc.length + ' encuestas)') + '</div>' +
        '<h3 class="sub-titulo">Productos más vendidos</h3>' +
        (top.length ? '<div class="barras">' + top.map(([n, c]) => '<div class="barra-fila"><span>' + esc(n) + '</span><div class="barra"><i style="width:' + Math.round(c / max * 100) + '%"></i></div><b>' + c + '</b></div>').join('') + '</div>'
          : '<p class="vacio">Todavía no hay ventas registradas.</p>');
    }

    /* ----- Pedidos ----- */
    function pedidos() {
      const filtro = ($('#filtroEstado') || {}).value || 'Todos';
      const lista = DB.get('pedidos').filter((p) => filtro === 'Todos' || p.estado === filtro);
      $('#tab-pedidos').innerHTML =
        '<div class="barra-herr"><label for="filtroEstado">Filtrar por estado</label><select id="filtroEstado" class="campo">' + opciones(['Todos'].concat(ESTADOS), filtro) + '</select></div>' +
        (lista.length ? tabla(['N°', 'Cliente', 'Fecha', 'Entrega', 'Total', 'Estado', 'Detalle'], lista.map((p) =>
          '<tr><td data-l="N°"><strong>' + esc(p.id) + '</strong></td><td data-l="Cliente">' + esc(p.nombre) + '<br><small>' + esc(p.telefono) + (p.usuarioId ? '' : ' · invitado') + '</small></td>' +
          '<td data-l="Fecha">' + fecha(p.fecha) + '</td><td data-l="Entrega">' + (p.entrega === 'delivery' ? 'Delivery' : 'Recojo') + ' · ' + esc(p.local) + '</td>' +
          '<td data-l="Total">' + soles(p.total) + '</td>' +
          '<td data-l="Estado"><select class="campo" data-estado="' + esc(p.id) + '">' + opciones(ESTADOS, p.estado) + '</select></td>' +
          '<td data-l="Detalle"><details><summary>Ver</summary><ul>' + p.items.map((i) => '<li>' + i.cant + ' × ' + esc(i.nombre) + '</li>').join('') + '</ul>' +
          (p.direccion ? '<small>' + esc(p.direccion) + '</small>' : '') + '<br><small>Pago: ' + esc(p.pago) + '</small></details></td></tr>'))
          : '<p class="vacio">No hay pedidos con ese estado.</p>');
    }

    /* ----- Productos ----- */
    function productos() {
      const ov = DB.get('productos');
      $('#tab-productos').innerHTML =
        '<p class="nota">Los cambios de precio y disponibilidad se reflejan al instante en <a href="productos.html">el catálogo</a>.</p>' +
        tabla(['Producto', 'Categoría', 'Precio (S/)', 'Disponible', ''], catalogo.map((p) => {
          const o = ov[p.nombre] || {}, precio = typeof o.precio === 'number' ? o.precio : p.precio;
          return '<tr data-prod="' + esc(p.nombre) + '"><td data-l="Producto"><img class="mini" src="' + esc(p.img) + '" alt=""> ' + esc(p.nombre) + '<br><small>' + esc(p.marca) + '</small></td>' +
            '<td data-l="Categoría">' + esc(p.cat) + '</td>' +
            '<td data-l="Precio"><input type="number" class="campo precio-inp" min="0.1" step="0.1" value="' + precio.toFixed(2) + '"></td>' +
            '<td data-l="Disponible"><input type="checkbox" class="disp-inp"' + (o.activo === false ? '' : ' checked') + ' aria-label="Disponible"></td>' +
            '<td><button type="button" class="boton-mass" data-guardar>Guardar</button></td></tr>';
        })) + '<div class="acciones"><button type="button" class="boton-mass boton-sec" id="resetProductos">Restablecer precios originales</button></div><div id="respProd" class="respuesta" hidden></div>';
    }

    /* ----- Mensajes ----- */
    function mensajes() {
      const l = DB.get('mensajes').slice().sort((a, b) => (a.respuesta ? 1 : 0) - (b.respuesta ? 1 : 0));
      const clientes = DB.get('usuarios').filter((u) => u.rol === 'cliente').sort((a, b) => a.nombre.localeCompare(b.nombre));
      if (!clientes.some((u) => u.id === chatUsuarioId)) chatUsuarioId = clientes.length ? clientes[0].id : '';
      const activo = clientes.find((u) => u.id === chatUsuarioId);
      const chat = DB.get('chats').find((c) => c.usuarioId === chatUsuarioId);
      const historial = l.length ? l.map((m) =>
        '<article class="tarjeta"><header><strong>' + esc(m.asunto) + ' · ' + esc(m.local) + '</strong>' + (m.respuesta ? badge('Entregado').replace('Entregado', 'Respondido') : badge('Pendiente').replace('Pendiente', 'Sin responder')) + '</header>' +
        '<p class="sub">' + esc(m.nombre) + ' · ' + esc(m.correo) + ' · ' + fecha(m.fecha) + (m.ofertas ? ' · quiere ofertas' : '') + '</p><p>' + esc(m.mensaje) + '</p>' +
        '<label for="r-' + esc(m.id) + '">Tu respuesta</label><textarea id="r-' + esc(m.id) + '" class="campo" rows="2">' + esc(m.respuesta || '') + '</textarea>' +
        '<div class="acciones"><button type="button" class="boton-mass" data-responder="' + esc(m.id) + '">' + (m.respuesta ? 'Actualizar respuesta' : 'Responder') + '</button></div></article>').join('')
        : '<p class="vacio">No hay consultas anteriores.</p>';
      $('#tab-mensajes').innerHTML =
        '<section class="chat-admin"><aside class="chat-contactos"><h3>Conversaciones</h3>' +
        (clientes.length ? clientes.map((u) => {
          const c = DB.get('chats').find((x) => x.usuarioId === u.id);
          const ultimo = c && c.mensajes.length ? c.mensajes[c.mensajes.length - 1].texto : 'Iniciar conversación';
          return '<button type="button" class="chat-contacto' + (u.id === chatUsuarioId ? ' seleccionado' : '') +
            '" data-chat-usuario="' + esc(u.id) + '" aria-pressed="' + String(u.id === chatUsuarioId) + '">' +
            '<span class="chat-avatar">' + esc(u.nombre.trim().charAt(0).toUpperCase()) + '</span><span class="chat-contacto-info">' +
            '<strong>' + esc(u.nombre) + '</strong><small>' + esc(ultimo) + '</small></span></button>';
        }).join('') : '<p class="chat-vacio">No hay clientes registrados.</p>') + '</aside>' +
        '<section class="chat-conversacion">' +
        (activo
          ? '<header class="chat-cabecera"><span class="chat-avatar">' + esc(activo.nombre.trim().charAt(0).toUpperCase()) + '</span><span><strong>' + esc(activo.nombre) + '</strong><small>' + esc(activo.email) + '</small></span></header>' +
            '<div class="chat-mensajes" id="chatMensajesAdmin" role="log" aria-live="polite" aria-label="Conversación con ' + esc(activo.nombre) + '">' +
            htmlChatMensajes(chat, 'admin') + '</div>' +
            '<form id="formChatAdmin" class="chat-compositor"><label class="sr-only" for="textoChatAdmin">Escribe tu mensaje</label>' +
            '<textarea id="textoChatAdmin" class="campo" rows="1" maxlength="1000" placeholder="Escribe un mensaje…" required></textarea>' +
            '<button type="submit" class="boton-mass">Enviar</button></form>'
          : '<p class="chat-vacio">Registra un cliente para iniciar una conversación.</p>') +
        '</section></section><h3 class="sub-titulo">Consultas del formulario de contacto</h3>' + historial;
      const areaChat = $('#chatMensajesAdmin');
      if (areaChat) areaChat.scrollTop = areaChat.scrollHeight;
    }

    /* ----- Usuarios y roles ----- */
    function usuarios() {
      const l = DB.get('usuarios'), yoId = yo().id;
      $('#tab-usuarios').innerHTML =
        tabla(['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones'], l.map((u) => {
          const yoMismo = u.id === yoId;
          return '<tr><td data-l="Nombre">' + esc(u.nombre) + (yoMismo ? ' <small>(tú)</small>' : '') + '</td><td data-l="Correo">' + esc(u.email) + '</td>' +
            '<td data-l="Rol"><select class="campo" data-rol="' + esc(u.id) + '"><option value="cliente"' + (u.rol === 'cliente' ? ' selected' : '') + '>Cliente</option><option value="almacen"' + (u.rol === 'almacen' ? ' selected' : '') + '>Almacén</option><option value="admin"' + (u.rol === 'admin' ? ' selected' : '') + '>Administrador</option></select></td>' +
            '<td data-l="Estado">' + (u.bloqueado ? '<span class="estado estado-cancel">Bloqueado</span>' : '<span class="estado estado-ok">Activo</span>') + '</td>' +
            '<td data-l="Acciones"><button type="button" class="boton-mass boton-sec" data-bloq="' + esc(u.id) + '">' + (u.bloqueado ? 'Activar' : 'Bloquear') + '</button> ' +
            '<button type="button" class="boton-mass boton-sec" data-elim="' + esc(u.id) + '">Eliminar</button></td></tr>';
        })) +
        '<form id="formNuevoUsuario" class="mass-form" novalidate><h3>Crear usuario y asignar rol</h3><div class="fila-3">' +
        '<div><label for="nuNombre">Nombre</label><input id="nuNombre" class="campo" type="text"></div>' +
        '<div><label for="nuEmail">Correo</label><input id="nuEmail" class="campo" type="email"></div>' +
        '<div><label for="nuClave">Contraseña</label><input id="nuClave" class="campo" type="password" autocomplete="new-password"></div>' +
        '<div><label for="nuRol">Rol</label><select id="nuRol" class="campo"><option value="cliente">Cliente</option><option value="almacen">Almacén</option><option value="admin">Administrador</option></select></div></div>' +
        '<div class="acciones"><button type="submit" class="boton-mass">Crear usuario</button></div><div id="respUsuario" class="respuesta" hidden></div></form>';
    }

    /* ----- Encuestas y solicitudes de trabajo ----- */
    function formularios() {
      const enc = DB.get('encuestas'), sol = DB.get('solicitudes');
      $('#tab-formularios').innerHTML =
        '<h3 class="sub-titulo">Encuestas de satisfacción (' + enc.length + ')</h3>' +
        (enc.length ? tabla(['N°', 'Fecha', 'Promedio', 'Recomienda', 'A corregir'], enc.map((e) =>
          '<tr><td data-l="N°">' + esc(e.id) + '</td><td data-l="Fecha">' + fecha(e.fecha) + '</td><td data-l="Promedio">' + e.promedio.toFixed(1) + ' / 5</td><td data-l="Recomienda">' + esc(e.recomienda) + '</td><td data-l="A corregir">' + esc(e.mejorar) + '</td></tr>'))
          : '<p class="vacio">Sin encuestas aún.</p>') +
        '<h3 class="sub-titulo">Solicitudes “Trabaja con nosotros” (' + sol.length + ')</h3>' +
        (sol.length ? tabla(['N°', 'Postulante', 'Puesto · Sede', 'Contacto', 'Estado'], sol.map((s) =>
          '<tr><td data-l="N°">' + esc(s.id) + '<br><small>' + fecha(s.fecha) + '</small></td><td data-l="Postulante">' + esc(s.nombres + ' ' + s.apellidos) + '</td>' +
          '<td data-l="Puesto">' + esc(s.puesto) + ' · ' + esc(s.sede) + '<br><small>' + esc(s.jornada) + '</small></td><td data-l="Contacto">' + esc(s.telefono) + '<br><small>' + esc(s.correo) + '</small></td>' +
          '<td data-l="Estado"><select class="campo" data-sol="' + esc(s.id) + '">' + opciones(['Nueva', 'En revisión', 'Aprobada', 'Rechazada'], s.estado) + '</select></td></tr>'))
          : '<p class="vacio">Sin solicitudes aún.</p>');
    }

    const vistas = { resumen, pedidos, productos, mensajes, usuarios, formularios };
    function pintar() {
      $('#hola').textContent = 'Panel de administración — ' + yo().nombre;
      vistas[tabActiva]();
      const pend = DB.get('pedidos').filter((p) => p.estado === 'Pendiente').length;
      const sinR = DB.get('mensajes').filter((m) => !m.respuesta).length;
      $('#cPed').textContent = pend; $('#cMsg').textContent = sinR;
      $('#cPed').hidden = !pend; $('#cMsg').hidden = !sinR;
    }
    const mostrar = tabs($('#admin'), (id) => { tabActiva = id; pintar(); });
    mostrar('resumen');

    const raiz = $('#admin');
    raiz.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'filtroEstado') return pintar();
      if (t.dataset.estado) { DB.update('pedidos', t.dataset.estado, (p) => { p.estado = t.value; }); pintar(); }
      if (t.dataset.sol) { DB.update('solicitudes', t.dataset.sol, (s) => { s.estado = t.value; }); }
      if (t.dataset.rol) {
        const u = DB.get('usuarios').find((x) => x.id === t.dataset.rol);
        if (u.rol === 'admin' && t.value !== 'admin' && admins().length <= 1) { alert('Debe existir al menos un administrador activo.'); return pintar(); }
        DB.update('usuarios', u.id, (x) => { x.rol = t.value; });
        if (u.id === yo().id && t.value !== 'admin') { location.href = paginaRol(t.value); return; }
        pintar();
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'mass_chats' && tabActiva === 'mensajes') pintar();
    });

    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.chatUsuario) { chatUsuarioId = b.dataset.chatUsuario; pintar(); }
      if (b.hasAttribute('data-guardar')) {
        const fila = b.closest('tr'), nombre = fila.dataset.prod, base = catalogo.find((p) => p.nombre === nombre);
        const precio = parseFloat($('.precio-inp', fila).value), activo = $('.disp-inp', fila).checked, caja = $('#respProd');
        if (!(precio > 0)) return aviso(caja, 'error', errores(['El precio de “' + nombre + '” debe ser mayor a 0.']));
        const ov = DB.get('productos');
        ov[nombre] = { precio: Math.round(precio * 100) / 100, activo };
        if (ov[nombre].precio === base.precio && activo) delete ov[nombre];
        DB.set('productos', ov);
        aviso(caja, 'ok', '<h3>Producto actualizado</h3><p>' + esc(nombre) + ': ' + soles(precio) + ' · ' + (activo ? 'disponible' : 'no disponible') + '</p>');
      }
      if (b.id === 'resetProductos') { DB.set('productos', {}); productos(); aviso($('#respProd'), 'ok', '<h3>Catálogo restablecido</h3><p>Se restauraron los precios y la disponibilidad originales.</p>'); }
      if (b.dataset.responder) {
        const id = b.dataset.responder, txt = $('#r-' + id).value.trim();
        if (txt.length < 3) { $('#r-' + id).classList.add('is-invalid'); return; }
        DB.update('mensajes', id, (m) => { m.respuesta = txt; m.fechaResp = new Date().toISOString(); });
        pintar();
      }
      if (b.dataset.bloq) {
        const u = DB.get('usuarios').find((x) => x.id === b.dataset.bloq);
        if (u.id === yo().id) return alert('No puedes bloquear tu propia cuenta.');
        if (u.rol === 'admin' && !u.bloqueado && admins().length <= 1) return alert('Debe existir al menos un administrador activo.');
        DB.update('usuarios', u.id, (x) => { x.bloqueado = !x.bloqueado; }); pintar();
      }
      if (b.dataset.elim) {
        const u = DB.get('usuarios').find((x) => x.id === b.dataset.elim);
        if (u.id === yo().id) return alert('No puedes eliminar tu propia cuenta.');
        if (u.rol === 'admin' && admins().length <= 1) return alert('Debe existir al menos un administrador activo.');
        if (confirm('¿Eliminar a ' + u.nombre + '? Esta acción no se puede deshacer.')) { DB.remove('usuarios', u.id); pintar(); }
      }
    });

    raiz.addEventListener('submit', (e) => {
      if (e.target.id === 'formChatAdmin') {
        e.preventDefault();
        const usuario = DB.get('usuarios').find((u) => u.id === chatUsuarioId && u.rol === 'cliente');
        const texto = $('#textoChatAdmin').value.trim();
        if (!usuario || !texto) return;
        guardarMensajeChat(usuario, 'admin', texto);
        pintar();
        $('#textoChatAdmin').focus();
        return;
      }
      if (e.target.id !== 'formNuevoUsuario') return;
      e.preventDefault();
      const caja = $('#respUsuario');
      const nombre = $('#nuNombre').value, email = $('#nuEmail').value, clave = $('#nuClave').value, rol = $('#nuRol').value;
      const f = [];
      if (nombre.trim().length < 3) f.push('Ingresa el nombre.');
      if (!reEmail.test(email.trim())) f.push('Ingresa un correo válido.');
      if (clave.length < 6) f.push('La contraseña debe tener al menos 6 caracteres.');
      if (f.length) return aviso(caja, 'error', errores(f));
      const r = DB.crearDesdeAdmin({ nombre, email, clave, rol, emailVerificado: true });
      if (!r.ok) return aviso(caja, 'error', errores([r.error]));
      pintar();
      aviso($('#respUsuario'), 'ok', '<h3>Usuario creado</h3><p>' + esc(r.user.nombre) + ' ahora tiene el rol <strong>' + nombreRol(rol) + '</strong>.</p>');
    });
  }
})();
