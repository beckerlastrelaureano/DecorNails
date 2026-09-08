/**
 * admin.js — Panel privado de Decor Nails (Agenda + Turnos de hoy)
 * -----------------------------------------------------------------------
 * No tiene login: es un link que solo Magali conoce. Acá puede ver el
 * detalle completo de cada turno (nombre, WhatsApp, servicio), cancelar
 * turnos, y bloquear/desbloquear una hora puntual o el día completo
 * (feriado, ausencia, etc).
 *
 * Usa las mismas colecciones que la página pública:
 *  - franjasDecorNails/{fecha}_{hora}  → existe si esa hora está tomada
 *  - turnosDecorNails/{turnoId}        → el turno completo
 */

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatoFecha(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function fechaDesdeInput(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function horasDelDia() {
  const horas = [];
  for (let h = HORARIO.horaApertura; h < HORARIO.horaCierre; h++) horas.push(h);
  return horas;
}
function idFranja(fechaStr, hora) { return `${fechaStr}_${hora}`; }

// Arma un link de WhatsApp a partir de un número suelto que puso la
// clienta (con o sin código de país). Heurística para Argentina: si son
// 10 dígitos (código de área + número), le agrega "549" adelante.
function normalizarWhatsappAR(numeroCrudo) {
  let n = (numeroCrudo || '').replace(/\D/g, '');
  if (n.length === 10) n = '549' + n;
  else if (n.startsWith('54') && !n.startsWith('549')) n = '549' + n.slice(2);
  return n;
}

// ------------------------------------------------------------------
// Tabs
// ------------------------------------------------------------------
const elTabAgenda = document.getElementById('tab-agenda');
const elTabHoy = document.getElementById('tab-hoy');
const elTabPagos = document.getElementById('tab-pagos');
const elVistaAgenda = document.getElementById('vista-agenda');
const elVistaHoy = document.getElementById('vista-hoy');
const elVistaPagos = document.getElementById('vista-pagos');

function mostrarTab(nombre) {
  elTabAgenda.classList.toggle('activa', nombre === 'agenda');
  elTabHoy.classList.toggle('activa', nombre === 'hoy');
  elTabPagos.classList.toggle('activa', nombre === 'pagos');
  elVistaAgenda.classList.toggle('oculto', nombre !== 'agenda');
  elVistaHoy.classList.toggle('oculto', nombre !== 'hoy');
  elVistaPagos.classList.toggle('oculto', nombre !== 'pagos');
}

elTabAgenda.addEventListener('click', () => mostrarTab('agenda'));
elTabHoy.addEventListener('click', () => { mostrarTab('hoy'); renderizarHoy(); });
elTabPagos.addEventListener('click', () => { mostrarTab('pagos'); renderizarPagos(); });

// ------------------------------------------------------------------
// AGENDA
// ------------------------------------------------------------------
const elInputFecha = document.getElementById('input-fecha');
const elDiaTitulo = document.getElementById('dia-titulo');
const elDiaCerrado = document.getElementById('dia-cerrado');
const elListaAgenda = document.getElementById('lista-agenda');
const elAccionesBloqueo = document.getElementById('acciones-bloqueo');

let fechaActual = new Date();

function irAFecha(d) {
  fechaActual = d;
  elInputFecha.value = formatoFecha(d);
  renderizarAgenda();
}

document.getElementById('btn-dia-anterior').addEventListener('click', () => {
  const d = new Date(fechaActual); d.setDate(d.getDate() - 1); irAFecha(d);
});
document.getElementById('btn-dia-siguiente').addEventListener('click', () => {
  const d = new Date(fechaActual); d.setDate(d.getDate() + 1); irAFecha(d);
});
elInputFecha.addEventListener('change', () => {
  if (elInputFecha.value) irAFecha(fechaDesdeInput(elInputFecha.value));
});

async function traerEstadoDiaCompleto(fechaStr) {
  const horas = horasDelDia();
  const snaps = await Promise.all(
    horas.map(h => db.collection('franjasDecorNails').doc(idFranja(fechaStr, h)).get())
  );
  const estado = {};
  horas.forEach((h, i) => { estado[h] = snaps[i].exists ? { id: snaps[i].id, ...snaps[i].data() } : null; });
  return estado;
}

async function traerTurno(turnoId) {
  const snap = await db.collection('turnosDecorNails').doc(turnoId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function renderizarAgenda() {
  const fechaStr = formatoFecha(fechaActual);
  const diaSemana = fechaActual.getDay();
  elDiaTitulo.textContent = `${DIAS_SEMANA[diaSemana]} ${fechaActual.getDate()} de ${MESES[fechaActual.getMonth()]}`;

  if (!HORARIO.diasHabiles.includes(diaSemana)) {
    elDiaCerrado.classList.remove('oculto');
    elListaAgenda.classList.add('oculto');
    elAccionesBloqueo.innerHTML = '';
    return;
  }
  elDiaCerrado.classList.add('oculto');
  elListaAgenda.classList.remove('oculto');
  elListaAgenda.innerHTML = '<p style="color:var(--carbon-suave);font-size:14px;">Cargando…</p>';

  const estadoDia = await traerEstadoDiaCompleto(fechaStr);
  pintarAccionesBloqueo(fechaStr, estadoDia);
  await pintarAgendaDelDia(fechaStr, estadoDia);
}

function pintarAccionesBloqueo(fechaStr, estadoDia) {
  const horas = horasDelDia();
  const hayTurnoEseDia = horas.some(h => estadoDia[h] && estadoDia[h].tipo === 'turno');
  const todoBloqueado = horas.every(h => estadoDia[h] && estadoDia[h].tipo === 'bloqueo');

  elAccionesBloqueo.innerHTML = '';
  const btn = document.createElement('button');
  if (todoBloqueado) {
    btn.textContent = 'Desbloquear el día';
    btn.addEventListener('click', () => desbloquearDia(fechaStr));
  } else {
    btn.textContent = 'Bloquear todo el día (feriado)';
    btn.addEventListener('click', () => bloquearDia(fechaStr, hayTurnoEseDia));
  }
  elAccionesBloqueo.appendChild(btn);
}

async function pintarAgendaDelDia(fechaStr, estadoDia) {
  const horas = horasDelDia();
  elListaAgenda.innerHTML = '';

  for (const hora of horas) {
    const info = estadoDia[hora];
    const div = document.createElement('div');
    div.className = 'franja';

    if (info && info.tipo === 'turno' && info.esInicio) {
      const turno = await traerTurno(info.turnoId);
      div.classList.add('ocupada');
      div.innerHTML = `
        <div class="franja-cabecera" style="cursor:default;">
          <span class="hora">${String(hora).padStart(2,'0')}:00</span>
          <span class="estado">${turno ? turno.servicio : 'Turno'}</span>
        </div>
        <div class="panel-servicio">
          <div class="cliente">${turno ? turno.clienteNombre : ''} — $${turno ? turno.precio.toLocaleString('es-AR') : ''}</div>
          <div class="acciones">
            <a href="https://wa.me/${normalizarWhatsappAR(turno ? turno.clienteWhatsapp : '')}" target="_blank" rel="noopener">WhatsApp</a>
            <button type="button" data-turno="${info.turnoId}">Cancelar turno</button>
          </div>
        </div>`;
      div.querySelector('button[data-turno]').addEventListener('click', () => cancelarTurno(fechaStr, info.turnoId));
    } else if (info && info.tipo === 'turno' && !info.esInicio) {
      // segunda franja de un servicio largo (ej. esculpidas) — ya se mostró arriba
      div.classList.add('ocupada');
      div.innerHTML = `<div class="franja-cabecera" style="cursor:default;"><span class="hora">${String(hora).padStart(2,'0')}:00</span><span class="estado">(continúa el turno anterior)</span></div>`;
    } else if (info && info.tipo === 'bloqueo') {
      div.classList.add('bloqueada');
      div.innerHTML = `
        <div class="franja-cabecera" style="cursor:default;">
          <span class="hora">${String(hora).padStart(2,'0')}:00</span>
          <span class="estado">${info.motivo || 'Bloqueado'}</span>
        </div>
        <div class="panel-servicio">
          <div class="acciones"><button type="button">Desbloquear esta hora</button></div>
        </div>`;
      div.querySelector('button').addEventListener('click', () => desbloquearHora(fechaStr, hora));
    } else {
      div.classList.add('disponible');
      div.innerHTML = `
        <div class="franja-cabecera" style="cursor:default;">
          <span class="hora">${String(hora).padStart(2,'0')}:00</span>
          <span class="estado">Disponible</span>
        </div>
        <div class="panel-servicio">
          <div class="acciones"><button type="button">Bloquear esta hora</button></div>
        </div>`;
      div.querySelector('button').addEventListener('click', () => bloquearHora(fechaStr, hora));
    }

    elListaAgenda.appendChild(div);
  }
}

async function bloquearHora(fechaStr, hora) {
  const motivo = prompt('Motivo (opcional):', 'No disponible');
  if (motivo === null) return;
  await db.collection('franjasDecorNails').doc(idFranja(fechaStr, hora)).set({
    tipo: 'bloqueo', motivo: motivo || 'No disponible',
  });
  renderizarAgenda();
}

async function desbloquearHora(fechaStr, hora) {
  await db.collection('franjasDecorNails').doc(idFranja(fechaStr, hora)).delete();
  renderizarAgenda();
}

async function bloquearDia(fechaStr, hayTurnoEseDia) {
  if (hayTurnoEseDia) {
    if (!confirm('Ya hay turnos reservados ese día. Se van a bloquear solo las horas libres (las que ya tienen turno quedan igual). ¿Seguimos?')) return;
  } else if (!confirm('¿Bloquear todo el día?')) {
    return;
  }
  const motivo = prompt('Motivo (ej: Feriado):', 'Feriado') || 'Feriado';
  const horas = horasDelDia();
  const estadoDia = await traerEstadoDiaCompleto(fechaStr);
  const batch = db.batch();
  horas.forEach(h => {
    if (!estadoDia[h]) {
      batch.set(db.collection('franjasDecorNails').doc(idFranja(fechaStr, h)), { tipo: 'bloqueo', motivo });
    }
  });
  await batch.commit();
  renderizarAgenda();
}

async function desbloquearDia(fechaStr) {
  if (!confirm('¿Desbloquear todo el día?')) return;
  const horas = horasDelDia();
  const estadoDia = await traerEstadoDiaCompleto(fechaStr);
  const batch = db.batch();
  horas.forEach(h => {
    if (estadoDia[h] && estadoDia[h].tipo === 'bloqueo') {
      batch.delete(db.collection('franjasDecorNails').doc(idFranja(fechaStr, h)));
    }
  });
  await batch.commit();
  renderizarAgenda();
}

async function cancelarTurno(fechaStr, turnoId) {
  if (!confirm('¿Cancelar este turno?')) return;
  // Buscamos TODAS las franjas que apunten a este turno (por si ocupaba
  // más de una hora) y las borramos junto con el turno. Hacerlo así, en
  // vez de mirar turno.franjas, funciona incluso si el turno ya no existe
  // (por ejemplo, si se borró a mano desde la consola de Firebase sin
  // borrar también sus franjas).
  const franjasSnap = await db.collection('franjasDecorNails').where('turnoId', '==', turnoId).get();
  const batch = db.batch();
  franjasSnap.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection('turnosDecorNails').doc(turnoId));
  await batch.commit();
  renderizarAgenda();
}

// ------------------------------------------------------------------
// TURNOS DE HOY
// ------------------------------------------------------------------
async function marcarPago(turnoId, pagado) {
  await db.collection('turnosDecorNails').doc(turnoId).update({ pagado });
}

function tarjetaTurnoHTML(t) {
  return `
    <div class="fila-superior">
      <span class="hora">${String(t.horaInicio).padStart(2,'0')}:00</span>
      <span class="precio">$${t.precio.toLocaleString('es-AR')}</span>
    </div>
    <div class="servicio">${t.servicio}</div>
    <div class="cliente">${t.clienteNombre}</div>
    <label class="check-cobrado">
      <input type="checkbox" data-pagado="${t.id}" ${t.pagado ? 'checked' : ''}>
      Cobrado
    </label>
    <div class="acciones">
      <a href="https://wa.me/${normalizarWhatsappAR(t.clienteWhatsapp)}" target="_blank" rel="noopener">WhatsApp</a>
      <button type="button" data-cancelar="${t.id}">Cancelar</button>
    </div>`;
}

async function renderizarHoy() {
  const hoy = new Date();
  const fechaStr = formatoFecha(hoy);
  document.getElementById('hoy-titulo').textContent = `Hoy — ${DIAS_SEMANA[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  const elLista = document.getElementById('lista-hoy');
  const elTotal = document.getElementById('total-hoy');
  elLista.innerHTML = '<p style="color:var(--carbon-suave);font-size:14px;">Cargando…</p>';
  elTotal.classList.add('oculto');

  const snap = await db.collection('turnosDecorNails').where('fecha', '==', fechaStr).get();
  const turnos = [];
  snap.forEach(doc => turnos.push({ id: doc.id, ...doc.data() }));
  turnos.sort((a, b) => a.horaInicio - b.horaInicio);

  if (turnos.length === 0) {
    elLista.innerHTML = '<div class="vacio-admin">Todavía no hay turnos reservados para hoy.</div>';
    return;
  }

  elLista.innerHTML = '';
  let total = 0;
  turnos.forEach(t => {
    total += t.precio;
    const div = document.createElement('div');
    div.className = 'tarjeta-turno';
    div.innerHTML = tarjetaTurnoHTML(t);
    div.querySelector('button[data-cancelar]').addEventListener('click', () => cancelarTurno(fechaStr, t.id).then(renderizarHoy));
    div.querySelector('input[data-pagado]').addEventListener('change', (e) => marcarPago(t.id, e.target.checked));
    elLista.appendChild(div);
  });

  elTotal.classList.remove('oculto');
  elTotal.innerHTML = `<span>Total del día</span><span>$${total.toLocaleString('es-AR')}</span>`;
}

// ------------------------------------------------------------------
// PAGOS
// ------------------------------------------------------------------
let fechaPagos = new Date();

function irAFechaPagos(d) {
  fechaPagos = d;
  document.getElementById('input-fecha-pagos').value = formatoFecha(d);
  renderizarPagos();
}

document.getElementById('btn-pagos-dia-anterior').addEventListener('click', () => {
  const d = new Date(fechaPagos); d.setDate(d.getDate() - 1); irAFechaPagos(d);
});
document.getElementById('btn-pagos-dia-siguiente').addEventListener('click', () => {
  const d = new Date(fechaPagos); d.setDate(d.getDate() + 1); irAFechaPagos(d);
});
document.getElementById('input-fecha-pagos').addEventListener('change', (e) => {
  if (e.target.value) irAFechaPagos(fechaDesdeInput(e.target.value));
});

async function renderizarPagos() {
  const fechaStr = formatoFecha(fechaPagos);
  document.getElementById('input-fecha-pagos').value = fechaStr;
  document.getElementById('pagos-titulo').textContent =
    `${DIAS_SEMANA[fechaPagos.getDay()]} ${fechaPagos.getDate()} de ${MESES[fechaPagos.getMonth()]}`;

  const elLista = document.getElementById('lista-pagos');
  const elResumen = document.getElementById('resumen-pagos');
  elLista.innerHTML = '<p style="color:var(--carbon-suave);font-size:14px;">Cargando…</p>';
  elResumen.innerHTML = '';

  const snap = await db.collection('turnosDecorNails').where('fecha', '==', fechaStr).get();
  const turnos = [];
  snap.forEach(doc => turnos.push({ id: doc.id, ...doc.data() }));
  turnos.sort((a, b) => a.horaInicio - b.horaInicio);

  if (turnos.length === 0) {
    elLista.innerHTML = '<div class="vacio-admin">No hay turnos ese día.</div>';
    return;
  }

  elLista.innerHTML = '';
  let cobrado = 0, pendiente = 0;
  turnos.forEach(t => {
    if (t.pagado) cobrado += t.precio; else pendiente += t.precio;
    const div = document.createElement('div');
    div.className = 'tarjeta-turno';
    div.innerHTML = tarjetaTurnoHTML(t);
    div.querySelector('button[data-cancelar]').addEventListener('click', () => cancelarTurno(fechaStr, t.id).then(renderizarPagos));
    div.querySelector('input[data-pagado]').addEventListener('change', (e) => marcarPago(t.id, e.target.checked).then(renderizarPagos));
    elLista.appendChild(div);
  });

  elResumen.innerHTML = `
    <div class="total-dia"><span>Cobrado</span><span>$${cobrado.toLocaleString('es-AR')}</span></div>
    <div class="total-dia" style="background:var(--beige-suave);"><span>Pendiente</span><span>$${pendiente.toLocaleString('es-AR')}</span></div>
  `;
}

// ------------------------------------------------------------------
// Portón de acceso (DNI)
// ------------------------------------------------------------------
const CLAVE_SESION = 'decorNailsAdminOk';
const elVistaAcceso = document.getElementById('vista-acceso');
const elPanelAdmin = document.getElementById('panel-admin');

function soloDigitos(s) { return (s || '').replace(/\D/g, ''); }

function intentarEntrar() {
  const valor = document.getElementById('input-dni').value;
  const elError = document.getElementById('error-acceso');
  if (soloDigitos(valor) === soloDigitos(MARCA.dniAdmin)) {
    sessionStorage.setItem(CLAVE_SESION, '1');
    elVistaAcceso.classList.add('oculto');
    elPanelAdmin.classList.remove('oculto');
    irAFecha(new Date());
  } else {
    elError.classList.remove('oculto');
    document.getElementById('input-dni').value = '';
  }
}

document.getElementById('btn-entrar').addEventListener('click', intentarEntrar);
document.getElementById('input-dni').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') intentarEntrar();
});
document.getElementById('btn-salir').addEventListener('click', () => {
  sessionStorage.removeItem(CLAVE_SESION);
  elPanelAdmin.classList.add('oculto');
  elVistaAcceso.classList.remove('oculto');
});

if (sessionStorage.getItem(CLAVE_SESION) === '1') {
  elVistaAcceso.classList.add('oculto');
  elPanelAdmin.classList.remove('oculto');
  irAFecha(new Date());
}
