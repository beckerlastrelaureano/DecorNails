# Decor Nails — agenda de turnos

App de reserva de turnos para Decor Nails (Magali Ampudia). Páginas:

- `index.html` — página principal (landing), la que va en el link de Instagram.
  Muestra la marca y dos caminos: pedir un turno, o entrar como administradora.
- `reservar.html` — el calendario y el flujo de reserva en sí. Sin login.
- `admin.html` — panel privado de Magali (Agenda + Turnos de hoy). Pide un DNI
  de 8 dígitos antes de mostrar nada (ver más abajo).

## Antes de subir esto a producción

1. Abrí `js/marca.js` y completá `whatsappSalon` con el número de WhatsApp
   del salón (ya está cargado: `5492302368174`).
2. En el mismo archivo, completá `dniAdmin` con el DNI real de Magali (8
   dígitos, como texto). Mientras diga "COMPLETAR-DNI-ADMIN", nadie va a
   poder entrar al panel porque ningún DNI real va a coincidir con eso.
3. Pegá las reglas de Firestore (si todavía no lo hiciste) en Firebase
   Console → Firestore Database → Reglas.

## Sobre el DNI del panel — importante

Es un filtro liviano, no una contraseña de verdad: como todo el código de
esta página es público (cualquiera puede abrir "Ver código fuente" del
navegador), el DNI que pongas en `marca.js` técnicamente se puede leer ahí.
Sirve para que ninguna clienta entre por curiosidad al link de admin, no
para frenar a alguien que sepa buscarlo a propósito. Para algo más fuerte
de verdad haría falta un login real (Firebase Authentication), que es un
cambio más grande — no hace falta por ahora.

## Cómo funciona por dentro

- Colección `franjasDecorNails/{fecha}_{hora}`: si el documento existe, esa
  hora está tomada (por un turno o por un bloqueo de Magali). Si no existe,
  está libre. **Esto es lo único que la página mira para decidir si una
  hora está libre u ocupada** — así que si alguna vez borrás un turno a
  mano desde la consola de Firebase, acordate de borrar también su(s)
  documento(s) en esta colección, o la hora va a seguir apareciendo
  ocupada aunque el turno ya no exista. Desde el panel (botón "Cancelar
  turno") esto se hace solo.
- Colección `turnosDecorNails/{turnoId}`: el turno completo (nombre,
  WhatsApp, servicio, precio). Solo el panel admin lo muestra con detalle;
  la página pública solo dice "Turno ocupado".
- Cada turno reservado le da a la clienta un link de cancelación propio
  (con el ID del turno como código, imposible de adivinar). Ese link vive
  únicamente en su pantalla de confirmación — no se guarda en ningún otro
  lado, así que si lo pierde, tiene que pedirle a Magali que se lo cancele
  desde el panel.
- Sin autenticación de ningún tipo (ni para reservar, ni para el panel):
  las reglas de Firestore quedan abiertas para estas dos colecciones. El
  DNI del panel y el código del link de cancelación son filtros del lado
  de la página, no de Firestore.
