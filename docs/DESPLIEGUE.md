# Despliegue: desarrollo en local y producción en Coolify

Cómo corre el proyecto en tu máquina, qué llega exactamente al servidor de producción y todo lo necesario
(tokens, variables, DNS y Google) para publicarlo con **GitHub Actions + Coolify** en el VPS de
[`infra-ionos-vps`](../../infra-ionos-vps) (directorio hermano de este repositorio).

## 1. Dos entornos, dos compose

| | Desarrollo | Producción (Coolify) | Producción autoalojada (alternativa) |
|---|---|---|---|
| Archivo | `docker-compose.yml` | `compose.prod.yml` | `docker-compose.yml` + `docker-compose.prod.yml` |
| Quién compila | tu máquina (`npm run up`) | GitHub Actions → imágenes en GHCR | el propio servidor |
| TLS y dominio | ninguno (`http://localhost:8080`) | Traefik de Coolify | nginx con tus certificados |
| Entrada | `nginx` con `infra/nginx/conf.d` | `gateway` (imagen con la configuración dentro) | `nginx` con `infra/nginx/prod` |
| Mailpit, Swagger, seed | sí | **no** | no |
| Puertos en el host | 8080, 5432, 6379, 8025 (solo 127.0.0.1) | **ninguno** | 80 y 443 |
| Pruebas e2e | sí (`npm run test:e2e`) | no | no |

El entorno de desarrollo no cambia: `cp .env.example .env && npm run up`. `RUN_SEED=true` en ese `.env` carga los
datos de demostración que usan las pruebas.

## 2. Qué llega a producción (auditoría)

Se construyen cinco imágenes y **ninguna contiene código de pruebas, documentación, `.env`, mocks ni archivos
del repositorio**:

| Imagen | Contenido | Tamaño |
|---|---|---|
| `backend` | `dist/` compilado, dependencias de producción (`npm ci --omit=dev`), `tini`, usuario sin root | ≈ 447 MB |
| `frontend` | solo el bundle de Vite + nginx | ≈ 95 MB |
| `dashboard` | solo el bundle de Vite + nginx | ≈ 95 MB |
| `landing` | HTML/CSS/JS/fuentes estáticos + nginx | ≈ 93 MB |
| `gateway` | nginx con la configuración de rutas dentro (`infra/nginx/gateway`) | ≈ 93 MB |

Lo que se corrigió en esta revisión para que producción no arrastre cosas de desarrollo:

- **Seeds fuera de la imagen.** `dist/database/seeds` (usuarios y listas de demostración con contraseñas públicas)
  ya no se publica: el Dockerfile del backend acepta `KEEP_SEED=false` y `deploy.yml` lo usa. En desarrollo
  se conserva (`KEEP_SEED=true` por defecto). El import de los seeds ahora es dinámico, así que el backend no
  los necesita si `RUN_SEED` está apagado; además el arranque se niega a iniciar con `RUN_SEED=true` en producción.
- **Sin sourcemaps** (`*.map`) en ninguna imagen: `dist/` pasó de ≈ 1 MB a ≈ 0,5 MB.
- **Nada publicado en el host** y Postgres/Redis en una red interna (`compose.prod.yml`).
- **Endurecimiento:** `no-new-privileges`, `cap_drop: ALL`, límites de memoria y CPU, logs rotados.
- **Swagger desactivado** (`SWAGGER_ENABLED=false`) y `/api/docs` devuelve 404 en el gateway.
- **Mailpit** solo existe en desarrollo.

Lo que sigue dentro de la imagen del backend y es inevitable: `typescript` (24 MB) y `swagger-ui-dist` (11 MB)
llegan como dependencias de `@nestjs/swagger`. No se ejecutan si Swagger está apagado; quitarlos exigiría
eliminar la documentación OpenAPI del backend.

El backend además **se niega a arrancar** en producción con secretos de desarrollo, secretos de menos de 32
caracteres, `RUN_SEED` activo, CORS con `*` o sin contraseña de Redis (`apps/backend/src/config/env.validation.ts`).

## 3. Cómo se despliega

```
git push a main
  └─ .github/workflows/ci.yml       → impacto, tipos, build y pruebas e2e (no despliega)
  └─ .github/workflows/deploy.yml
        verificar  → tipos + build + "¿rompe a la app móvil?" (scripts/impact.mjs)
        publicar   → 5 imágenes a ghcr.io/yprevot/mytasklists.online-<servicio>:{main,<sha>}
        desplegar  → POST al webhook de Coolify → espera a que /version.json sirva el <sha>
```

Coolify recibe el aviso, descarga las imágenes `:main` y reinicia los servicios de `compose.prod.yml`. Cada
redespliegue corta el sitio aproximadamente un minuto (Coolify detiene y arranca los contenedores); el workflow lo
tolera y reintenta hasta 10 minutos. Las migraciones de base de datos corren solas al arrancar el backend
(`RUN_MIGRATIONS=true`) y deben ser compatibles con la versión anterior (ver `docs/COMPATIBILIDAD.md`).

`deploy.yml` no publica ni despliega hasta que exista la variable de repositorio `DEPLOY_ENABLED=true`:
puedes fusionar a `main` mientras terminas la configuración.

## 4. Lo que necesito de este lado (lista de verificación)

Marca cada punto; el detalle paso a paso está en las secciones 5 a 8.

**En GitHub** (`yprevot/mytasklists.online`; repositorio e imágenes de GHCR **privados**)
- [ ] Entorno `production` creado (Settings → Environments).
- [ ] Variable del entorno `production`: `SITE_URL`.
- [ ] Variables del **repositorio**: `LANDING_IOS_URL` y `LANDING_ANDROID_URL` (opcionales) y, al final, `DEPLOY_ENABLED=true`
      (deben ser del repositorio, no del entorno: GitHub no deja leer variables de entorno en los `if:` ni en la matriz).
- [ ] Secretos del entorno `production`: `COOLIFY_WEBHOOK` y `COOLIFY_TOKEN` (los puede escribir Ansible, sección 5.3).
- [ ] Token `github_token` de Ansible con acceso a este repositorio, incluida **Administration** (sección 5.1).
- [ ] Token clásico `ghcr_pull_token` (solo `read:packages`) para que el servidor descargue las imágenes (sección 5.2).
- [ ] Protección de `main`: exigir que pase el workflow **CI** antes de fusionar.

**En Coolify / infra** (`infra-ionos-vps`)
- [x] Ficha `clientes/mytasklists.yml` (rama `cliente/mytasklists` de infra, sección 6).
- [ ] Token de Coolify con permiso **solo `deploy`** (`coolify_deploy_token`, sección 5.3).
- [x] El rol `cliente` genera los secretos de esta app (sección 6.2).
- [ ] Subred de Traefik para `TRUSTED_PROXY_CIDR` (se mide tras el primer arranque, sección 6.3).
- [ ] Decisión: esta app sería el **primer cliente real en VPS1**, un camino que `docs/ALTA-CLIENTE.md` marca como sin probar.

**DNS y correo**
- [ ] Registros A (`@` y `www`) hacia VPS1 `74.208.151.61`, y los de correo que muestra el playbook (MX, SPF, DKIM, DMARC).
- [ ] Buzón `no-reply@<dominio>` de envío (lo crea el playbook): es el `SMTP_USER` de la app.

**Google**
- [ ] Proyecto, pantalla de consentimiento y cliente OAuth web (sección 7).
- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Coolify.
- [x] **Política de privacidad** (`/privacidad`, `/privacy`) y **condiciones del servicio** (`/terminos`, `/terms`),
      enlazadas desde la landing, la app web y la app móvil. El responsable sale de `LANDING_LEGAL_NAME`,
      `LANDING_LEGAL_ADDRESS` y `LANDING_PRIVACY_EMAIL` (variables opcionales del repositorio); sin ellas se usan
      `MyTaskListsOnline`, `Cuernavaca, Morelos, México` y `privacidad@mytasklists.online`.
- [ ] Buzón `privacidad@mytasklists.online` (o el de `LANDING_PRIVACY_EMAIL`): lo citan las dos páginas.
- [ ] Revisión de las dos páginas por un abogado.

## 5. Tokens, paso a paso

### 5.1 Token de GitHub para Ansible (`github_token`)

Sirve para que el playbook escriba los secretos y variables del entorno `production` en este repositorio y, como el
repositorio es privado, para registrar la *deploy key* con la que Coolify lo lee.

1. GitHub → tu foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**.
2. Si ya existe el token de `yunitztech.com`: ábrelo y pulsa **Edit**. Si no: **Generate new token**.
3. **Resource owner:** `yprevot`. **Expiration:** 90 días o 1 año (anótalo en el calendario de `OPERACION.md`).
4. **Repository access → Only select repositories:** marca `yprevot/yunitztech.com` **y** `yprevot/mytasklists.online`.
5. **Repository permissions:** **Actions** → *Read and write*; **Environments** → *Read and write*; **Administration** →
   *Read and write* (deploy key del repositorio privado); **Metadata** → *Read-only* (automático).
6. **Generate token** (o **Update**) y copia el valor (solo se muestra una vez).
7. Guárdalo en el vault de infra:
   ```bash
   cd ../infra-ionos-vps
   EDITOR=nano ansible-vault edit inventory/group_vars/all/vault.yml   # github_token: "github_pat_…"
   ```
8. Comprueba que ve el repositorio (debe responder `200`):
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer <token>" \
     https://api.github.com/repos/yprevot/mytasklists.online/environments
   ```

### 5.2 Imágenes privadas en GHCR (`ghcr_pull_token`)

El workflow publica con el `GITHUB_TOKEN` automático (permiso `packages: write`): no necesita token tuyo. Las imágenes
son **privadas**, así que el servidor tiene que autenticarse para descargarlas. El playbook hace `docker login ghcr.io`
en VPS1 con `ghcr_pull_token`. GHCR no acepta tokens *fine-grained*: tiene que ser uno clásico.

1. GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
2. **Note:** `ghcr-pull-vps1`. **Expiration:** la misma política que `github_token`.
3. **Scopes:** marca **solo** `read:packages`.
4. **Generate token**, cópialo y guárdalo en el vault de infra como `ghcr_pull_token`.
5. Tras la primera publicación, comprueba en GitHub → **Packages** que existen `mytasklists.online-backend`, `-frontend`,
   `-dashboard`, `-landing` y `-gateway`, vinculados al repositorio (el workflow los crea así).

Las imágenes no contienen secretos: toda la configuración entra por variables de Coolify al arrancar.

### 5.3 Tokens de Coolify

Necesitas dos, con permisos distintos:

| Token | Para qué | Permisos | Dónde se guarda |
|---|---|---|---|
| `coolify_api_token` | Ansible crea la app y carga variables | `read`, `write`, `deploy` | vault (ya existe) |
| `coolify_deploy_token` | GitHub Actions dispara el despliegue | **solo `deploy`** | vault + secreto `COOLIFY_TOKEN` del entorno `production` |

1. Entra en https://coolify.yunitztech.com.
2. **Settings → Advanced →** activa **API Access** (si no estaba).
3. **Keys & Tokens → API tokens → Create New Token:** nombre `github-deploy-mytasklists`, marca **solo** `deploy`.
4. Copia el token (solo se muestra una vez) y guárdalo en el vault como `coolify_deploy_token`.
5. Webhook: lo arma el playbook como
   `https://coolify.yunitztech.com/api/v1/deploy?uuid=<uuid-de-la-app>&force=false`. El `uuid` es el de la URL de la
   aplicación en Coolify. Es el valor del secreto `COOLIFY_WEBHOOK`.
6. Validación sin efectos (debe dar `404` al cancelar un despliegue inexistente y `403` al listar aplicaciones):
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer <token>" \
     https://coolify.yunitztech.com/api/v1/deployments/no-existe/cancel
   curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer <token>" \
     https://coolify.yunitztech.com/api/v1/applications
   ```

### 5.4 Entorno `production` en GitHub (a mano o con `gh`)

Si prefieres no esperar a Ansible, con `gh` ya autenticado:

```bash
gh api -X PUT repos/yprevot/mytasklists.online/environments/production     # crea el entorno
gh variable set SITE_URL -R yprevot/mytasklists.online -e production --body "https://mytasklists.online"
gh secret   set COOLIFY_WEBHOOK -R yprevot/mytasklists.online -e production   # pega la URL del webhook
gh secret   set COOLIFY_TOKEN   -R yprevot/mytasklists.online -e production   # pega el token solo-deploy
# variables del repositorio (sin -e). DEPLOY_ENABLED va al final, cuando Coolify ya tenga la app:
gh variable set LANDING_IOS_URL     -R yprevot/mytasklists.online --body "https://apps.apple.com/…"
gh variable set LANDING_ANDROID_URL -R yprevot/mytasklists.online --body "https://play.google.com/store/apps/details?id=online.mytasklists.app"
gh variable set DEPLOY_ENABLED      -R yprevot/mytasklists.online --body true
```

En **Settings → Branches → Add rule** para `main`: *Require status checks* → marca **Impacto y contrato**, **Tipos y build**
y **Pruebas e2e** (workflow CI).

## 6. Coolify e infra

### 6.1 Ficha del cliente (`infra-ionos-vps/clientes/mytasklists.yml`)

La ficha real está en la rama `cliente/mytasklists` de infra; esta sección resume lo que afecta a este repositorio:

- Modo `imagenes`: `/compose.prod.yml` de `main`, servicio `gateway` en el puerto 80, redirección `non-www`, servidor VPS1.
- `cliente_repo_privado: true`: Coolify lee el repositorio con una *deploy key* y VPS1 descarga de GHCR con `ghcr_pull_token`.
- `cliente_web_publicar: false` hasta que `compose.prod.yml` esté en `main` y los tres tokens estén en el vault.
- Variables propias: `IMAGE_PREFIX`, `IMAGE_TAG`, `SITE_URL`, `TRUSTED_PROXY_CIDR` (provisional, sección 6.3) y `MOBILE_MIN_VERSION`.
- El rol añade solo `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `LISTMONK_URL`,
  `LISTMONK_LIST_UUID`, `UMAMI_SCRIPT_URL` y `UMAMI_WEBSITE_ID`, con los valores de las fases de correo, Listmonk y analítica.
- Google y Apple (sección 7) y `/.well-known` (7.4) se añaden a la ficha cuando existan las credenciales.

### 6.2 Secretos de la app

El rol genera cada secreto que nombra `cliente_web_env_secretos` (32 caracteres alfanuméricos, distintos entre sí, en
`~/.ansible/secretos-clientes/mytasklists/`): `POSTGRES_PASSWORD` (`db`), `REDIS_PASSWORD` (`redis`),
`JWT_ACCESS_SECRET` (`jwt_access`), `JWT_REFRESH_SECRET` (`jwt_refresh`) y `APP_ENCRYPTION_KEY` (`app_key`). Cumplen
lo que exige el backend en producción (≥ 32 caracteres y distintos).

`GOOGLE_CLIENT_SECRET` es la excepción: lo entrega Google, no se genera. Cuando exista, crea antes
`~/.ansible/secretos-clientes/mytasklists/google_client_secret` con ese valor (sin espacios) y añade a la ficha
`GOOGLE_CLIENT_SECRET: google_client_secret` en `cliente_web_env_secretos` y `GOOGLE_CLIENT_ID` en `cliente_web_env`.

### 6.3 `TRUSTED_PROXY_CIDR` (tras el primer arranque)

El `gateway` necesita saber de qué red le llega el tráfico de Traefik para leer la IP real del cliente; sin ello el
rate limiting vería una sola IP para todos. Es el mismo procedimiento de `OPERACION.md` §4.3 (paso 4): medir la
subred de la red de la app en la que está Traefik, ponerla en la ficha, `--tags web` y redesplegar. Para el primer
arranque la ficha usa `10.0.0.0/8` (todas las redes de Docker que Coolify crea), que hay que acotar a la `/24` medida.

### 6.4 Orden de las fases

```bash
cd ../infra-ionos-vps
ansible-playbook playbooks/cliente-alta.yml -e cliente=mytasklists --check            # simulación
ansible-playbook playbooks/cliente-alta.yml -e cliente=mytasklists --tags correo,dns  # buzones + DNS (espera Enter)
ansible-playbook playbooks/cliente-alta.yml -e cliente=mytasklists --tags web         # app en Coolify, variables y GitHub
```

Después: ejecutar **Desplegar** en GitHub, medir `TRUSTED_PROXY_CIDR` (6.3) y volver a desplegar.

## 7. Inicio de sesión y registro con Google

El flujo ya está implementado y probado: el botón «Continuar con Google» aparece en **Iniciar sesión** y en
**Crear cuenta**, y una cuenta nueva se crea con el primer inicio (el correo llega verificado y el WhatsApp es
opcional; se completa luego en «Mi cuenta»). Si ya existía una cuenta con ese correo, Google solo se vincula cuando
confirma que el correo es suyo. Solo falta darlo de alta en Google.

### 7.1 Web (lo necesario para producción)

1. Entra en https://console.cloud.google.com con la cuenta que será la propietaria del proyecto.
2. Selector de proyectos → **Nuevo proyecto** → nombre `MyTaskLists`.
3. Menú → **APIs y servicios → Pantalla de consentimiento de OAuth** (en la interfaz nueva: **Google Auth Platform**).
   - **Branding / Información de la aplicación:** nombre `MyTaskLists`, correo de asistencia, logotipo (opcional).
   - **Dominios de la aplicación:** página principal `https://mytasklists.online`, **política de privacidad** y **condiciones del servicio**
     (las páginas de la sección 4, punto «Google»).
   - **Dominios autorizados:** `mytasklists.online`.
   - **Audiencia:** tipo **Externo**.
   - **Acceso a los datos (alcances):** `openid`, `…/auth/userinfo.email`, `…/auth/userinfo.profile`. Son alcances no sensibles:
     no requieren verificación de Google.
4. **Audiencia → Publicar aplicación** (estado «En producción»). Mientras esté en «Pruebas» solo entran los usuarios de
   prueba que añadas (máximo 100), y sus sesiones caducan a los 7 días.
5. Menú → **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - **Nombre:** `MyTaskLists web`.
   - **Orígenes autorizados de JavaScript:** `https://mytasklists.online` (y `http://localhost:8080` para desarrollo).
   - **URI de redireccionamiento autorizados:** `https://mytasklists.online/api/auth/google/callback` y
     `http://localhost:8080/api/auth/google/callback`. Deben coincidir **exactamente** (protocolo, dominio, ruta y sin `/` final).
6. Copia el **ID de cliente** y el **secreto de cliente**.

### 7.2 Variables

| Dónde | Variables |
|---|---|
| Producción (Coolify → variables de la app, o la ficha de Ansible) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. `GOOGLE_CALLBACK_URL` se deriva de `SITE_URL` en `compose.prod.yml` |
| Desarrollo (`.env`) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL=http://localhost:8080/api/auth/google/callback` |

Tras cambiar variables en Coolify, redespliega. Comprobación:

```bash
curl -s https://mytasklists.online/api/auth/providers     # {"google":true,"apple":false,"local":true}
```

Prueba manual: abre `https://mytasklists.online/app/login`, pulsa «Continuar con Google», elige una cuenta y debes volver a
`/app/` con la sesión iniciada. Errores típicos: `redirect_uri_mismatch` (la URI de 7.1 no coincide al carácter),
`access_denied` (la app sigue en «Pruebas» y la cuenta no es de prueba) o `google_fallido` en la app (mira los
registros del backend: «Google rechazó el intercambio de código»).

### 7.3 App móvil (iOS y Android)

La app móvil usa el inicio de sesión nativo de Google y envía un `id_token` que el backend valida contra los
`GOOGLE_ALLOWED_AUDIENCES`. Hace falta un ID de cliente por plataforma:

1. **iOS:** Credenciales → ID de cliente de OAuth → **iOS**, identificador de paquete `online.mytasklists.app`.
2. **Android:** ID de cliente de OAuth → **Android**, nombre de paquete `online.mytasklists.app` y la huella **SHA-1** del
   certificado de firma: la de EAS con `cd apps/mobile && npx eas credentials`, y **además** la de «firma de apps» de Google
   Play Console (Integridad de la app) una vez publicada.
3. Backend: `GOOGLE_ALLOWED_AUDIENCES=<id-ios>,<id-android>` (separados por coma, sin espacios).
4. App: variables de EAS `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` y
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (expo.dev → proyecto → Environment variables). Usar variables evita editar
   `app.json`, cuyo cambio altera la huella nativa y obliga a una compilación nueva.
5. Hay que revisar en la documentación de Expo si `expo-auth-session` exige además registrar en `app.json` el esquema
   inverso de cada ID de cliente (`com.googleusercontent.apps.<id>`); de ser así es un cambio nativo (compilación de tienda).
6. Se necesita un *development build* o el build de tienda: no funciona en Expo Go.

### 7.4 Asociación del dominio con la app (`/.well-known`)

El gateway publica `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json` cuando tienen valores
(si no, responde 404). Se configuran como variables de la app en Coolify, sin tocar código:

| Variable | Valor | Dónde se obtiene |
|---|---|---|
| `IOS_APP_ID` | `<TEAM_ID>.online.mytasklists.app` | developer.apple.com → Membership → Team ID |
| `ANDROID_PACKAGE` | `online.mytasklists.app` (por defecto) | `apps/mobile/app.json` |
| `ANDROID_CERT_FINGERPRINTS` | huellas SHA-256 separadas por comas | `npx eas credentials` y Play Console → Integridad de la app |

Hoy solo declaran **credenciales compartidas** (iOS y Android ofrecen la contraseña guardada del sitio en el login de la
app). En iOS lo completa `ios.associatedDomains: ["webcredentials:mytasklists.online"]`, ya incluido en `app.json`. Abrir enlaces del dominio dentro de la app (*applinks*) queda
fuera a propósito: la app todavía no tiene pantallas para las rutas web (`/app/reset-password`, `/app/verify-email`…) y
los enlaces de los correos dejarían de abrirse en el navegador.

### 7.5 CORS y apps nativas (comprobado)

`CORS_ORIGINS` solo admite `SITE_URL`, y eso no afecta a la app móvil: las peticiones nativas no envían `Origin`, y el
backend las acepta (REST y Socket.IO). Sin la cabecera `X-Auth-Client`, el login, el refresh y los inicios con Google y
Apple por `id_token` devuelven los tokens en el cuerpo, sin cookies. Comprobado contra la pila local:
login → `accessToken` y `refreshToken` en el cuerpo; refresh por cuerpo → 200; API con `Bearer` y sin `Origin` → 200;
Socket.IO sin `Origin` → 200; un origen ajeno no recibe cabeceras CORS.

### 7.6 Publicación de la app móvil (`mobile.yml`)

- GitHub solo necesita la variable de repositorio `EAS_ENABLED=true` y el secreto `EXPO_TOKEN` (expo.dev → Access tokens).
- Las credenciales de Apple (certificados, *provisioning*, clave de App Store Connect) y de Google Play (cuenta de servicio)
  **no van en GitHub**: las guarda EAS (`npx eas credentials`). El workflow compila con `--no-wait` y no envía a las tiendas;
  el envío se hace con `eas submit` cuando se configure `submit.production` en `eas.json`.
- Falta vincular el proyecto: `apps/mobile/app.json` tiene `projectId: 00000000-…`. Hay que ejecutar, con tu cuenta de Expo,
  `cd apps/mobile && npx eas init && npx eas update:configure` y hacer commit del resultado.
- Los ID de cliente de Google para la app van como variables del entorno `production` de EAS (`EXPO_PUBLIC_GOOGLE_*`);
  `eas update --environment production` las usa.

### 7.7 Analítica (Umami) y boletín (Listmonk)

Los dos los pone la plataforma de infra (`stats.yunitztech.com` y `news.mytasklists.online`); aquí solo se activan con
variables de Coolify. Sin valores no se carga nada de terceros ni se muestra el formulario.

| Variable | Servicio | Efecto |
|---|---|---|
| `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID` | `gateway` | Inserta el script de Umami en la landing y en la app web (no en el panel) y añade su origen a la CSP (`script-src` y `connect-src`). Umami no usa cookies |
| `LISTMONK_URL`, `LISTMONK_LIST_UUID` | `backend` | La landing muestra «Novedades, sin ruido» y el alta va por `POST /api/newsletter/subscribe` (limitada por IP); Listmonk envía el correo de confirmación |

El alta pasa por el backend y no directamente a Listmonk para no depender de su CORS y para que el rate limiting la
proteja. Comprobación tras configurarlo:

```bash
curl -s https://mytasklists.online/api/newsletter                           # {"enabled":true}
curl -s https://mytasklists.online/ | grep -o 'data-website-id="[^"]*"'    # el script de Umami
```

La política de privacidad debe mencionar la analítica (sin cookies) y el boletín (doble opt-in, baja en cada correo).

## 8. Puesta en marcha, en orden

1. Fusiona a `main` (no despliega: `DEPLOY_ENABLED` no existe todavía, así que `deploy.yml` solo verifica).
2. Tokens al vault de infra: `github_token` con Administration (5.1), `ghcr_pull_token` (5.2) y `coolify_deploy_token` (5.3).
3. Infra, en la rama `cliente/mytasklists`: `--check` y luego `--tags correo,dns`, `--tags listmonk` y `--tags analitica`.
4. `--tags web` con `cliente_web_publicar: false`: crea la app en Coolify, la deploy key y el `docker login` en GHCR, sin desplegar.
5. `cliente_web_publicar: true` y `--tags web` otra vez: el playbook crea el entorno `production` y guarda
   `COOLIFY_WEBHOOK`, `COOLIFY_TOKEN` y `SITE_URL`. **Solo entonces** pon `DEPLOY_ENABLED=true` (variable del repositorio, 5.4).
6. Ejecuta **Desplegar** (Actions → Desplegar → Run workflow, o `-e redeploy=true` en el playbook): publica las imágenes
   privadas y Coolify las descarga con `ghcr_pull_token` (5.2).
7. Mide `TRUSTED_PROXY_CIDR` (6.3), acótalo en la ficha, `--tags web` y vuelve a ejecutar **Desplegar**.
8. Verifica:
   ```bash
   curl -s https://mytasklists.online/version.json                       # {"revision":"<sha de main>"}
   curl -s -o /dev/null -w '%{http_code}\n' https://mytasklists.online/api/health   # 200
   curl -s -o /dev/null -w '%{http_code}\n' https://mytasklists.online/api/docs     # 404
   curl -s https://mytasklists.online/api/auth/providers
   curl -sI https://mytasklists.online/app/ | grep -i strict-transport
   ```
9. Registra una cuenta, confirma el correo (llega desde `no-reply@`), inicia sesión con Google y crea una lista.

**Volver atrás:** `IMAGE_TAG: <sha-anterior>` en `cliente_web_env`, `--tags web` y redesplegar (cada commit de `main` queda
publicado con su SHA). Un rollback de imagen no revierte la base de datos.

**Copias de seguridad:** el backup diario de infra vuelca cada contenedor PostgreSQL en marcha (este incluido) y lo sube
con restic. Redis solo guarda caché, sesiones y contadores: si se pierde, las personas tienen que volver a iniciar sesión.

## 9. Riesgos y pendientes

- **Primer cliente real en VPS1**: el camino `imagenes` solo se ha probado con `yunitztech.com` en VPS2.
- **Borrado de cuenta**: se hace desde «Mi cuenta → Eliminar cuenta» en la web, iOS y Android (`DELETE /users/me`), como
  pide App Store (guía 5.1.1(v)). En Google Play → Seguridad de los datos, la URL de borrado es
  `https://mytasklists.online/privacidad#eliminar`. Quien ya no puede entrar lo pide por correo (a mano, 30 días).
- **Revocación de Sign in with Apple** al borrar la cuenta: necesita `APPLE_PRIVATE_KEY`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`
  y `APPLE_BUNDLE_ID` (por defecto `online.mytasklists.app`). Sin ellos la cuenta se borra igual, pero sin revocar.
- **Dominio y registrador**: confirma el dominio y dónde está su DNS (`manual` o `hostinger`).
- **SMTP**: `mail.yunitztech.com` sirve a todos los clientes; el DMARC se sube a `reject` tras 2–4 semanas de informes limpios.
- **Identificadores móviles nuevos** (`online.mytasklists.app`, esquema `mytasklists`): la carpeta nativa generada
  `apps/mobile/ios` (no versionada) hay que regenerarla con `npx expo prebuild --clean` antes de compilar en local.
- Sin `REDIS_PASSWORD`, `JWT_*` o `APP_ENCRYPTION_KEY` el backend **no arranca** en producción: es intencional.
