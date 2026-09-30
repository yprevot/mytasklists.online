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

**En GitHub** (`yprevot/mytasklists.online`, repositorio público)
- [ ] Entorno `production` creado (Settings → Environments).
- [ ] Variable del entorno `production`: `SITE_URL`.
- [ ] Variables del **repositorio**: `LANDING_IOS_URL` y `LANDING_ANDROID_URL` (opcionales) y, al final, `DEPLOY_ENABLED=true`
      (deben ser del repositorio, no del entorno: GitHub no deja leer variables de entorno en los `if:` ni en la matriz).
- [ ] Secretos del entorno `production`: `COOLIFY_WEBHOOK` y `COOLIFY_TOKEN` (los puede escribir Ansible, sección 5.3).
- [ ] Token `github_token` de Ansible con acceso a este repositorio (sección 5.1).
- [ ] Paquetes de GHCR en **público** tras la primera publicación (sección 5.2).
- [ ] Protección de `main`: exigir que pase el workflow **CI** antes de fusionar.

**En Coolify / infra** (`infra-ionos-vps`)
- [ ] Ficha `clientes/mytasklists.yml` (sección 6) y dominio elegido.
- [ ] Token de Coolify con permiso **solo `deploy`** (`coolify_deploy_token`, sección 5.3).
- [ ] Ampliar el rol `cliente` con secretos propios de esta app (sección 6.2).
- [ ] Subred de Traefik para `TRUSTED_PROXY_CIDR` (se mide tras el primer arranque, sección 6.3).
- [ ] Decisión: esta app sería el **primer cliente real en VPS1**, un camino que `docs/ALTA-CLIENTE.md` marca como sin probar.

**DNS y correo**
- [ ] Registros A (`@` y `www`) hacia VPS1 `74.208.151.61`, y los de correo que muestra el playbook (MX, SPF, DKIM, DMARC).
- [ ] Buzón `no-reply@<dominio>` de envío (lo crea el playbook): es el `SMTP_USER` de la app.

**Google**
- [ ] Proyecto, pantalla de consentimiento y cliente OAuth web (sección 7).
- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Coolify.
- [ ] **Páginas de privacidad y de términos** publicadas en el dominio: Google las pide en la pantalla de
      consentimiento y hoy la landing **no las tiene**. Necesito los datos legales del responsable (nombre o razón
      social y domicilio) para redactarlas o tu texto ya revisado.

## 5. Tokens, paso a paso

### 5.1 Token de GitHub para Ansible (`github_token`)

Sirve para que el playbook escriba los secretos y variables del entorno `production` en este repositorio.

1. GitHub → tu foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**.
2. Si ya existe el token de `yunitztech.com`: ábrelo y pulsa **Edit**. Si no: **Generate new token**.
3. **Resource owner:** `yprevot`. **Expiration:** 90 días o 1 año (anótalo en el calendario de `OPERACION.md`).
4. **Repository access → Only select repositories:** marca `yprevot/yunitztech.com` **y** `yprevot/mytasklists.online`.
5. **Repository permissions:** **Actions** → *Read and write*; **Environments** → *Read and write*; **Metadata** → *Read-only* (automático).
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

### 5.2 Publicar en GHCR (no necesita token tuyo)

El workflow usa el `GITHUB_TOKEN` automático con permiso `packages: write`. Solo hay que hacer públicas las
imágenes (Coolify las descarga sin credenciales):

1. Ejecuta el workflow una vez (con `DEPLOY_ENABLED=true`). Crea los paquetes `mytasklists.online-backend`, `-frontend`,
   `-dashboard`, `-landing` y `-gateway`.
2. GitHub → tu perfil → **Packages** → abre cada paquete → **Package settings** → **Change package visibility** → **Public**.
3. En los mismos ajustes, **Manage Actions access** → añade el repositorio `mytasklists.online` con rol *Write*.

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
gh variable set LANDING_ANDROID_URL -R yprevot/mytasklists.online --body "https://play.google.com/store/apps/details?id=com.listadecompras.app"
gh variable set DEPLOY_ENABLED      -R yprevot/mytasklists.online --body true
```

En **Settings → Branches → Add rule** para `main`: *Require status checks* → marca **Impacto y contrato**, **Tipos y build**
y **Pruebas e2e** (workflow CI).

## 6. Coolify e infra

### 6.1 Ficha del cliente (`infra-ionos-vps/clientes/mytasklists.yml`)

Propuesta, en modo `imagenes` igual que `yunitztech.com`. Ajusta el dominio si será otro:

```yaml
cliente_id: mytasklists
cliente_nombre: "ListaDeCompras"
cliente_dominio: mytasklists.online
cliente_servidor: vps1            # producción de clientes
cliente_dns: manual               # o hostinger si el dominio está allí

cliente_repo: yprevot/mytasklists.online
cliente_rama: main
cliente_web_modo: imagenes
cliente_web_publicar: false       # true cuando las imágenes ya existan (sección 8)
cliente_compose: /compose.prod.yml
cliente_web_servicio: gateway     # el único servicio con dominio
cliente_web_puerto: 80
cliente_redirect: non-www

cliente_web_env:
  IMAGE_PREFIX: ghcr.io/yprevot/mytasklists.online
  IMAGE_TAG: main
  SITE_URL: https://mytasklists.online
  TRUSTED_PROXY_CIDR: SIMULADO    # subred de Traefik: sección 6.3
  SMTP_HOST: mail.yunitztech.com
  SMTP_PORT: "465"
  SMTP_SECURE: "true"
  SMTP_USER: no-reply@mytasklists.online
  MAIL_FROM: "ListaDeCompras <no-reply@mytasklists.online>"
  GOOGLE_CLIENT_ID: SIMULADO      # sección 7
  MOBILE_MIN_VERSION: 1.0.0
cliente_web_env_secretos:         # VARIABLE: nombre del secreto en ~/.ansible/secretos-clientes/mytasklists/
  POSTGRES_PASSWORD: db
  SMTP_PASSWORD: smtp_web
  REDIS_PASSWORD: redis
  JWT_ACCESS_SECRET: jwt_access
  JWT_REFRESH_SECRET: jwt_refresh
  APP_ENCRYPTION_KEY: app_key
  GOOGLE_CLIENT_SECRET: google_client_secret

cliente_buzones:                  # el playbook exige al menos uno
  - usuario: contacto
    alias: [info, privacidad]
    cuota_gb: 5
cliente_dmarc: none
cliente_listmonk: false           # esta app no usa newsletter
cliente_analitica: false          # ni Umami
```

### 6.2 Cambio necesario en el rol `cliente` (infra)

`roles/cliente/tasks/secretos.yml` genera una lista fija de secretos (`db`, `smtp_web`, `web_admin`…). Esta app necesita
además `redis`, `jwt_access`, `jwt_refresh` y `app_key` (todos de ≥ 32 caracteres, distintos entre sí) y
`google_client_secret`, que **no se genera**: lo entrega Google. Lo más limpio es una variable opcional
`cliente_secretos_extra` (por defecto `[]`) que se sume a esa lista:

```yaml
# roles/cliente/tasks/secretos.yml → en el loop
+ cliente_secretos_extra | default([])
# clientes/mytasklists.yml
cliente_secretos_extra: [redis, jwt_access, jwt_refresh, app_key, google_client_secret]
```

`lookup('password', archivo)` reutiliza el contenido si el archivo ya existe, así que para el secreto de Google basta
crear antes `~/.ansible/secretos-clientes/mytasklists/google_client_secret` con el valor que te da Google (sin espacios).
Sin ese cambio el playbook no puede poblar las variables de esta app.

### 6.3 `TRUSTED_PROXY_CIDR` (tras el primer arranque)

El `gateway` necesita saber de qué red le llega el tráfico de Traefik para leer la IP real del cliente; sin ello el
rate limiting vería una sola IP para todos. Es el mismo procedimiento de `OPERACION.md` §4.3 (paso 4): medir la
subred de la red de la app en la que está Traefik, ponerla en la ficha, `--tags web` y redesplegar. Mientras el valor
sea `SIMULADO`, el despliegue queda detenido a propósito.

### 6.4 Orden de las fases

```bash
cd ../infra-ionos-vps
ansible-playbook playbooks/cliente-alta.yml -e cliente=mytasklists --check            # simulación
ansible-playbook playbooks/cliente-alta.yml -e cliente=mytasklists --tags correo,dns  # buzones + DNS (espera Enter)
ansible-playbook playbooks/cliente-alta.yml -e cliente=mytasklists --tags web         # app en Coolify, variables y GitHub
```

Después: ejecutar **Desplegar** en GitHub (paquetes públicos, 5.2), medir `TRUSTED_PROXY_CIDR` (6.3) y volver a desplegar.

## 7. Inicio de sesión y registro con Google

El flujo ya está implementado y probado: el botón «Continuar con Google» aparece en **Iniciar sesión** y en
**Crear cuenta**, y una cuenta nueva se crea con el primer inicio (el correo llega verificado y el WhatsApp es
opcional; se completa luego en «Mi cuenta»). Si ya existía una cuenta con ese correo, Google solo se vincula cuando
confirma que el correo es suyo. Solo falta darlo de alta en Google.

### 7.1 Web (lo necesario para producción)

1. Entra en https://console.cloud.google.com con la cuenta que será la propietaria del proyecto.
2. Selector de proyectos → **Nuevo proyecto** → nombre `ListaDeCompras`.
3. Menú → **APIs y servicios → Pantalla de consentimiento de OAuth** (en la interfaz nueva: **Google Auth Platform**).
   - **Branding / Información de la aplicación:** nombre `ListaDeCompras`, correo de asistencia, logotipo (opcional).
   - **Dominios de la aplicación:** página principal `https://mytasklists.online`, **política de privacidad** y **condiciones del servicio**
     (las páginas de la sección 4, punto «Google»).
   - **Dominios autorizados:** `mytasklists.online`.
   - **Audiencia:** tipo **Externo**.
   - **Acceso a los datos (alcances):** `openid`, `…/auth/userinfo.email`, `…/auth/userinfo.profile`. Son alcances no sensibles:
     no requieren verificación de Google.
4. **Audiencia → Publicar aplicación** (estado «En producción»). Mientras esté en «Pruebas» solo entran los usuarios de
   prueba que añadas (máximo 100), y sus sesiones caducan a los 7 días.
5. Menú → **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - **Nombre:** `ListaDeCompras web`.
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

1. **iOS:** Credenciales → ID de cliente de OAuth → **iOS**, identificador de paquete `com.listadecompras.app`.
2. **Android:** ID de cliente de OAuth → **Android**, nombre de paquete `com.listadecompras.app` y la huella **SHA-1** del
   certificado de firma: la de EAS con `cd apps/mobile && npx eas credentials`, y **además** la de «firma de apps» de Google
   Play Console (Integridad de la app) una vez publicada.
3. Backend: `GOOGLE_ALLOWED_AUDIENCES=<id-ios>,<id-android>` (separados por coma, sin espacios).
4. App: variables de EAS `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` y
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (expo.dev → proyecto → Environment variables). Usar variables evita editar
   `app.json`, cuyo cambio altera la huella nativa y obliga a una compilación nueva.
5. Hay que revisar en la documentación de Expo si `expo-auth-session` exige además registrar en `app.json` el esquema
   inverso de cada ID de cliente (`com.googleusercontent.apps.<id>`); de ser así es un cambio nativo (compilación de tienda).
6. Se necesita un *development build* o el build de tienda: no funciona en Expo Go.

## 8. Puesta en marcha, en orden

1. Fusiona esta rama a `main` (todavía no despliega: falta `DEPLOY_ENABLED`).
2. Sección 5.1 (token de GitHub) y 5.3 (token de Coolify) → vault de infra.
3. Ficha (6.1) + cambio del rol (6.2). `--check` y luego `--tags correo,dns`.
4. Crea el secreto de Google (7.1 y 6.2) y `--tags web` con `cliente_web_publicar: false` (prepara Coolify sin desplegar).
5. Crea el entorno `production` y su configuración (5.4); al final pon `DEPLOY_ENABLED=true` (variable del repositorio).
6. Ejecuta **Desplegar** a mano (Actions → Desplegar → Run workflow). Publica las imágenes; haz los paquetes públicos (5.2).
7. Mide `TRUSTED_PROXY_CIDR` (6.3), actualiza la ficha, `--tags web` y vuelve a ejecutar **Desplegar**.
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
- **Páginas legales** inexistentes (necesarias para la pantalla de consentimiento de Google y para la tienda).
- **Dominio y registrador**: confirma el dominio y dónde está su DNS (`manual` o `hostinger`).
- **SMTP**: `mail.yunitztech.com` sirve a todos los clientes; el DMARC se sube a `reject` tras 2–4 semanas de informes limpios.
- **Splash y notificaciones de la app móvil** siguen en el azul anterior (`apps/mobile/app.json`); cambiarlos requiere build nativo.
- Sin `REDIS_PASSWORD`, `JWT_*` o `APP_ENCRYPTION_KEY` el backend **no arranca** en producción: es intencional.
