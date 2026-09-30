/**
 * Traduccion al ingles de los mensajes de error. El texto en espanol del codigo es
 * la clave (estilo gettext), asi cada excepcion se sigue escribiendo en un solo
 * lugar y AllExceptionsFilter la traduce cuando la peticion llega en ingles.
 * Un mensaje que falte aqui sale en espanol.
 */
export const ERRORS_EN: Record<string, string> = {
  'Ocurrio un error inesperado': 'An unexpected error occurred',

  // Autenticacion y sesion
  'Correo o contrasena incorrectos': 'Incorrect email or password',
  'Demasiados intentos fallidos con este correo. Espera unos minutos o restablece tu contrasena.':
    'Too many failed attempts with this email. Wait a few minutes or reset your password.',
  'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.':
    'Too many requests. Wait a moment and try again.',
  'Ya existe una cuenta con este correo electronico': 'An account with this email already exists',
  'Ya existe una cuenta con este correo y el proveedor no confirmo que te pertenece. Inicia sesion con tu contrasena.':
    'An account with this email already exists and the provider did not confirm it is yours. Sign in with your password.',
  'La cuenta esta desactivada': 'This account is disabled',
  'Usuario no encontrado': 'User not found',
  'Falta el token de acceso': 'Missing access token',
  'Falta el refresh token': 'Missing refresh token',
  'Token invalido o expirado': 'Invalid or expired token',
  'Tipo de token invalido': 'Invalid token type',
  'El refresh token no es valido o ya expiro': 'The refresh token is invalid or has expired',
  'La sesion ya fue cerrada': 'The session was already closed',
  'La sesion ya no es valida': 'The session is no longer valid',
  'La sesion ya no es valida. Vuelve a iniciar sesion.': 'The session is no longer valid. Please sign in again.',
  'No cuentas con permisos para esta operacion': 'You do not have permission for this operation',
  'Tu correo ya esta verificado': 'Your email is already verified',
  'El enlace no es valido o ya expiro': 'The link is invalid or has expired',
  'Debes indicar tu contrasena actual': 'Enter your current password',
  'La contrasena actual no es correcta': 'Your current password is incorrect',
  'Esta version de la app ya no es compatible. Actualizala para seguir usandola.':
    'This version of the app is no longer supported. Update it to keep using it.',

  // Verificacion en dos pasos
  'El codigo no es correcto': 'The code is incorrect',
  'Demasiados codigos incorrectos. Vuelve a iniciar sesion.': 'Too many incorrect codes. Please sign in again.',
  'El inicio de sesion expiro. Vuelve a empezar.': 'The sign-in expired. Please start again.',
  'El alta expiro. Vuelve a generar el codigo QR.': 'The setup expired. Generate the QR code again.',
  'La verificacion en dos pasos ya esta activa': 'Two-step verification is already on',

  // Google y Apple
  'El inicio de sesion con Google no esta configurado': 'Sign in with Google is not configured',
  'Sign in with Apple no esta configurado': 'Sign in with Apple is not configured',
  'El inicio de sesion con Google no esta configurado (define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)':
    'Sign in with Google is not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)',
  'Sign in with Apple no esta configurado (define APPLE_CLIENT_ID, APPLE_TEAM_ID y APPLE_KEY_ID)':
    'Sign in with Apple is not configured (set APPLE_CLIENT_ID, APPLE_TEAM_ID and APPLE_KEY_ID)',
  'No fue posible completar el inicio de sesion con Google': 'Sign in with Google could not be completed',
  'No fue posible completar el inicio de sesion con Apple': 'Sign in with Apple could not be completed',
  'El parametro state no es valido o ya expiro': 'The state parameter is invalid or has expired',
  'Google no devolvio un id_token': 'Google did not return an id_token',
  'Apple no devolvio un identityToken': 'Apple did not return an identityToken',
  'El token de Google no es valido': 'The Google token is invalid',
  'El token de Apple no es valido': 'The Apple token is invalid',
  'El token de Google no corresponde a este inicio de sesion': 'The Google token does not match this sign-in',
  'El token de Apple no corresponde a este inicio de sesion': 'The Apple token does not match this sign-in',
  'La cuenta de Google no expone un correo electronico': 'The Google account does not share an email address',

  // Validacion de formularios
  'El nombre completo debe tener entre 3 y 160 caracteres': 'Your full name must be between 3 and 160 characters',
  'El correo electronico no es valido': 'The email address is invalid',
  'El numero de WhatsApp no es valido': 'The WhatsApp number is invalid',
  'La contrasena debe tener al menos 8 caracteres': 'The password must be at least 8 characters long',
  'La contrasena no puede superar 128 caracteres': 'The password cannot be longer than 128 characters',
  'La contrasena es obligatoria': 'The password is required',
  'El avatar debe ser una URL https': 'The avatar must be an https URL',
  'Los dias de recurrencia deben ser un numero entero': 'Repeat days must be a whole number',
  'La recurrencia minima es de 1 dia': 'The minimum repeat interval is 1 day',
  'La recurrencia maxima es de 365 dias': 'The maximum repeat interval is 365 days',
  'Indica cada cuantos dias debe volver a aparecer el producto': 'Choose every how many days the item should come back',
  '`days` debe ser un numero entre 1 y 3650': '`days` must be a number between 1 and 3650',

  // Listas y productos
  'La lista no existe': 'The list does not exist',
  'La lista no existe o no tienes acceso a ella': 'The list does not exist or you do not have access to it',
  'Solo puedes consultar esta lista': 'You can only view this list',
  'Esta lista ya es tuya': 'This list is already yours',
  'El producto no existe': 'The item does not exist',
  'Indica el correo o el id de la persona': "Enter the person's email or id",
  'No encontramos a esa persona. Debe registrarse antes de que puedas compartirle la lista.':
    'We could not find that person. They need to sign up before you can share the list with them.',
  'Esa persona ya forma parte de la lista': 'That person is already a member of the list',
  'Esa persona no forma parte de la lista': 'That person is not a member of the list',
  'Solo la persona propietaria puede hacer esto': 'Only the owner can do this',
  'Solo la persona propietaria puede cambiar los roles': 'Only the owner can change roles',
  'Solo la persona propietaria puede modificar a otros integrantes': 'Only the owner can change other members',
  'Solo la persona propietaria puede quitar integrantes': 'Only the owner can remove members',
  'No puedes quitarle la propiedad a quien creo la lista': 'You cannot take ownership away from the person who created the list',
  'La persona propietaria no puede salirse de la lista; primero eliminala o transfierela':
    'The owner cannot leave the list; delete it or transfer it first',

  // Administracion y utilidades
  'No puedes desactivar tu propia cuenta': 'You cannot disable your own account',
  'Esta utilidad esta deshabilitada en produccion': 'This tool is disabled in production',

  // Respuestas correctas con texto
  'Si el correo esta registrado te enviamos un enlace para restablecer la contrasena.':
    'If the email is registered, we sent you a link to reset your password.',
};
