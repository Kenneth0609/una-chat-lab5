# Dudas para negocio — REQ-012

**1. ¿El límite de 280 caracteres debe aplicar solo al cliente (navegador) o también debe revisarse en el servidor, por si alguien envía el mensaje saltándose la pantalla del chat?**
- **Qué indica el requerimiento:** El requerimiento describe el comportamiento al pulsar Send: no agregar el mensaje al historial, conservar el texto en el campo y avisar al visitante. No menciona el servidor.
- **Qué falta definir:** Si negocio quiere una segunda barrera en el servidor para mensajes que no pasen por la pantalla normal del chat.
- **Cómo afecta al resultado:** Si se requiere, habría que agregar validación en server.js o libs/unalib.js, además de la regla de Send; eso sería otro cambio de OpenSpec.
- **Supuesto adoptado mientras tanto:** Se implementa únicamente la regla de Send en public/validators/, tal como describe el requerimiento y el contrato de reglas de envío del chat.

**2. ¿Cuál debe ser el texto exacto que ve el visitante cuando el mensaje es demasiado largo?**
- **Qué indica el requerimiento:** Solo indica que el sistema debe avisarle al visitante que el mensaje es demasiado largo, sin fijar la redacción exacta.
- **Qué falta definir:** La redacción final en español que debe mostrarse en el área de aviso.
- **Cómo afecta al resultado:** Solo cambia el texto visible; no cambia el comportamiento (bloqueo, campo conservado, etc.).
- **Supuesto adoptado mientras tanto:** Se usó el texto: "El mensaje es demasiado largo (máximo 280 caracteres)."
