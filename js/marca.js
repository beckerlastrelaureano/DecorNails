/**
 * marca.js — Configuración de marca y del negocio, Decor Nails
 * -----------------------------------------------------------------------
 * Acá vive todo lo que puede cambiar sin tocar el resto del código:
 * nombre, colores, lista de servicios con precio y duración, horario de
 * atención, y el WhatsApp del salón (para el link de confirmación).
 *
 */

const MARCA = {
  nombre: 'Decor',
  sufijo: 'Nails',
  nombreCompleto: 'Decor Nails',
  responsable: 'Magali Ampudia',
  descripcion: 'Reservá tu turno para uñas online, en el horario que prefieras.',

  colorAcento: '#242220',       // carbón — botones, textos fuertes
  colorAcentoClaro: '#E8E0D4',  // beige del logo — fondos, superficies
  colorAcentoRgb: '36, 34, 32',

  // Número de WhatsApp del salón, formato internacional sin "+" ni espacios
  // (Argentina: 549 + código de área sin 0 + número sin 15).
  whatsappSalon: '5492302368174',

  // DNI de 8 dígitos que pide el panel para dejar entrar a Magali.
  // OJO — esto NO es una contraseña segura de verdad: cualquiera que abra
  // "Ver código fuente" en el navegador puede leer este número acá mismo,
  // en este archivo, que es público como cualquier otro archivo del sitio.
  // Sirve para que una clienta cualquiera no entre por curiosidad, pero no
  // frena a alguien que sepa buscarlo.
  dniAdmin: '47198691',
};

// ------------------------------------------------------------------
// Horario de atención
// ------------------------------------------------------------------
const HORARIO = {
  // 0=domingo, 1=lunes ... 6=sábado (igual que Date.getDay())
  diasHabiles: [1, 2, 3, 4, 5, 6],
  horaApertura: 14,   // primera franja empieza a las 14:00
  horaCierre: 19,      // última franja termina a las 19:00 (empieza a las 18:00)
};

// ------------------------------------------------------------------
// Servicios: precio y cuántas franjas de 1 hora ocupa cada uno.
// La mayoría entra en 1 hora; las esculpidas, al llevar más trabajo,
// ocupan 2 horas seguidas. Si algún tiempo no es el real, se ajusta acá
// nomás (es el único lugar donde están escritos).
// ------------------------------------------------------------------
const SERVICIOS = [
  { id: 'semi-liso', nombre: 'Semipermanente liso', precio: 18000, franjas: 1 },
  { id: 'semi-diseno', nombre: 'Semipermanente con diseño', precio: 19000, franjas: 1 },
  { id: 'kapping-liso', nombre: 'Kapping liso', precio: 21000, franjas: 1 },
  { id: 'kapping-diseno', nombre: 'Kapping con diseño', precio: 22000, franjas: 1 },
  { id: 'softgel-liso', nombre: 'Soft gel liso', precio: 24000, franjas: 1 },
  { id: 'softgel-diseno', nombre: 'Soft gel con diseño', precio: 25000, franjas: 1 },
  { id: 'esculpidas-liso', nombre: 'Esculpidas Dual System liso', precio: 30000, franjas: 2 },
  { id: 'esculpidas-diseno', nombre: 'Esculpidas Dual System con diseño', precio: 32000, franjas: 2 },
  { id: 'retirado', nombre: 'Retirado', precio: 4000, franjas: 1 },
  { id: 'retirado-otro', nombre: 'Retirado de otro salón', precio: 5000, franjas: 1 },
];

(function aplicarMarca() {
  document.title = `${MARCA.nombreCompleto} — Reservar turno`;
  const setMeta = (selector, attr, valor) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, valor);
  };
  setMeta('meta[name="description"]', 'content', MARCA.descripcion);
  setMeta('meta[name="theme-color"]', 'content', MARCA.colorAcentoClaro);
  setMeta('meta[name="apple-mobile-web-app-title"]', 'content', MARCA.nombreCompleto);
  const raiz = document.documentElement.style;
  raiz.setProperty('--color-acento', MARCA.colorAcento);
  raiz.setProperty('--color-acento-claro', MARCA.colorAcentoClaro);
  raiz.setProperty('--color-acento-rgb', MARCA.colorAcentoRgb);
})();
