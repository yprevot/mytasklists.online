#!/usr/bin/env python3
"""Forced SSH command: can only pin this application's IMAGE_TAG after successful CI.
Install root-owned as /usr/local/sbin/mytasklists-release on the Coolify control host.
The dedicated key cannot open a shell, forward ports, or alter other settings.
"""
import json
import os
import re
import subprocess
import urllib.request

command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
match = re.fullmatch(r'release ([a-f0-9]{40})', command)
if not match:
    raise SystemExit('Solo se permite fijar una revisión de producción')
sha = match.group(1)
repo = 'https://api.github.com/repos/yprevot/mytasklists.online/'

def get(path):
    request = urllib.request.Request(repo + path, headers={'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)

if get('commits/main')['sha'] != sha:
    raise SystemExit('El SHA no es la punta de main')
runs = get(f'actions/workflows/ci.yml/runs?head_sha={sha}&branch=main&event=push&per_page=20')['workflow_runs']
if not any(r['head_sha'] == sha and r['conclusion'] == 'success' for r in runs):
    raise SystemExit('CI completo no aprobado para esta revisión')
php = "$app=App\\Models\\Application::where('uuid','ii4owsgn8ihch3jdvh0q6af8')->firstOrFail();"
php += f"$env=$app->environment_variables()->where('key','IMAGE_TAG')->firstOrFail();$env->value='{sha}';$env->save();"
subprocess.run(['docker','exec','coolify','php','artisan','tinker','--execute='+php], check=True, stdout=subprocess.DEVNULL)
print('IMAGE_TAG fijado a ' + sha)
