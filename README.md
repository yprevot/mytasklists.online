# ListaDeCompras

Sistema de **listas de compras compartidas con productos recurrentes** y sincronizacion en
tiempo real. Monorepo con todos los servicios dockerizados, mas una app movil para iOS y
Android hecha en React Native.

La idea central: hay productos que compras **una vez** y productos que compras **siempre**.
Si agregas "Pan de caja" con recurrencia de 14 dias y lo marcas como comprado un viernes, el
producto vuelve solo a tu lista 14 dias despues de ese viernes. Si se te pasa comprarlo, se
queda en la lista pero cambia de color.

---

## Arquitectura

```
                       ┌──────────────────────────────┐
   navegador  ────────▶│  nginx  ·  proxy web  :8080  │
   app movil  ────────▶└──────────────┬───────────────┘
                                      │
        ┌───────────────┬─────────────┼─────────────┬────────────────┐
        │               │             │             │                │
        ▼               ▼             ▼             ▼                ▼
   /  landing      /app/ frontend  /dashboard/   /api/  backend   /socket.io/
   (estatico)      React + Vite    React + Vite  NestJS +         WebSocket
                   + Bootstrap     + Bootstrap   Fastify          (Socket.IO)
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                                   PostgreSQL 18            Redis 8
                                   (datos)                  (cache + pub/sub + rate limit)
```

| Servicio    | Tecnologia                                  | Ruta publica   |
| ----------- | ------------------------------------------- | -------------- |
| `nginx`     | nginx 1.30 (proxy inverso, WebSocket, gzip, cabeceras de seguridad) | `:8080` |
| `landing`   | HTML/CSS estatico + nginx                   | `/`            |
| `frontend`  | React 19 + TypeScript 7 + Vite 8 + Bootstrap 5 | `/app/`     |
| `dashboard` | React 19 + TypeScript 7 + Vite 8 + Bootstrap 5 | `/dashboard/` |
| `backend`   | NestJS 12 sobre Fastify + TypeORM 1 (Node 24, TypeScript 6) | `/api/` |
| `postgres`  | PostgreSQL 18                               | `127.0.0.1:5432` |
| `redis`     | Redis 8 (con contrasena)                    | `127.0.0.1:6379` |
| `mailpit`   | Mailpit (SMTP de desarrollo)                | `127.0.0.1:8025` |
| App movil   | React Native 0.86 (Expo SDK 57) — iOS y Android | tiendas     |

---

## Arranque rapido

Requisitos: Docker Engine 29+ con Compose v2.24+ (probado con Compose v5.5) y Node 24 LTS
(minimo 22.12; solo para la app movil y las pruebas). El repositorio incluye `.nvmrc`.

> El backend usa TypeScript 6 porque NestJS 12 (`@nestjs/cli`, `@nestjs/swagger`) todavia no
> soporta TypeScript 7; la app movil usa la version que fija Expo SDK 57. El resto usa TS 7.

```bash
cp .env.example .env
docker compose up -d --build
```

Cuando los ocho contenedores esten `healthy`:

| Que                       | Donde                                |
| ------------------------- | ------------------------------------ |
| Landing / descargas       | http://localhost:8080/               |
| Aplicacion web            | http://localhost:8080/app/           |
| Panel de administracion   | http://localhost:8080/dashboard/     |
| API                       | http://localhost:8080/api/health     |
| Documentacion OpenAPI     | http://localhost:8080/api/docs       |
| Correos enviados (Mailpit)| http://localhost:8025/               |

### Cuentas de demostracion

El backend siembra datos de ejemplo al arrancar cuando `RUN_SEED=true`. El `.env.example` lo
activa para desarrollo y pruebas; el `docker-compose.yml` lo deja apagado por defecto y en
produccion el backend se niega a ejecutarlo (son contrasenas publicas):

| Cuenta                     | Contrasena   | Rol   |
| -------------------------- | ------------ | ----- |
| `ana@example.com`          | `Demo12345`  | user  |
| `carlos@example.com`       | `Demo12345`  | user  |
| `admin@listadecompras.mx`  | `Admin12345` | admin |

Ana y Carlos comparten la lista **Despensa quincenal**, que ya trae un producto recurrente al
dia, uno vencido, uno puntual y uno comprado. Inicia sesion con ambos en dos navegadores para
ver la sincronizacion en vivo.

---

## Como funciona la recurrencia

Cada producto tiene tres fechas:

- `activated_at` — cuando entro (o volvio a entrar) a la lista de pendientes.
- `due_at` — `activated_at + recurrencia`. Pasada esa fecha sin comprarse, se marca **vencido**.
- `next_activation_at` — `fecha de compra + recurrencia`. Cuando llega, el producto vuelve solo.

```
 Lunes                Viernes                            +14 dias
   │                     │                                  │
   ▼                     ▼                                  ▼
 se agrega ───────▶ se marca comprado ──────────────▶ vuelve a "Por comprar"
 recurrencia 14 d   (baja tachado)                    (ciclo 2, nuevo plazo)
   │
   └── si el viernes NO se compra y pasan los 14 dias, el producto sigue en la
       lista pero se pinta de rojo: "vencido hace N dias"
```

Un `@Cron` configurable (`RECURRENCE_CRON`, por omision cada 5 minutos) recorre los productos
vencidos y los que toca reactivar, emite los eventos por WebSocket y manda los avisos.

Para probarlo sin esperar dias reales, la interfaz incluye **"Simular paso del tiempo"** en el
menu de reloj de cada producto recurrente (`POST /api/recurrence/items/:id/advance`).

### Estados de un producto

| Estado en la interfaz         | Color del borde | Significado                                      |
| ----------------------------- | --------------- | ------------------------------------------------ |
| Puntual, pendiente            | gris            | Se agrego una sola vez                            |
| Recurrente, dentro de plazo   | azul            | Volvera solo cuando se compre                     |
| Recurrente **vencido**        | rojo + fondo    | Se paso su plazo y sigue sin comprarse            |
| Comprado                      | verde, tachado  | Baja a la lista de abajo; se cierra con la **x**  |

Cerrar un producto recurrente con la "x" **no** cancela su recurrencia: solo lo quita de la
vista hasta que vuelva a tocar. Para cancelarla hay que eliminar el producto (bote de basura).

---

## Listas compartidas y avisos

- Una lista se comparte por correo con cualquier persona ya registrada.
- Todos los integrantes entran a la sala `list:<id>` de Socket.IO: cualquier alta, compra o
  borrado se refleja al instante en el resto de dispositivos.
- Cada integrante decide **por lista** si quiere recibir avisos (`Avisarme`), y ademas tiene un
  interruptor global en su cuenta.
- El aviso se entrega como **pop-up** en la web y como **notificacion push** (Expo → APNs/FCM)
  en iOS y Android. Quien hace el cambio nunca se auto-notifica.

---

## App movil (iOS y Android)

```bash
cd apps/mobile
npm install
npm start          # abre Expo: pulsa i (iOS) o a (Android)
npm run web        # misma app en el navegador (lo que usan las pruebas)
```

Apunta la app al backend con `apps/mobile/app.json` → `expo.extra.apiUrl`, o con variables:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:8080/api \
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.50:8080 npm start
```

Compilaciones para las tiendas con EAS (`eas.json` ya incluido):

```bash
npx eas build --platform ios       # App Store
npx eas build --platform android   # Google Play
```

Los cambios solo de JavaScript se publican sin pasar por la tienda con EAS Update (OTA); el
workflow `mobile.yml` elige el camino. Sube `version` en `app.json` en cada publicacion: la API
puede exigir una version minima (`MOBILE_MIN_VERSION`) y las apps anteriores piden actualizar.
Ver [`docs/COMPATIBILIDAD.md`](docs/COMPATIBILIDAD.md).

Los enlaces de descarga de la landing se configuran con `LANDING_IOS_URL` y
`LANDING_ANDROID_URL` en el `.env`.

### Notificaciones push

La app registra su token de Expo en `POST /api/notifications/devices` al iniciar sesion. El
backend las envia con `expo-server-sdk`. Define `EXPO_ACCESS_TOKEN` si tu proyecto de Expo lo
exige; sin el, la app sigue funcionando y los avisos llegan por WebSocket.

---

## Registro e inicio de sesion

### Con correo y contrasena

- **Registro** (`POST /api/auth/register`): nombre, correo, WhatsApp y contrasena (8-128
  caracteres, bcrypt con 12 rondas). Entra directo y recibe un **correo de verificacion**; hasta
  confirmarlo la app muestra un aviso con "Reenviar enlace".
- **Recuperar contrasena**: "¿Olvidaste tu contrasena?" en la web y en la app movil. El enlace
  del correo es de un solo uso, vence en 60 minutos y, al usarse, **cierra todas las sesiones**.
  La respuesta es la misma exista o no el correo.
- **Verificacion en dos pasos (TOTP)** opcional: se activa desde el panel (seccion
  *Seguridad*, con QR y 8 codigos de recuperacion) o por API. El login responde
  `{ mfaRequired, mfaToken }` y se completa en `POST /api/auth/mfa/verify`. Un administrador puede
  quitar el 2FA de otra cuenta si perdio el telefono.

Los correos salen por SMTP. En desarrollo el compose trae **Mailpit**, que los captura todos
en http://localhost:8025. En produccion sirve cualquier proveedor SMTP (Amazon SES, Resend,
Postmark, SendGrid…):

```dotenv
SMTP_HOST=smtp.proveedor.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM=ListaDeCompras <no-responder@tudominio.com>
```

Configura SPF, DKIM y DMARC en tu dominio (tu proveedor te da los registros DNS) o los correos
acabaran en spam.

### Con Google (Gmail)

El flujo web y el nativo estan implementados (OIDC directo con PKCE, `state` y `nonce`,
verificando el `id_token` contra los JWKS de Google). Se activan en cuanto hay credenciales:

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto y configura
   la **pantalla de consentimiento OAuth** (tipo *Externo*, alcances `openid`, `email` y
   `profile`, dominio, politica de privacidad). Mientras este en modo *Testing* solo entran los
   usuarios de prueba: publicala para abrirla a todos.
2. En **Credenciales → Crear ID de cliente OAuth → Aplicacion web** agrega la URI de
   redireccion `https://TU_DOMINIO/api/auth/google/callback` (y
   `http://localhost:8080/api/auth/google/callback` para desarrollo).
3. Para la app movil crea tambien un ID de cliente **iOS** (bundle `com.listadecompras.app`) y
   uno **Android** (paquete `com.listadecompras.app` + huella SHA-1 del keystore:
   `npx eas credentials`).
4. Variables:

```dotenv
# backend (.env)
GOOGLE_CLIENT_ID=xxxx-web.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://TU_DOMINIO/api/auth/google/callback
GOOGLE_ALLOWED_AUDIENCES=xxxx-ios.apps.googleusercontent.com,xxxx-android.apps.googleusercontent.com
```

```json
// apps/mobile/app.json → expo.extra (o EXPO_PUBLIC_GOOGLE_*_CLIENT_ID)
"googleIosClientId": "xxxx-ios.apps.googleusercontent.com",
"googleAndroidClientId": "xxxx-android.apps.googleusercontent.com",
"googleWebClientId": "xxxx-web.apps.googleusercontent.com"
```

El boton nativo necesita un *development build* (`npx expo run:ios` / `eas build`), no Expo Go.
Sin client id para la plataforma, la app ofrece el flujo web del backend.

Si ya existia una cuenta con el mismo correo, Google solo se vincula cuando confirma que el
correo es suyo (`email_verified`). Si esa cuenta tenia una contrasena nunca verificada se
desactiva (pudo ponerla otra persona) y se avisa por correo para crear una nueva. Las cuentas
vinculadas viven en `user_identities`, identificadas por el `sub` del proveedor.

### Con Apple

```dotenv
APPLE_CLIENT_ID=com.listadecompras.app.service
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=YYYYYYYYYY
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_CALLBACK_URL=https://TU_DOMINIO/api/auth/apple/callback
APPLE_ALLOWED_AUDIENCES=com.listadecompras.app
```

`GET /api/auth/providers` indica que proveedores estan disponibles y la interfaz muestra u
oculta los botones en consecuencia. La app movil usa los endpoints nativos
`POST /api/auth/google/token` y `POST /api/auth/apple/token`.

---

## Seguridad

| Medida | Donde |
| --- | --- |
| Refresh token en cookie `httpOnly` + `SameSite=Strict` (web y panel); access token solo en memoria | `auth-cookie.service.ts`, `api/client.ts` |
| Tokens en Keychain/Keystore en la app movil (`expo-secure-store`) | `apps/mobile/src/api/secureStorage.ts` |
| Rotacion de refresh token y revocacion inmediata de access tokens (version de sesion en Redis) al cambiar la contrasena, recuperarla o desactivar la cuenta | `token.service.ts`, `auth-state.service.ts` |
| Rate limiting por IP en Redis (global, login/registro y correos) + bloqueo temporal tras 10 intentos fallidos por correo | `common/throttle/`, `auth.service.ts` |
| Mensajes de error y tiempos iguales exista o no la cuenta | `auth.service.ts` |
| Vinculacion social solo con correo verificado por el proveedor; sin URLs de retorno arbitrarias | `users.service.ts`, `oauth.service.ts` |
| Verificacion en dos pasos (TOTP) con codigos de recuperacion; secreto cifrado con AES-256-GCM | `mfa.service.ts`, `totp.ts` |
| Cabeceras de seguridad: CSP, `X-Frame-Options`, `nosniff`, HSTS (helmet en la API, nginx en las paginas) | `main.ts`, `infra/nginx/snippets/` |
| Busqueda de personas solo por correo exacto y sin WhatsApp | `users.service.ts` |
| El backend no arranca en produccion con secretos de desarrollo, sin contrasena de Redis, con `RUN_SEED` o con CORS `*` | `config/env.validation.ts` |
| Postgres y Redis solo en `127.0.0.1` (y sin publicar en produccion) | `docker-compose*.yml` |
| Builds reproducibles con `npm ci` y el lockfile del monorepo; contenedor del backend sin root | `apps/*/Dockerfile` |

---

## Compatibilidad y despliegues independientes

La app movil vive en este repositorio pero se publica aparte, y las versiones de las tiendas
conviven con el backend durante semanas. Tres piezas lo mantienen bajo control:

- **`packages/contracts`**: las formas de la API se declaran una vez; backend, web, panel y app
  las importan, y un cambio incompatible falla al compilar en todos.
- **`npm run impact`**: dice que se despliega (servicios, OTA o tienda) y que tan seguro es.
  `npm run contract:check` bloquea en CI lo que romperia a las apps publicadas.
- **Version minima**: la app manda `X-App-Version`; por debajo de `MOBILE_MIN_VERSION` la API
  responde 426 y la app pide actualizar.

El semaforo de que se puede cambiar sin miedo y el procedimiento para cambios incompatibles
estan en [`docs/COMPATIBILIDAD.md`](docs/COMPATIBILIDAD.md).

---

## Despliegue en produccion

```bash
# 1. Secretos (cada uno distinto)
openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, APP_ENCRYPTION_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD, REDIS_PASSWORD

# 2. En el .env del servidor: NODE_ENV=production, RUN_SEED=false, PUBLIC_URL=https://tu-dominio,
#    CORS_ORIGINS=https://tu-dominio, SMTP_* y las credenciales de Google/Apple.

# 3. Certificado TLS (Let's Encrypt). Con la pila parada:
sudo certbot certonly --standalone -d tu-dominio
sudo cp /etc/letsencrypt/live/tu-dominio/{fullchain,privkey}.pem infra/nginx/certs/
#    Cambia `server_name` en infra/nginx/prod/default.conf por tu dominio.
#    Renovaciones sin parar: `certbot renew --webroot -w infra/nginx/acme`.

# 4. Arranque
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` activa HTTPS con HSTS y limites por IP en `/api/auth/`, deja de
publicar Postgres y Redis, desactiva Mailpit, Swagger y la utilidad de "simular paso del tiempo",
y obliga a definir `SMTP_HOST`. Si hay otro balanceador delante de nginx, ajusta `TRUST_PROXY`
al numero de saltos.

### Actualizar PostgreSQL 16 → 18

La imagen de PostgreSQL 18 guarda los datos en otra ruta (`/var/lib/postgresql/18/docker`) y
no puede abrir un directorio de la 16, asi que el compose usa un volumen nuevo
(`postgres18-data`) y el viejo (`postgres-data`) queda intacto. Para copiar los datos:

```bash
sh infra/postgres/upgrade-16-to-18.sh
```

El script vuelca la base con un PostgreSQL 16 temporal, la restaura en la 18 y deja el volcado
como respaldo. Cuando compruebes que todo esta bien: `docker volume rm listadecompras_postgres-data`.

---

## Pruebas end-to-end con Playwright

**150 casos** repartidos en cinco proyectos, uno por servicio mas la app movil.
Todos los casos con interfaz **graban un video de evidencia**. Los de correo leen la bandeja
de Mailpit (`E2E_MAILPIT_URL`, por defecto http://localhost:8025).

```bash
docker compose up -d --build     # la pila tiene que estar arriba

# una sola vez: dependencias y navegador de Playwright
npm --prefix e2e install
npm --prefix e2e run install:browsers

# desde la raiz del repositorio
npm run test:e2e                 # los 5 proyectos (150 casos)
npm run test:e2e:backend         # solo la API
npm run test:e2e:frontend        # solo la app web
npm run test:e2e:dashboard       # solo el panel
npm run test:e2e:landing         # solo la landing
npm run test:e2e:mobile          # levanta el build web de React Native
npm run test:e2e:report          # informe HTML
npm run evidence                 # imprime el indice de videos
```

Cada ejecucion regenera la carpeta de evidencia, organizada por servicio y por caso:

```
e2e/evidence/
├── INDICE.md                                   ← tabla con todos los casos
├── frontend/CP-WEB-020-agregar-pan-de-caja-con-recurrencia-de-14-dias.webm
├── frontend/CP-WEB-028-...-ventana1.webm       ← pruebas con dos personas:
├── frontend/CP-WEB-028-...-ventana2.webm         un video por ventana
├── dashboard/CP-DASH-005-...webm
├── landing/CP-LAND-001-...webm
└── mobile-app/CP-MOV-009-...webm
```

| Proyecto     | Casos | Video |
| ------------ | ----- | ----- |
| `backend-api`| 76    | no aplica (servicio sin interfaz) |
| `frontend`   | 37    | si |
| `dashboard`  | 14    | si |
| `landing`    | 6     | si |
| `mobile-app` | 17    | si |

El catalogo completo esta en [`docs/CASOS-DE-PRUEBA.md`](docs/CASOS-DE-PRUEBA.md).

### En la app nativa con Maestro

Playwright prueba la app movil sobre su build web. [Maestro](https://maestro.mobile.dev) la
maneja en el simulador de iOS, tocando y escribiendo como una persona.

```bash
# una sola vez (instala tambien OpenJDK)
brew install mobile-dev-inc/tap/maestro

docker compose up -d --build                  # la pila tiene que estar arriba
npm --prefix apps/mobile run ios:release      # compila la app (Release) y la instala en el simulador
npm run test:maestro                          # corre apps/mobile/.maestro/flows
```

- El build Release lleva el JavaScript adentro: no hace falta Metro. Hay que recompilar despues
  de cambiar la app.
- Cada flujo crea su propia cuenta contra la API (`.maestro/scripts/crear-cuenta.js`). Para otra
  API: `maestro test -e API_URL=https://... .maestro`.
- `maestro studio` abre un inspector para ver los `testID` de la pantalla y armar flujos nuevos.
- Si `maestro` no encuentra Java: `export JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home`.

| Flujo | Que comprueba |
| --- | --- |
| `01-acceso.yaml` | Credenciales invalidas muestran el error; con las correctas entra a sus listas |
| `02-listas.yaml` | Crear una lista, agregar un producto y marcarlo como comprado |

---

## Estructura del repositorio

```
.
├── docker-compose.yml            Los 8 servicios (entorno de desarrollo)
├── docker-compose.prod.yml       Ajustes de produccion (HTTPS, sin puertos de BD, sin Mailpit)
├── .env.example                  Todas las variables de entorno
├── packages/contracts/           Contrato de la API (solo tipos) que comparten backend, web, panel y app
├── scripts/                      impact.mjs y contract-check.mjs: que se despliega y si rompe algo
├── .github/workflows/            CI, deploy de servicios y publicacion de la app movil
├── apps/
│   ├── backend/                  NestJS + Fastify + TypeORM + Socket.IO
│   │   └── src/
│   │       ├── database/         Entidades, migracion inicial y seed
│   │       ├── modules/
│   │       │   ├── auth/         Registro, login, Google, Apple, JWT, 2FA, cookies
│   │       │   ├── mail/         Correos de verificacion y recuperacion (SMTP)
│   │       │   ├── users/        Perfil y busqueda de personas
│   │       │   ├── lists/        Listas, integrantes y permisos
│   │       │   ├── items/        Productos, compra, recurrencia
│   │       │   ├── recurrence/   Motor programado (@Cron)
│   │       │   ├── realtime/     Gateway de Socket.IO
│   │       │   ├── notifications/Avisos web + push de Expo
│   │       │   ├── admin/        Metricas del dashboard
│   │       │   ├── compat/       Version minima de la app movil
│   │       │   └── health/       Salud del servicio
│   │       ├── common/throttle/  Rate limiting con contadores en Redis
│   │       └── redis/            Cache, refresh tokens y estado de sesion
│   ├── frontend/                 App web de usuarios (base /app/)
│   ├── dashboard/                Panel de administracion (base /dashboard/)
│   ├── landing/                  Pagina publica de descargas
│   └── mobile/                   App React Native (Expo) para iOS y Android
├── infra/nginx/                  Proxy: conf.d (desarrollo), prod (HTTPS), snippets comunes
├── infra/postgres/               Scripts de inicio y migracion 16 → 18
├── e2e/                          Suite de Playwright y evidencia
└── docs/                         Arquitectura y catalogo de pruebas
```

---

## Desarrollo sin Docker

Levanta solo la infraestructura y corre cada app en modo watch:

```bash
docker compose up -d postgres redis mailpit

npm install        # una vez, en la raiz: instala todos los workspaces
cd apps/backend   && POSTGRES_HOST=localhost REDIS_HOST=localhost REDIS_PASSWORD=lista_dev_redis \
                     SMTP_HOST=localhost SMTP_PORT=1025 npm run start:dev
cd apps/frontend  && npm run dev     # http://localhost:5173/app/
cd apps/dashboard && npm run dev     # http://localhost:5174/dashboard/
cd apps/landing   && npm run dev     # http://localhost:5175/
```

Los servidores de Vite ya redirigen `/api` y `/socket.io` a `http://localhost:8080`; si corres
el backend directamente en el host, cambia el `target` en el `vite.config.ts` correspondiente a
`http://localhost:3000`.

---

## Endpoints principales

| Metodo   | Ruta                                    | Que hace                                     |
| -------- | --------------------------------------- | -------------------------------------------- |
| `POST`   | `/api/auth/register`                    | Registro (nombre, correo, WhatsApp, clave)   |
| `POST`   | `/api/auth/login`                       | Inicio de sesion (o reto de 2FA)              |
| `POST`   | `/api/auth/mfa/verify`                  | Segundo paso del login con 2FA                |
| `POST`   | `/api/auth/refresh`                     | Renueva la sesion (cuerpo o cookie httpOnly)  |
| `POST`   | `/api/auth/verify-email`                | Confirma el correo con el token del enlace    |
| `POST`   | `/api/auth/forgot-password`             | Envia el enlace para restablecer la contrasena|
| `POST`   | `/api/auth/reset-password`              | Define la contrasena nueva y cierra sesiones  |
| `POST`   | `/api/auth/mfa/setup` · `enable` · `disable` | Gestiona la verificacion en dos pasos    |
| `PATCH`  | `/api/users/me/password`                | Cambia la contrasena y cierra otras sesiones  |
| `GET`    | `/api/auth/google` · `/api/auth/apple`  | Flujos OAuth para la web                      |
| `POST`   | `/api/auth/google/token`                | Inicio de sesion nativo desde la app movil    |
| `GET`    | `/api/lists`                            | Mis listas (propias y compartidas)            |
| `POST`   | `/api/lists/:id/share`                  | Compartir con otra persona                    |
| `PATCH`  | `/api/lists/:id/notifications`          | Activar/desactivar mis avisos de esa lista    |
| `POST`   | `/api/lists/:id/items`                  | Agregar producto (puntual o recurrente)       |
| `POST`   | `/api/items/:id/purchase`               | Marcar como comprado                          |
| `POST`   | `/api/items/:id/restore`                | Deshacer la compra                            |
| `DELETE` | `/api/items/:id/close`                  | La "x" de la lista de comprados               |
| `DELETE` | `/api/items/:id`                        | Eliminar y cancelar la recurrencia            |
| `POST`   | `/api/recurrence/items/:id/advance`     | Simular el paso del tiempo (demos y pruebas)  |
| `POST`   | `/api/notifications/devices`            | Registrar el token push del telefono          |
| `GET`    | `/api/admin/stats`                      | Metricas del dashboard (solo admin)           |

Eventos de WebSocket: `item:created`, `item:updated`, `item:purchased`, `item:restored`,
`item:removed`, `item:reactivated`, `item:overdue`, `list:updated`, `list:member-added`,
`list:member-removed`, `list:deleted` y `notification`.

---

## Documentacion adicional

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — modelo de datos, decisiones y flujos internos.
- [`docs/CASOS-DE-PRUEBA.md`](docs/CASOS-DE-PRUEBA.md) — los 150 casos de prueba, uno por uno.
- [`docs/COMPATIBILIDAD.md`](docs/COMPATIBILIDAD.md) — que se puede desplegar sin miedo, contrato
  compartido, version minima de la app y workflows de CI/CD.
