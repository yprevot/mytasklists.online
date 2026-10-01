import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '../components/AuthShell';
import { SocialButtons } from '../components/SocialButtons';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/endpoints';
export function RequestRegistrationPage() {
  const { t, i18n } = useTranslation(); const en = i18n.language.startsWith('en');
  const {user,loading} = useAuth();
  const [email,setEmail] = useState(''); const [sent,setSent] = useState(false);
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const [seconds,setSeconds] = useState(0);
  useEffect(() => { if (!seconds) return; const timer = setTimeout(()=>setSeconds(seconds-1),1000); return ()=>clearTimeout(timer); },[seconds]);
  if (user && !loading) return <Navigate to="/" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();setError('');setBusy(true);
    try { const r = await authApi.requestRegistration(email.trim().toLowerCase());setSent(true);setSeconds(r.cooldownSeconds); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <AuthShell><div data-testid="register-card"><h1>{en?'Create your account':'Crea tu cuenta'}</h1>
    <p>{en?'First, verify your email. Then enter your details.':'Primero valida tu correo. Después completarás tus datos.'}</p>
    <form onSubmit={submit} data-testid="register-form">
      <label className="form-label" htmlFor="register-email">{t('common.email')}</label>
      <input id="register-email" className="form-control mb-3" type="email" required maxLength={180} autoComplete="email" value={email}
        onChange={e=>{setEmail(e.target.value);setSent(false);}} data-testid="register-email" />
      {sent && <p className="alert alert-success" role="status" data-testid="registration-sent">{en?'If you can register with this email, you will receive a link to continue. If you already have an account, sign in or reset your password.':'Si puedes registrarte con este correo, recibirás un enlace para continuar. Si ya tienes cuenta, ingresa o recupera tu contraseña.'}</p>}
      {error && <p className="alert alert-danger" role="alert" data-testid="register-error">{error}</p>}
      <button className="btn btn-primary w-100" disabled={busy||seconds>0} data-testid="register-submit">{busy?(en?'Sending…':'Enviando…'):seconds?`${en?'Resend in':'Reenviar en'} ${seconds}s`:sent?(en?'Resend link':'Reenviar enlace'):(en?'Send registration link':'Enviar enlace de registro')}</button>
    </form>
    <p className="mt-3"><Link to="/login" data-testid="go-login">{en?'Sign in':'Ingresar'}</Link> · <Link to="/forgot-password">{en?'Reset password':'Recuperar contraseña'}</Link></p>
    <div className="lc-divider">{t('common.or')}</div><SocialButtons disabled={busy}/>
  </div></AuthShell>;
}
