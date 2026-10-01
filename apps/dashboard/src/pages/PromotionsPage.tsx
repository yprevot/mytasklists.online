import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
export function PromotionsPage(){
 const {i18n}=useTranslation();const en=i18n.language.startsWith('en');
 const [rows,setRows]=useState<{code:string;active:boolean}[]>([]);const [code,setCode]=useState('');const [kind,setKind]=useState('percent');
 const [value,setValue]=useState('20');const [months,setMonths]=useState('1');const [uses,setUses]=useState('100');const [expires,setExpires]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=async()=>{try{setRows(await api.get('/billing/admin/promotions'));}catch(e){setError((e as Error).message);}};
 useEffect(()=>{void load();},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api.post('/billing/admin/promotions',{code,months:Number(months),maxUses:Number(uses),...(kind==='percent'?{percent:Number(value)}:{amount:Math.round(Number(value)*100)}),...(expires?{expiresAt:new Date(expires).toISOString()}:{})});setCode('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div><h1>{en?'Promotional codes':'Códigos promocionales'}</h1><p>{en?'Create web and direct-download subscription discounts. Store offers are managed in their consoles.':'Crea descuentos para suscripciones web y de descarga directa. Las ofertas de tiendas se administran en sus consolas.'}</p>
  {error&&<p className="alert alert-danger" role="alert">{error}</p>}
  <form onSubmit={submit} className="row g-3 mb-4">
   <div className="col-md-4"><label htmlFor="campaign-code" className="form-label">{en?'Code':'Código'}</label><input id="campaign-code" className="form-control" value={code} onChange={e=>setCode(e.target.value)} required pattern="[A-Za-z0-9_-]{1,64}"/></div>
   <div className="col-md-4"><label htmlFor="campaign-type" className="form-label">{en?'Discount type':'Tipo de descuento'}</label><select id="campaign-type" className="form-select" value={kind} onChange={e=>setKind(e.target.value)}><option value="percent">%</option><option value="amount">USD</option></select></div>
   <div className="col-md-4"><label htmlFor="campaign-value" className="form-label">{en?'Discount':'Descuento'}</label><input id="campaign-value" className="form-control" type="number" min="0.01" max={kind==='percent'?100:5} step={kind==='percent'?1:0.01} value={value} onChange={e=>setValue(e.target.value)} required/></div>
   <div className="col-md-4"><label htmlFor="campaign-months" className="form-label">{en?'Discounted months':'Meses con descuento'}</label><input id="campaign-months" className="form-control" type="number" min="1" max="36" value={months} onChange={e=>setMonths(e.target.value)} required/></div>
   <div className="col-md-4"><label htmlFor="campaign-uses" className="form-label">{en?'Maximum redemptions':'Máximo de usos'}</label><input id="campaign-uses" className="form-control" type="number" min="1" max="100000" value={uses} onChange={e=>setUses(e.target.value)} required/></div>
   <div className="col-md-4"><label htmlFor="campaign-expiry" className="form-label">{en?'Expiry (optional)':'Vencimiento (opcional)'}</label><input id="campaign-expiry" className="form-control" type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/></div>
   <div><button className="btn btn-primary" disabled={busy}>{en?'Create promotion':'Crear promoción'}</button></div>
  </form><p>{en?'These campaigns apply to first-time subscribers. No automatic stacking.':'Estas campañas aplican a nuevos suscriptores. No se acumulan descuentos.'}</p>
  <table className="table"><thead><tr><th>{en?'Code':'Código'}</th><th>{en?'Status':'Estado'}</th><th>{en?'Action':'Acción'}</th></tr></thead><tbody>{rows.map(r=><tr key={r.code}><td>{r.code}</td><td>{r.active?(en?'Active':'Activo'):(en?'Inactive':'Inactivo')}</td><td>{r.active&&<button className="btn btn-outline-danger" disabled={busy} onClick={async()=>{setBusy(true);try{await api.patch(`/billing/admin/promotions/${encodeURIComponent(r.code)}/disable`,{});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{en?'Disable':'Desactivar'}</button>}</td></tr>)}</tbody></table>
 </div>;
}
