# Dudas para negocio — REQ-011

**1. Cuando se rechaza el envio por falta de nombre, Â¿el mensaje que la persona ya escribio debe quedar en el campo de mensaje, o tambien debe borrarse?**
- **Qué indica el requerimiento:** El texto solo indica que el campo de nombre de usuario debe quedar vacio; no menciona el campo de mensaje.
- **Qué falta definir:** Si el campo de mensaje debe conservarse tal cual lo escribio la persona, o vaciarse junto con el nombre.
- **Cómo afecta al resultado:** Si se debe vaciar tambien el mensaje, la persona tendria que volver a escribirlo despues de poner su nombre; si se conserva, solo necesita escribir el nombre y reenviar.
- **Supuesto adoptado mientras tanto:** Se conserva el texto del mensaje tal como lo escribio la persona; solo se vacia el campo de nombre.

**2. Â¿Cual debe ser el texto exacto del aviso que le dice a la persona que escriba un nombre?**
- **Qué indica el requerimiento:** Solo pide que el sistema 'le diga a la persona que escriba un nombre', sin dar el texto exacto.
- **Qué falta definir:** La redaccion precisa en espanol del mensaje mostrado.
- **Cómo afecta al resultado:** Cambia unicamente el texto visible para la persona, no el comportamiento del envio.
- **Supuesto adoptado mientras tanto:** Se usa el texto: "Escriba un nombre para enviar el mensaje."

**3. Si tanto el nombre como el mensaje estan vacios o solo tienen espacios, Â¿que aviso debe ver la persona: el de falta de nombre, el de mensaje vacio, o ambos?**
- **Qué indica el requerimiento:** La clausula de REQ-011 solo aplica cuando hay 'un mensaje real'; no cubre el caso en que ambos campos estan vacios.
- **Qué falta definir:** Cual aviso debe ganar cuando ambos campos fallan al mismo tiempo.
- **Cómo afecta al resultado:** No cambia si el mensaje se envia (en ningun caso se envia), solo cual texto de aviso ve la persona primero.
- **Supuesto adoptado mientras tanto:** Esta regla no se activa en ese caso (no es 'un mensaje real'); el aviso de mensaje vacio (otra capacidad, REQ-010) es responsable de ese caso.
