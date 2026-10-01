/**
 * Traducción al inglés de los mensajes de error. El texto en español del código es
 * la clave (estilo gettext), así cada excepción se sigue escribiendo en un solo
 * lugar y AllExceptionsFilter la traduce cuando la petición llega en inglés.
 * Un mensaje que falte aquí sale en español.
 */
export const ERRORS_EN: Record<string, string> = {
  'Ocurrió un error inesperado': 'An unexpected error occurred',

  // Autenticación y sesión
  'Correo o contraseña incorrectos': 'Incorrect email or password',
  'Demasiados intentos fallidos con este correo. Espera unos minutos o restablece tu contraseña.':
    'Too many failed attempts with this email. Wait a few minutes or reset your password.',
  'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.':
    'Too many requests. Wait a moment and try again.',
  'Ya existe una cuenta con este correo electrónico': 'An account with this email already exists',
  'Ya existe una cuenta con este correo y el proveedor no confirmó que te pertenece. Inicia sesión con tu contraseña.':
    'An account with this email already exists and the provider did not confirm it is yours. Sign in with your password.',
  'La cuenta está desactivada': 'This account is disabled',
  'Usuario no encontrado': 'User not found',
  'Falta el token de acceso': 'Missing access token',
  'Falta el refresh token': 'Missing refresh token',
  'Token inválido o expirado': 'Invalid or expired token',
  'Tipo de token inválido': 'Invalid token type',
  'El refresh token no es válido o ya expiró': 'The refresh token is invalid or has expired',
  'La sesión ya fue cerrada': 'The session was already closed',
  'La sesión ya no es válida': 'The session is no longer valid',
  'La sesión ya no es válida. Vuelve a iniciar sesión.': 'The session is no longer valid. Please sign in again.',
  'No cuentas con permisos para esta operación': 'You do not have permission for this operation',
  'Tu correo ya está verificado': 'Your email is already verified',
  'El enlace no es válido o ya expiró': 'The link is invalid or has expired',
  'Debes indicar tu contraseña actual': 'Enter your current password',
  'La contraseña actual no es correcta': 'Your current password is incorrect',
  'Esta versión de la app ya no es compatible. Actualízala para seguir usándola.':
    'This version of the app is no longer supported. Update it to keep using it.',

  // Verificación en dos pasos
  'El código no es correcto': 'The code is incorrect',
  'Activa la verificación en dos pasos para usar el panel de administración':
    'Turn on two-step verification to use the admin panel',
  'Las cuentas de administración deben mantener la verificación en dos pasos':
    'Admin accounts must keep two-step verification on',
  'El token de notificaciones no es válido': 'The notification token is invalid',
  'Escribe tu contraseña para eliminar la cuenta': 'Enter your password to delete your account',
  'La contraseña no es correcta': 'The password is incorrect',
  'El código de verificación no es correcto': 'The verification code is incorrect',
  'Demasiados códigos incorrectos. Vuelve a iniciar sesión.': 'Too many incorrect codes. Please sign in again.',
  'El inicio de sesión expiró. Vuelve a empezar.': 'The sign-in expired. Please start again.',
  'El alta expiró. Vuelve a generar el código QR.': 'The setup expired. Generate the QR code again.',
  'La verificación en dos pasos ya está activa': 'Two-step verification is already on',

  // Google y Apple
  'El inicio de sesión con Google no está configurado': 'Sign in with Google is not configured',
  'Sign in with Apple no está configurado': 'Sign in with Apple is not configured',
  'El inicio de sesión con Google no está configurado (define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)':
    'Sign in with Google is not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)',
  'Sign in with Apple no está configurado (define APPLE_CLIENT_ID, APPLE_TEAM_ID y APPLE_KEY_ID)':
    'Sign in with Apple is not configured (set APPLE_CLIENT_ID, APPLE_TEAM_ID and APPLE_KEY_ID)',
  'No fue posible completar el inicio de sesión con Google': 'Sign in with Google could not be completed',
  'No fue posible completar el inicio de sesión con Apple': 'Sign in with Apple could not be completed',
  'El parámetro state no es válido o ya expiró': 'The state parameter is invalid or has expired',
  'Google no devolvió un id_token': 'Google did not return an id_token',
  'Apple no devolvió un identityToken': 'Apple did not return an identityToken',
  'El token de Google no es válido': 'The Google token is invalid',
  'El token de Apple no es válido': 'The Apple token is invalid',
  'El token de Google no corresponde a este inicio de sesión': 'The Google token does not match this sign-in',
  'El token de Apple no corresponde a este inicio de sesión': 'The Apple token does not match this sign-in',
  'La cuenta de Google no expone un correo electrónico': 'The Google account does not share an email address',

  // Validación de formularios
  'El nombre completo debe tener entre 3 y 160 caracteres': 'Your full name must be between 3 and 160 characters',
  'El correo electrónico no es válido': 'The email address is invalid',
  'El número de WhatsApp no es válido': 'The WhatsApp number is invalid',
  'La contraseña debe tener al menos 8 caracteres': 'The password must be at least 8 characters long',
  'La contraseña no puede superar 128 caracteres': 'The password cannot be longer than 128 characters',
  'La contraseña es obligatoria': 'The password is required',
  'El avatar debe ser una URL https': 'The avatar must be an https URL',
  'Los días de recurrencia deben ser un número entero': 'Repeat days must be a whole number',
  'La recurrencia mínima es de 1 día': 'The minimum repeat interval is 1 day',
  'La recurrencia máxima es de 365 días': 'The maximum repeat interval is 365 days',
  'Indica cada cuántos días debe volver a aparecer el producto': 'Choose every how many days the item should come back',
  '`days` debe ser un número entre 1 y 3650': '`days` must be a number between 1 and 3650',

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
  'No puedes quitarle la propiedad a quien creó la lista': 'You cannot take ownership away from the person who created the list',
  'La persona propietaria no puede salirse de la lista; primero elimínala o transfiérela':
    'The owner cannot leave the list; delete it or transfer it first',

  // Administración y utilidades
  'No puedes desactivar tu propia cuenta': 'You cannot disable your own account',
  'Esta utilidad está deshabilitada en producción': 'This tool is disabled in production',

  // Respuestas correctas con texto
  'Si el correo está registrado te enviamos un enlace para restablecer la contraseña.':
    'If the email is registered, we sent you a link to reset your password.',
  'La suscripción al boletín no está disponible': 'The newsletter is not available',
  'No se pudo completar la suscripción. Inténtalo más tarde.': 'The subscription could not be completed. Please try again later.',
};
