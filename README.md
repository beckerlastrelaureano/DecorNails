# Decor Nails — agenda de turnos

App de reserva de turnos para Decor Nails (Magali Ampudia). Dos páginas:

- `index.html` — página pública, la que va en el link de Instagram. Sin login.
- `admin.html` — panel privado de Magali (Agenda + Turnos de hoy). Sin login:
  es un link que ella no comparte con nadie.

## Antes de subir esto a producción

1. Abrí `js/marca.js` y completá `whatsappSalon` con el número de WhatsApp
   del salón, formato: 549 + código de área + número, todo junto, sin
   espacios ni "+". Ejemplo: "5492954123456".
   Mientras diga "COMPLETAR-WHATSAPP-SALON", el botón de WhatsApp de la
   confirmación simplemente no se muestra.
2. Pegá las reglas de Firestore nuevas (ver `firestore.rules` en la carpeta
   de al lado del zip) en Firebase Console → Firestore Database → Reglas.

## Cómo funciona por dentro

- Colección `franjasDecorNails/{fecha}_{hora}`: si el documento existe, esa
  hora está tomada (por un turno o por un bloqueo de Magali). Si no existe,
  está libre.
- Colección `turnosDecorNails/{turnoId}`: el turno completo (nombre,
  WhatsApp, servicio, precio). Solo el panel admin lo muestra con detalle;
  la página pública solo dice "Turno ocupado".
- Sin autenticación de ningún tipo (ni para reservar, ni para el panel):
  las reglas de Firestore quedan abiertas para estas dos colecciones. El
  "candado" es que el link del panel no se comparte.
