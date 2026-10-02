import fs from 'node:fs';

const repository=process.env.GITHUB_REPOSITORY, sha=process.env.RELEASE_SHA;
if(!repository || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Revisión inválida');
const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`};
async function get(path) { const r=await fetch(`https://api.github.com/repos/${repository}/${path}`,{headers});
  if(!r.ok) throw new Error(`GitHub respondió ${r.status}`); return r.json(); }
const main=await get('commits/main');
if(main.sha!==sha) throw new Error('La revisión ya no es la punta de main; no se despliega');
const runs=await get(`actions/workflows/ci.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=20`);
const run=runs.workflow_runs.find(r=>r.head_sha===sha && r.status==='completed' && r.conclusion==='success');
if(!run) throw new Error('El SHA exacto no ha aprobado CI completo en main');
console.log(`CI aprobado: ${sha}, ejecución ${run.id}`);
if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`sha=${sha}\n`);
