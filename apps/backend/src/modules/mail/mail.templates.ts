/**
 * Plantillas de los correos transaccionales, en el idioma de cada persona. Cada una
 * devuelve asunto, texto plano y HTML sencillo (tablas + estilos en línea, lo que
 * mejor soportan los clientes de correo).
 */
import type { Locale } from '@lista/contracts';

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );

const LAYOUT = {
  es: {
    fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    footer: 'Si no fuiste tú, ignora este correo. MyTaskLists nunca te pedirá tu contraseña por correo.',
  },
  en: {
    fallback: 'If the button does not work, copy this link into your browser:',
    footer: 'If this was not you, ignore this email. MyTaskLists will never ask for your password by email.',
  },
} satisfies Record<Locale, unknown>;

const layout = (
  locale: Locale,
  title: string,
  body: string,
  action?: { label: string; url: string },
): string => `
<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
          <tr><td style="font-size:28px;text-align:center">🛒</td></tr>
          <tr><td style="font-size:20px;font-weight:bold;text-align:center;padding:8px 0 16px">${escape(title)}</td></tr>
          <tr><td style="font-size:15px;line-height:22px">${body}</td></tr>
          ${
            action
              ? `<tr><td align="center" style="padding:24px 0">
                   <a href="${escape(action.url)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;display:inline-block">${escape(action.label)}</a>
                 </td></tr>
                 <tr><td style="font-size:12px;color:#6b7280;word-break:break-all">${LAYOUT[locale].fallback}<br>${escape(action.url)}</td></tr>`
              : ''
          }
          <tr><td style="font-size:12px;color:#9ca3af;padding-top:24px">${LAYOUT[locale].footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export function verifyEmailTemplate(locale: Locale, name: string, url: string, hours: number): MailContent {
  if (locale === 'en') {
    return {
      subject: 'Confirm your email on MyTaskLists',
      text:
        `Hi ${name},\n\nConfirm your email by opening this link (it expires in ${hours} hours):\n${url}\n\n` +
        'If you did not create an account, ignore this message.',
      html: layout(
        locale,
        'Confirm your email',
        `<p>Hi ${escape(name)},</p><p>To finish signing up, confirm that this email is yours. The link expires in ${hours} hours.</p>`,
        { label: 'Confirm my email', url },
      ),
    };
  }
  return {
    subject: 'Confirma tu correo en MyTaskLists',
    text:
      `Hola ${name}:\n\nConfirma tu correo abriendo este enlace (vence en ${hours} horas):\n${url}\n\n` +
      'Si no creaste una cuenta, ignora este mensaje.',
    html: layout(
      locale,
      'Confirma tu correo',
      `<p>Hola ${escape(name)}:</p><p>Para terminar tu registro confirma que este correo es tuyo. El enlace vence en ${hours} horas.</p>`,
      { label: 'Confirmar mi correo', url },
    ),
  };
}

export function resetPasswordTemplate(locale: Locale, name: string, url: string, minutes: number): MailContent {
  if (locale === 'en') {
    return {
      subject: 'Reset your MyTaskLists password',
      text:
        `Hi ${name},\n\nWe received a request to change your password. Open this link (it expires in ${minutes} minutes):\n${url}\n\n` +
        'If you did not ask for it, ignore this email: your current password still works.',
      html: layout(
        locale,
        'Reset your password',
        `<p>Hi ${escape(name)},</p><p>We received a request to change your password. The link expires in ${minutes} minutes and can only be used once.</p><p>If you did not ask for it, ignore this email: your current password still works.</p>`,
        { label: 'Choose a new password', url },
      ),
    };
  }
  return {
    subject: 'Restablece tu contraseña de MyTaskLists',
    text:
      `Hola ${name}:\n\nRecibimos una solicitud para cambiar tu contraseña. Abre este enlace (vence en ${minutes} minutos):\n${url}\n\n` +
      'Si no la pediste tú, ignora este correo: tu contraseña actual sigue funcionando.',
    html: layout(
      locale,
      'Restablece tu contraseña',
      `<p>Hola ${escape(name)}:</p><p>Recibimos una solicitud para cambiar tu contraseña. El enlace vence en ${minutes} minutos y solo se puede usar una vez.</p><p>Si no la pediste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>`,
      { label: 'Elegir una contraseña nueva', url },
    ),
  };
}

export function passwordChangedTemplate(locale: Locale, name: string, loginUrl: string): MailContent {
  if (locale === 'en') {
    return {
      subject: 'Your MyTaskLists password changed',
      text:
        `Hi ${name},\n\nYour password was just changed and we signed you out of every session.\n` +
        `If this was not you, recover your account at ${loginUrl}`,
      html: layout(
        locale,
        'Your password changed',
        `<p>Hi ${escape(name)},</p><p>Your password was just changed and we signed you out of every session.</p><p>If this was not you, recover your account right away.</p>`,
        { label: 'Go to MyTaskLists', url: loginUrl },
      ),
    };
  }
  return {
    subject: 'Tu contraseña de MyTaskLists cambió',
    text:
      `Hola ${name}:\n\nTu contraseña se acaba de cambiar y cerramos todas tus sesiones abiertas.\n` +
      `Si no fuiste tú, recupera tu cuenta desde ${loginUrl}`,
    html: layout(
      locale,
      'Tu contraseña cambio',
      `<p>Hola ${escape(name)}:</p><p>Tu contraseña se acaba de cambiar y cerramos todas tus sesiones abiertas.</p><p>Si no fuiste tú, recupera tu cuenta de inmediato.</p>`,
      { label: 'Ir a MyTaskLists', url: loginUrl },
    ),
  };
}

export function mfaChangedTemplate(locale: Locale, name: string, enabled: boolean): MailContent {
  if (locale === 'en') {
    const state = enabled ? 'turned on' : 'turned off';
    return {
      subject: `Two-step verification was ${state}`,
      text: `Hi ${name},\n\nTwo-step verification was ${state} for your account. If this was not you, change your password.`,
      html: layout(
        locale,
        `Two-step verification: ${enabled ? 'on' : 'off'}`,
        `<p>Hi ${escape(name)},</p><p>Two-step verification was ${state} for your account. If this was not you, change your password right away.</p>`,
      ),
    };
  }
  const state = enabled ? 'activo' : 'desactivo';
  return {
    subject: `Se ${state} la verificación en dos pasos`,
    text: `Hola ${name}:\n\nSe ${state} la verificación en dos pasos de tu cuenta. Si no fuiste tú, cambia tu contraseña.`,
    html: layout(
      locale,
      `Verificación en dos pasos: ${enabled ? 'activada' : 'desactivada'}`,
      `<p>Hola ${escape(name)}:</p><p>Se ${state} la verificación en dos pasos de tu cuenta. Si no fuiste tú, cambia tu contraseña de inmediato.</p>`,
    ),
  };
}

export function socialLinkedTemplate(locale: Locale, name: string, provider: string, resetUrl: string): MailContent {
  if (locale === 'en') {
    return {
      subject: `We linked your ${provider} account`,
      text:
        `Hi ${name},\n\nYou signed in with ${provider} and we linked it to your account. Since your email had never ` +
        'been confirmed, we disabled the previous password and signed you out of every session.\n' +
        `If you want to sign in with a password again, create a new one here: ${resetUrl}`,
      html: layout(
        locale,
        `We linked your ${provider} account`,
        `<p>Hi ${escape(name)},</p><p>You signed in with ${escape(provider)} and we linked it to your account.</p><p>Since your email had never been confirmed, for your security we disabled the previous password and signed you out of every session. If you want to sign in with a password again, create a new one.</p>`,
        { label: 'Create a password', url: resetUrl },
      ),
    };
  }
  return {
    subject: `Vinculamos tu cuenta de ${provider}`,
    text:
      `Hola ${name}:\n\nIniciaste sesión con ${provider} y lo vinculamos a tu cuenta. Como tu correo nunca se ` +
      'había confirmado, desactivamos la contraseña anterior y cerramos las sesiones abiertas.\n' +
      `Si quieres volver a entrar con contraseña, crea una nueva aquí: ${resetUrl}`,
    html: layout(
      locale,
      `Vinculamos tu cuenta de ${provider}`,
      `<p>Hola ${escape(name)}:</p><p>Iniciaste sesión con ${escape(provider)} y lo vinculamos a tu cuenta.</p><p>Como tu correo nunca se había confirmado, por seguridad desactivamos la contraseña anterior y cerramos las sesiones abiertas. Si quieres volver a entrar con contraseña, crea una nueva.</p>`,
      { label: 'Crear una contraseña', url: resetUrl },
    ),
  };
}

export function accountDeletedTemplate(locale: Locale, name: string): MailContent {
  if (locale === 'en') {
    return {
      subject: 'Your MyTaskLists account was deleted',
      text:
        `Hi ${name},\n\nYour MyTaskLists account and its data were deleted, and we signed you out of every device.\n` +
        `The lists you created were deleted for everyone you shared them with. Thanks for having used MyTaskLists.`,
      html: layout(
        locale,
        'Your account was deleted',
        `<p>Hi ${escape(name)},</p><p>Your MyTaskLists account and its data were deleted, and we signed you out of every device.</p><p>The lists you created were deleted for everyone you shared them with. Thanks for having used MyTaskLists.</p>`,
      ),
    };
  }
  return {
    subject: 'Eliminamos tu cuenta de MyTaskLists',
    text:
      `Hola ${name}:\n\nEliminamos tu cuenta de MyTaskLists y sus datos, y cerramos tu sesión en todos los dispositivos.\n` +
      `Las listas que creaste se eliminaron también para quienes las compartían contigo. Gracias por haber usado MyTaskLists.`,
    html: layout(
      locale,
      'Eliminamos tu cuenta',
      `<p>Hola ${escape(name)}:</p><p>Eliminamos tu cuenta de MyTaskLists y sus datos, y cerramos tu sesión en todos los dispositivos.</p><p>Las listas que creaste se eliminaron también para quienes las compartían contigo. Gracias por haber usado MyTaskLists.</p>`,
    ),
  };
}
