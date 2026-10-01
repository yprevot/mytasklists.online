import React, { useEffect, useState } from 'react';
import { ScrollView, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Field } from '../components/ui';
import { authApi, compatApi } from '../api/endpoints';
import { PrivacyLink, TermsLink } from '../components/PrivacyLink';
import { colors, spacing } from '../theme';
export function RegisterScreen({ navigation }: any) {
  const { i18n } = useTranslation();const en=i18n.language.startsWith('en');
  const [email,setEmail]=useState('');const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [seconds,setSeconds]=useState(0);
  useEffect(()=>{if(!seconds)return;const timer=setTimeout(()=>setSeconds(seconds-1),1000);return ()=>clearTimeout(timer);},[seconds]);
  async function submit(){setBusy(true);setError('');try{const compatibility=await compatApi.check();if((compatibility.registrationFlow||0)<2)throw new Error(en?'Email registration is not available on this server yet. Please try again later.':'El registro por correo todavía no está disponible en este servidor. Inténtalo más tarde.');const r=await authApi.requestRegistration(email.trim().toLowerCase());setSent(true);setSeconds(r.cooldownSeconds);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <ScrollView contentContainerStyle={{padding:spacing.xl,flexGrow:1,justifyContent:'center'}} testID="register-screen">
    <Text style={{fontSize:28,fontWeight:'800',color:colors.ink}}>{en?'Create your account':'Crea tu cuenta'}</Text>
    <Text style={{color:colors.inkSoft,marginVertical:spacing.lg}}>{en?'Verify your email first. Complete your details using the link in your browser, then sign in here.':'Primero valida tu correo. Completa tus datos con el enlace en tu navegador y después ingresa aquí.'}</Text>
    <Field label={en?'Email':'Correo electrónico'} value={email} onChangeText={v=>{setEmail(v);setSent(false);}} keyboardType="email-address" autoCapitalize="none" testID="register-email"/>
    {sent && <Text accessibilityLiveRegion="polite" testID="registration-sent" style={{color:colors.ink,marginBottom:spacing.lg}}>{en?'If you can register with this address, you will receive a link. Already have an account? Sign in or reset your password.':'Si puedes registrarte con este correo, recibirás un enlace. ¿Ya tienes cuenta? Ingresa o recupera tu contraseña.'}</Text>}
    {error && <Text accessibilityRole="alert" style={{color:colors.danger,marginBottom:spacing.md}} testID="register-error">{error}</Text>}
    <Button title={seconds?`${en?'Resend in':'Reenviar en'} ${seconds}s`:en?'Send link':'Enviar enlace'} onPress={submit} disabled={seconds>0||!email.trim()} loading={busy} testID="register-submit"/>
    <Pressable onPress={()=>navigation.goBack()} testID="go-login"><Text style={{color:colors.brand,padding:spacing.lg,textAlign:'center'}}>{en?'Sign in':'Ingresar'}</Text></Pressable>
    <PrivacyLink/><TermsLink/>
  </ScrollView>;
}
