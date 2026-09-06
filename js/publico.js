/**
 * publico.js — Página pública de reserva de turnos (Decor Nails)
 * -----------------------------------------------------------------------
 * Sin login. Cualquiera con el link puede:
 *  1) elegir un día y ver las franjas de 14 a 19hs,
 *  2) tocar una franja libre, elegir el servicio (ve el precio al toque),
 *  3) confirmar con su nombre y WhatsApp,
 *  4) reservar (evitando choques con una transacción de Firestore) y
 *     recibir un link de WhatsApp ya redactado para mandarle a Magali.
 *
 * Modelo de datos:
 *  - franjasDecorNails/{fecha}_{hora}   → si existe, esa hora está tomada
 *      { tipo: 'turno'|'bloqueo', turnoId?, esInicio, motivo? }
 *  - turnosDecorNails/{turnoId}         → el turno completo (para el panel)
 *  - bloqueosDecorNails/{fecha}         → registro de qué bloqueó Magali
 */

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const elInputFecha = document.getElementById('input-fecha');
const elDiaTitulo = document.getElementById('dia-titulo');
const elDiaCerrado = document.getElementById('dia-cerrado');
const elListaFranjas = document.getElementById('lista-franjas');
const elVistaReserva = document.getElementById('vista-reserva');
const elVistaConfirmacion = document.getElementById('vista-confirmacion');

let fechaActual = new Date();
let panelAbiertoHora = null; // qué franja tiene el panel de servicio desplegado

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

function idFranja(fechaStr, hora) {
  return `${fechaStr}_${hora}`;
}

// ------------------------------------------------------------------
// Ir a una fecha nueva
// ------------------------------------------------------------------
function irAFecha(d) {
  fechaActual = d;
  panelAbiertoHora = null;
  elInputFecha.value = formatoFecha(d);
  renderizarDia();
}

document.getElementById('btn-dia-anterior').addEventListener('click', () => {
  const d = new Date(fechaActual);
  d.setDate(d.getDate() - 1);
  irAFecha(d);
});

document.getElementById('btn-dia-siguiente').addEventListener('click', () => {
  const d = new Date(fechaActual);
  d.setDate(d.getDate() + 1);
  irAFecha(d);
});

elInputFecha.addEventListener('change', () => {
  if (!elInputFecha.value) return;
  irAFecha(fechaDesdeInput(elInputFecha.value));
});

// ------------------------------------------------------------------
// Traer el estado de las 5 franjas del día desde Firestore
// ------------------------------------------------------------------
async function traerEstadoDia(fechaStr) {
  const horas = horasDelDia();
  const snaps = await Promise.all(
    horas.map(h => db.collection('franjasDecorNails').doc(idFranja(fechaStr, h)).get())
  );
  const estado = {};
  horas.forEach((h, i) => {
    estado[h] = snaps[i].exists ? snaps[i].data() : null;
  });
  return estado;
}

// ------------------------------------------------------------------
// Render principal del día
// ------------------------------------------------------------------
async function renderizarDia() {
  const fechaStr = formatoFecha(fechaActual);
  const diaSemana = fechaActual.getDay();

  elDiaTitulo.textContent = `${DIAS_SEMANA[diaSemana]} ${fechaActual.getDate()} de ${MESES[fechaActual.getMonth()]}`;

  if (!HORARIO.diasHabiles.includes(diaSemana)) {
    elDiaCerrado.classList.remove('oculto');
    elListaFranjas.classList.add('oculto');
    return;
  }
  elDiaCerrado.classList.add('oculto');
  elListaFranjas.classList.remove('oculto');
  elListaFranjas.innerHTML = '<p style="color:var(--carbon-suave);font-size:14px;">Cargando horarios…</p>';

  const estadoDia = await traerEstadoDia(fechaStr);
  pintarFranjas(fechaStr, estadoDia);
}

function pintarFranjas(fechaStr, estadoDia) {
  const horas = horasDelDia();
  elListaFranjas.innerHTML = '';

  horas.forEach(hora => {
    const info = estadoDia[hora];
    const div = document.createElement('div');
    div.className = 'franja';

    let estadoTexto = 'Disponible';
    let clickable = true;

    if (info && info.tipo === 'turno') {
      div.classList.add('ocupada');
      estadoTexto = 'Turno ocupado';
      clickable = false;
    } else if (info && info.tipo === 'bloqueo') {
      div.classList.add('bloqueada');
      estadoTexto = info.motivo || 'No disponible';
      clickable = false;
    } else {
      div.classList.add('disponible');
    }

    if (panelAbiertoHora === hora) div.classList.add('seleccionada');

    const cabecera = document.createElement('button');
    cabecera.type = 'button';
    cabecera.className = 'franja-cabecera';
    cabecera.innerHTML = `<span class="hora">${String(hora).padStart(2,'0')}:00</span><span class="estado">${estadoTexto}</span>`;
    if (clickable) {
      cabecera.addEventListener('click', () => {
        panelAbiertoHora = (panelAbiertoHora === hora) ? null : hora;
        pintarFranjas(fechaStr, estadoDia);
      });
    }
    div.appendChild(cabecera);

    if (panelAbiertoHora === hora) {
      div.appendChild(armarPanelServicio(fechaStr, hora, estadoDia));
    }

    elListaFranjas.appendChild(div);
  });
}

// ------------------------------------------------------------------
// Panel de elegir servicio + confirmar datos, dentro de la franja
// ------------------------------------------------------------------
function armarPanelServicio(fechaStr, horaInicio, estadoDia) {
  const panel = document.createElement('div');
  panel.className = 'panel-servicio';

  const lista = document.createElement('div');
  lista.className = 'lista-servicios';

  let servicioElegido = null;

  SERVICIOS.forEach(serv => {
    const entra = cabeEnHorario(horaInicio, serv.franjas, estadoDia);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opcion-servicio';
    btn.disabled = !entra;
    btn.innerHTML = `<span>${serv.nombre}${!entra ? ' — no entra en este horario' : ''}</span><span class="precio">$${serv.precio.toLocaleString('es-AR')}</span>`;
    btn.addEventListener('click', () => {
      servicioElegido = serv;
      lista.querySelectorAll('.opcion-servicio').forEach(b => b.classList.remove('activa'));
      btn.classList.add('activa');
      formulario.classList.remove('oculto');
    });
    lista.appendChild(btn);
  });

  panel.appendChild(lista);

  const formulario = document.createElement('div');
  formulario.className = 'form-confirmar oculto';
  formulario.innerHTML = `
    <label for="campo-nombre-${horaInicio}">Tu nombre</label>
    <input type="text" id="campo-nombre-${horaInicio}" placeholder="Nombre y apellido">
    <label for="campo-whatsapp-${horaInicio}">Tu WhatsApp</label>
    <input type="tel" id="campo-whatsapp-${horaInicio}" placeholder="Ej: 2954123456">
    <button type="button" class="boton-primario" id="btn-confirmar-${horaInicio}">Confirmar turno</button>
    <div class="mensaje-error oculto" id="error-${horaInicio}"></div>
  `;
  panel.appendChild(formulario);

  formulario.querySelector(`#btn-confirmar-${horaInicio}`).addEventListener('click', async () => {
    const nombre = formulario.querySelector(`#campo-nombre-${horaInicio}`).value.trim();
    const whatsapp = formulario.querySelector(`#campo-whatsapp-${horaInicio}`).value.trim();
    const elError = formulario.querySelector(`#error-${horaInicio}`);
    elError.classList.add('oculto');

    if (!servicioElegido) return;
    if (!nombre) { elError.textContent = 'Falta tu nombre.'; elError.classList.remove('oculto'); return; }
    if (whatsapp.replace(/\D/g,'').length < 8) { elError.textContent = 'Revisá tu número de WhatsApp.'; elError.classList.remove('oculto'); return; }

    const btnConfirmar = formulario.querySelector(`#btn-confirmar-${horaInicio}`);
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Reservando…';

    try {
      await reservarTurno(fechaStr, horaInicio, servicioElegido, nombre, whatsapp);
      mostrarConfirmacion(fechaStr, horaInicio, servicioElegido, nombre, whatsapp);
    } catch (e) {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Confirmar turno';
      if (e && e.message === 'OCUPADO') {
        elError.textContent = 'Uy, alguien reservó ese horario justo antes que vos. Elegí otro, por favor.';
      } else {
        elError.textContent = 'No se pudo guardar el turno. Probá de nuevo en un momento.';
        console.error(e);
      }
      elError.classList.remove('oculto');
      panelAbiertoHora = null;
      renderizarDia();
    }
  });

  return panel;
}

function cabeEnHorario(horaInicio, franjasNecesarias, estadoDia) {
  for (let i = 0; i < franjasNecesarias; i++) {
    const h = horaInicio + i;
    if (h >= HORARIO.horaCierre) return false;       // se pasaría del cierre
    if (estadoDia[h] !== undefined && estadoDia[h] !== null) return false; // ocupada/bloqueada
  }
  return true;
}

// ------------------------------------------------------------------
// Reserva con transacción (evita que dos personas tomen la misma hora)
// ------------------------------------------------------------------
async function reservarTurno(fechaStr, horaInicio, servicio, clienteNombre, clienteWhatsapp) {
  const turnoRef = db.collection('turnosDecorNails').doc();
  const horas = [];
  for (let i = 0; i < servicio.franjas; i++) horas.push(horaInicio + i);
  const franjaRefs = horas.map(h => db.collection('franjasDecorNails').doc(idFranja(fechaStr, h)));

  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(franjaRefs.map(ref => tx.get(ref)));
    if (snaps.some(s => s.exists)) {
      throw new Error('OCUPADO');
    }
    tx.set(turnoRef, {
      fecha: fechaStr,
      horaInicio,
      franjas: servicio.franjas,
      servicio: servicio.nombre,
      precio: servicio.precio,
      clienteNombre,
      clienteWhatsapp,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
    franjaRefs.forEach((ref, idx) => {
      tx.set(ref, {
        tipo: 'turno',
        turnoId: turnoRef.id,
        esInicio: idx === 0,
      });
    });
  });
}

// ------------------------------------------------------------------
// Pantalla de confirmación + link de WhatsApp
// ------------------------------------------------------------------
function mostrarConfirmacion(fechaStr, horaInicio, servicio, nombre, whatsapp) {
  elVistaReserva.classList.add('oculto');
  elVistaConfirmacion.classList.remove('oculto');

  const fecha = fechaDesdeInput(fechaStr);
  const fechaLegible = `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  const horaTexto = `${String(horaInicio).padStart(2,'0')}:00hs`;

  document.getElementById('recibo-datos').innerHTML = `
    <dt>Día</dt><dd>${fechaLegible}</dd>
    <dt>Hora</dt><dd>${horaTexto}</dd>
    <dt>Servicio</dt><dd>${servicio.nombre}</dd>
    <dt>Precio</dt><dd>$${servicio.precio.toLocaleString('es-AR')}</dd>
  `;

  const btnWhatsapp = document.getElementById('btn-whatsapp');
  if (MARCA.whatsappSalon && !MARCA.whatsappSalon.startsWith('COMPLETAR')) {
    const mensaje = `Hola! Quiero confirmar mi turno en Decor Nails: ${fechaLegible} a las ${horaTexto} — ${servicio.nombre} ($${servicio.precio.toLocaleString('es-AR')}). Mi nombre: ${nombre}.`;
    btnWhatsapp.href = `https://wa.me/${MARCA.whatsappSalon}?text=${encodeURIComponent(mensaje)}`;
    btnWhatsapp.classList.remove('oculto');
  } else {
    btnWhatsapp.classList.add('oculto');
  }
}

document.getElementById('btn-volver').addEventListener('click', () => {
  elVistaConfirmacion.classList.add('oculto');
  elVistaReserva.classList.remove('oculto');
  panelAbiertoHora = null;
  renderizarDia();
});

// ------------------------------------------------------------------
// Arranque
// ------------------------------------------------------------------
elInputFecha.min = formatoFecha(new Date());
irAFecha(new Date());
