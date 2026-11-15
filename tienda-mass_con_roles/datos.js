/* =========================================================
   datos.js — Datos compartidos, sesión y roles de Tienda Mass
   Se carga en TODAS las páginas. Guarda la información en el
   navegador (localStorage), así los formularios de la tienda,
   el    paneles de cliente, almacén y administrador comparten datos.
   Roles: "cliente", "admin" y "almacen".
========================================================= */
(function () {
  'use strict';

  const K = {
    usuarios: 'mass_usuarios', sesion: 'mass_sesion', pedidos: 'mass_pedidos',
    mensajes: 'mass_mensajes', chats: 'mass_chats', encuestas: 'mass_encuestas', solicitudes: 'mass_solicitudes',
    productos: 'mass_productos', inventario: 'mass_inventario', semilla: 'mass_semilla',
  };
  const mem = {};
  const INVITADOS = [
    { nombre: 'Jennifer Gallegos', email: 'u24247659@utp.edu.pe', rol: 'admin' },
    { nombre: 'Andre Salazar', email: 'u24249164@utp.edu.pe', rol: 'cliente' },
    { nombre: 'Antony Vilcazan', email: 'u21218603@utp.edu.pe', rol: 'cliente' },
    { nombre: 'Alexander Espinoza', email: 'u21320060@utp.edu.pe', rol: 'cliente' },
    { nombre: 'David Yzarra', email: 'u18306119@utp.edu.pe', rol: 'cliente' },
    { nombre: 'Medina Smith', email: 'u19300601@utp.edu.pe', rol: 'almacen' },
  ];
  const leer = (k, d) => {
    try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* sin storage */ }
    return k in mem ? mem[k] : d;
  };
  const guardar = (k, v) => { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage */ } };

  // Hash simple (cyrb53). Solo evita guardar la clave en texto plano: es una SIMULACIÓN, no seguridad real.
  function hash(s) {
    s = 'mass|' + s;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function crearUsuario({ nombre, email, telefono, clave, rol, emailVerificado }) {
    email = String(email).trim().toLowerCase();
    if (DB.get('usuarios').some((x) => x.email === email)) return { ok: false, error: 'Ese correo ya está registrado.' };
    const u = { id: DB.uid('U'), nombre: nombre.trim(), email, telefono: telefono || '', direccion: '',
      clave: hash(clave), rol, bloqueado: false, emailVerificado: !!emailVerificado, creado: new Date().toISOString() };
    DB.add('usuarios', u);
    return { ok: true, user: u };
  }

  const DB = {
    K, hash,
    invitado: (email) => INVITADOS.find((u) => u.email === String(email).trim().toLowerCase()) || null,
    get: (n) => leer(K[n], n === 'productos' || n === 'inventario' ? {} : []),
    set: (n, v) => guardar(K[n], v),
    uid: (p) => p + '-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    add(n, item) { const l = DB.get(n); l.unshift(item); DB.set(n, l); return item; },
    update(n, id, fn) { const l = DB.get(n); const it = l.find((x) => x.id === id); if (it) { fn(it); DB.set(n, l); } return it; },
    remove(n, id) { DB.set(n, DB.get(n).filter((x) => x.id !== id)); },

    usuarioActual() {
      const id = leer(K.sesion, null);
      if (!id) return null;
      const u = DB.get('usuarios').find((x) => x.id === id);
      if (!u || u.bloqueado) { guardar(K.sesion, null); return null; }
      return u;
    },
    login(email, pass) {
      const u = DB.get('usuarios').find((x) => x.email === String(email).trim().toLowerCase());
      if (!u || u.clave !== hash(pass)) return { ok: false, error: 'Correo o contraseña incorrectos.' };
      if (u.bloqueado) return { ok: false, error: 'Tu cuenta está bloqueada. Contacta al administrador.' };
      guardar(K.sesion, u.id);
      return { ok: true, user: u };
    },
    logout() { guardar(K.sesion, null); },
    registrar(datos) {
      const email = String(datos.email).trim().toLowerCase();
      const invitado = DB.invitado(email);
      return crearUsuario({
        nombre: invitado ? invitado.nombre : datos.nombre,
        email, telefono: datos.telefono, clave: datos.clave,
        rol: invitado ? invitado.rol : 'cliente', emailVerificado: datos.emailVerificado,
      });
    },
    crearDesdeAdmin(datos) {
      const actor = DB.usuarioActual();
      if (!actor || actor.rol !== 'admin') return { ok: false, error: 'Solo un administrador puede crear cuentas de equipo.' };
      if (!['cliente', 'admin', 'almacen'].includes(datos.rol)) return { ok: false, error: 'Selecciona un rol válido.' };
      return crearUsuario(datos);
    },
    iniciar(u) { guardar(K.sesion, u.id); },
  };
  window.MassDB = DB;

  /* ---------- Datos de demostración (solo la primera vez) ---------- */
  if (!leer(K.semilla, false)) {
    const hace = (d) => new Date(Date.now() - d * 86400000).toISOString();
    DB.set('usuarios', [
      { id: 'U-ADMIN', nombre: 'Administrador Mass', email: 'admin@mass.pe', telefono: '', direccion: '', clave: hash('admin123'), rol: 'admin', bloqueado: false, creado: hace(30) },
      { id: 'U-CLI1', nombre: 'Cliente Demo', email: 'cliente@mass.pe', telefono: '987654321', direccion: 'Av. Arequipa 123, Lima', clave: hash('cliente123'), rol: 'cliente', bloqueado: false, creado: hace(20) },
      { id: 'U-ALM1', nombre: 'Almacén Demo', email: 'almacen@mass.pe', telefono: '', direccion: '', clave: hash('almacen123'), rol: 'almacen', bloqueado: false, creado: hace(10) },
    ]);
    DB.set('pedidos', [
      { id: 'PED-D0002', fecha: hace(0), usuarioId: 'U-CLI1', nombre: 'Cliente Demo', telefono: '987654321', correo: 'cliente@mass.pe', entrega: 'delivery', local: 'Lima', direccion: 'Av. Arequipa 123, Lima', pago: 'Yape / Plin / QR', notas: '',
        items: [{ nombre: 'Leche Evaporada', precio: 3.6, cant: 4 }, { nombre: 'Galletas Vainilla', precio: 3.5, cant: 2 }], subtotal: 21.4, envio: 5, total: 26.4, estado: 'Pendiente' },
      { id: 'PED-D0001', fecha: hace(6), usuarioId: 'U-CLI1', nombre: 'Cliente Demo', telefono: '987654321', correo: 'cliente@mass.pe', entrega: 'recojo', local: 'Lima', direccion: '', pago: 'Efectivo', notas: '',
        items: [{ nombre: 'Arroz Extra', precio: 4.5, cant: 2 }, { nombre: 'Aceite Primiun', precio: 7.5, cant: 1 }], subtotal: 16.5, envio: 0, total: 16.5, estado: 'Entregado' },
    ]);
    DB.set('mensajes', [
      { id: 'MSG-D0001', fecha: hace(5), usuarioId: 'U-CLI1', nombre: 'Cliente Demo', correo: 'cliente@mass.pe', asunto: 'Consulta', local: 'Lima',
        mensaje: '¿Hasta qué hora atiende el local de Lima los domingos?', ofertas: false, respuesta: 'Hola, el local de Lima atiende los domingos de 8:00 a 21:00. ¡Te esperamos!', fechaResp: hace(4) },
    ]);
    DB.set('encuestas', []);
    DB.set('solicitudes', []);
    DB.set('productos', {});
    DB.set('inventario', {});
    guardar(K.semilla, true);
  }

  if (!DB.get('usuarios').some((u) => u.email === 'almacen@mass.pe')) {
    DB.add('usuarios', {
      id: 'U-ALM1', nombre: 'Almacén Demo', email: 'almacen@mass.pe', telefono: '', direccion: '',
      clave: hash('almacen123'), rol: 'almacen', bloqueado: false, creado: new Date().toISOString(),
    });
  }

  /* ---------- Menú: enlaces según la sesión (todas las páginas) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const ul = document.querySelector('.nav-enlaces');
    if (!ul) return;
    const u = DB.usuarioActual();
    const actual = location.pathname.split('/').pop() || 'index.html';
    const li = (html) => { const e = document.createElement('li'); e.innerHTML = html; ul.appendChild(e); return e; };
    const enlace = (href, txt) => '<a href="' + href + '"' + (actual === href ? ' style="color: #d6b000;"' : '') + '>' + txt + '</a>';
    if (!u) {
      li(enlace('login.html', 'Ingresar'));
    } else {
      const destino = u.rol === 'admin' ? 'admin.html' : u.rol === 'almacen' ? 'almacen.html' : 'cliente.html';
      const etiqueta = u.rol === 'admin' ? 'Panel admin' : u.rol === 'almacen' ? 'Panel almacén' : 'Mi cuenta';
      li(enlace(destino, etiqueta));
      const salir = li('<a href="#" id="btnSalir">Salir</a>');
      salir.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); DB.logout(); location.href = 'index.html'; });
    }
  });
})();
