// UNA Chat: libreria de validacion y saneamiento de mensajes.
//
// Reglas de seguridad (paso 5 del laboratorio):
//  - El texto escrito por el usuario NUNCA se devuelve como HTML: se le eliminan las
//    etiquetas (y el contenido de <script>/<style>) y se escapan los caracteres especiales.
//  - El unico HTML que sale de esta libreria lo construye ella misma, y solo para
//    URLs http(s) de imagenes, de archivos de video o de YouTube que pasaron la validacion.
//  - El color solo puede ser #RRGGBB (se usa dentro de un atributo style).

var MAX_URL = 2048;
var MAX_NOMBRE = 30;
var NOMBRE_POR_DEFECTO = 'Anonimo';
var COLOR_POR_DEFECTO = '#000000';
var MENSAJE_BLOQUEADO = '[Mensaje bloqueado: contenido no permitido]';

var EXT_IMAGEN = /\.(?:jpe?g|png|gif|bmp|webp)$/i;
var EXT_VIDEO = /\.(?:mp4|webm|ogg|ogv|m4v)$/i;
var COLOR_HEX = /^#[0-9a-f]{6}$/i;
// youtu.be/ID, youtube.com/embed/ID, youtube.com/v/ID, youtube.com/watch?v=ID (con otros parametros opcionales)
var YOUTUBE = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?(?:[^\s"'<>#]*&)?v=))([\w-]{11})(?:[&?#][^\s"'<>]*)?$/i;

var ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Convierte los caracteres especiales de HTML en entidades.
function escapeHtml(valor) {
  return String(valor).replace(/[&<>"']/g, function (c) {
    return ENTIDADES[c];
  });
}

// Elimina bloques <script>/<style> completos (con su contenido), comentarios y cualquier etiqueta.
// Un "<" seguido de espacio o numero (por ejemplo "a < b" o "<3") es texto normal y se conserva.
function stripMarkup(texto) {
  return texto
    .replace(/<(script|style)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<\/?[a-z!?][^>]*(?:>|$)/gi, '');
}

// Devuelve el objeto URL solo si es una URL http(s) "limpia"; si no, null.
function parseHttpUrl(valor) {
  if (typeof valor !== 'string') {
    return null;
  }
  var texto = valor.trim();
  if (!texto || texto.length > MAX_URL) {
    return null;
  }
  // espacios, caracteres de control, comillas, <, > y ` permitirian salirse de un atributo HTML
  if (/[\s\u0000-\u001f\u007f"'<>`\\]/.test(texto)) {
    return null;
  }
  var url;
  try {
    url = new URL(texto);
  } catch (e) {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (!url.hostname || url.username || url.password) {
    return null;
  }
  return url;
}

function limpiarNombre(valor) {
  var texto = typeof valor === 'string' ? stripMarkup(valor).trim().slice(0, MAX_NOMBRE) : '';
  return texto ? escapeHtml(texto) : NOMBRE_POR_DEFECTO;
}

function limpiarColor(valor) {
  return typeof valor === 'string' && COLOR_HEX.test(valor) ? valor : COLOR_POR_DEFECTO;
}

module.exports = {

  escapeHtml: escapeHtml,

  // logica que valida si un telefono esta correcto...
  is_valid_phone: function (phone) {
    // inicializacion lazy
    var isValid = false;
    // expresion regular copiada de StackOverflow
    var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

    // validacion Regex
    try {
      isValid = re.test(phone);
    } catch (e) {
      console.log(e);
    } finally {
      return isValid;
    }
    // fin del try-catch block
  },

  // URL http(s) que termina en jpg, jpeg, png, gif, bmp o webp
  is_valid_url_image: function (url) {
    var parsed = parseHttpUrl(url);
    return parsed !== null && EXT_IMAGEN.test(parsed.pathname);
  },

  // URL http(s) de un archivo de video que el navegador puede reproducir: mp4, webm, ogg, ogv o m4v
  is_valid_url_video: function (url) {
    var parsed = parseHttpUrl(url);
    return parsed !== null && EXT_VIDEO.test(parsed.pathname);
  },

  is_valid_yt_video: function (url) {
    return typeof url === 'string' && YOUTUBE.test(url.trim());
  },

  // Identificador de 11 caracteres de un video de YouTube, o null si la URL no es de YouTube
  getYTVideoId: function (url) {
    var coincidencia = typeof url === 'string' ? YOUTUBE.exec(url.trim()) : null;
    return coincidencia ? coincidencia[1] : null;
  },

  getEmbeddedCode: function (url) {
    var id = module.exports.getYTVideoId(url);
    if (!id) {
      return '';
    }
    return '<iframe src="https://www.youtube.com/embed/' + id + '" width="560" height="315"' +
      ' title="Video de YouTube" class="chat-media chat-youtube"' +
      ' allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"' +
      ' referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
  },

  getImageTag: function (url) {
    return '<img src="' + escapeHtml(url) + '" alt="Imagen compartida en el chat"' +
      ' class="chat-media" referrerpolicy="no-referrer">';
  },

  getVideoTag: function (url) {
    return '<video src="' + escapeHtml(url) + '" controls preload="metadata" playsinline' +
      ' class="chat-media"></video>';
  },

  // Recibe el JSON que envia el cliente ({nombre, mensaje, color}) y devuelve un JSON con
  // {nombre, mensaje, color, tipo}. "nombre" y "mensaje" ya son seguros para insertarse como HTML.
  // tipo: 'texto' | 'imagen' | 'video' | 'bloqueado'
  validateMessage: function (msg) {
    var resultado = { nombre: NOMBRE_POR_DEFECTO, mensaje: '', color: COLOR_POR_DEFECTO, tipo: 'texto' };

    // Entrada invalida: se devuelve un mensaje vacio
    if (!msg || typeof msg !== 'string') {
      return JSON.stringify(resultado);
    }

    var datos;
    try {
      datos = JSON.parse(msg);
    } catch (e) {
      // no era JSON: se trata todo el contenido como texto (nunca se devuelve sin sanear)
      datos = { mensaje: msg };
    }
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      datos = { mensaje: typeof datos === 'string' ? datos : '' };
    }

    resultado.nombre = limpiarNombre(datos.nombre);
    resultado.color = limpiarColor(datos.color);

    var texto = '';
    if (typeof datos.mensaje === 'string') {
      texto = datos.mensaje;
    } else if (typeof datos.mensaje === 'number' || typeof datos.mensaje === 'boolean') {
      texto = String(datos.mensaje);
    }

    var url = parseHttpUrl(texto);
    if (url !== null && EXT_IMAGEN.test(url.pathname)) {
      resultado.tipo = 'imagen';
      resultado.mensaje = module.exports.getImageTag(url.href);
    } else if (url !== null && EXT_VIDEO.test(url.pathname)) {
      resultado.tipo = 'video';
      resultado.mensaje = module.exports.getVideoTag(url.href);
    } else if (module.exports.is_valid_yt_video(texto)) {
      resultado.tipo = 'video';
      resultado.mensaje = module.exports.getEmbeddedCode(texto);
    } else {
      var limpio = stripMarkup(texto);
      if (limpio.trim() === '' && texto.trim() !== '') {
        // todo el mensaje era codigo: se bloquea
        resultado.tipo = 'bloqueado';
        resultado.mensaje = MENSAJE_BLOQUEADO;
      } else {
        resultado.mensaje = escapeHtml(limpio.trim());
      }
    }

    return JSON.stringify(resultado);
  },

  // Nombre en espanol usado en el enunciado del laboratorio
  validarMensaje: function (msg) {
    return module.exports.validateMessage(msg);
  }

  // fin del modulo
};
