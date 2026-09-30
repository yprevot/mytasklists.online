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
                                   PostgreSQL 16            Redis 7
                                   (datos)                  (cache + pub/sub)
```

| Servicio    | Tecnologia                                  | Ruta publica   |
| ----------- | ------------------------------------------- | -------------- |
| `nginx`     | nginx 1.27 (proxy inverso, WebSocket, gzip) | `:8080`        |
| `landing`   | HTML/CSS estatico + nginx                   | `/`            |
| `frontend`  | React 18 + TypeScript + Vite + Bootstrap 5  | `/app/`        |
| `dashboard` | React 18 + TypeScript + Vite + Bootstrap 5  | `/dashboard/`  |
| `backend`   | NestJS 11 sobre Fastify + TypeORM           | `/api/`        |
| `postgres`  | PostgreSQL 16                               | `:5432`        |
| `redis`     | Redis 7                                     | `:6379`        |
| App movil   | React Native (Expo SDK 52) — iOS y Android  | tiendas        |

---

## Arranque rapido

Requisitos: Docker con Compose v2 y Node 20+ (solo para la app movil y las pruebas).

```bash
cp .env.example .env
docker compose up -d --build
```

Cuando los siete contenedores esten `healthy`:

| Que                       | Donde                                |
| ------------------------- | ------------------------------------ |
| Landing / descargas       | http://localhost:8080/               |
| Aplicacion web            | http://localhost:8080/app/           |
| Panel de administracion   | http://localhost:8080/dashboard/     |
| API                       | http://localhost:8080/api/health     |
| Documentacion OpenAPI     | http://localhost:8080/api/docs       |

### Cuentas de demostracion

El backend siembra datos de ejemplo al arrancar (`RUN_SEED=true`):

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

Los enlaces de descarga de la landing se configuran con `LANDING_IOS_URL` y
`LANDING_ANDROID_URL` en el `.env`.

### Notificaciones push

La app registra su token de Expo en `POST /api/notifications/devices` al iniciar sesion. El
backend las envia con `expo-server-sdk`. Define `EXPO_ACCESS_TOKEN` si tu proyecto de Expo lo
exige; sin el, la app sigue funcionando y los avisos llegan por WebSocket.

---

## Registro con Google y Apple

Ambos flujos estan implementados (OIDC directo, verificando el token contra los JWKS de cada
proveedor) y se activan solos en cuanto hay credenciales:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:8080/api/auth/google/callback

APPLE_CLIENT_ID=com.listadecompras.app.service
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=YYYYYYYYYY
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_CALLBACK_URL=http://localhost:8080/api/auth/apple/callback
```

`GET /api/auth/providers` indica cuales estan disponibles y la interfaz muestra u oculta los
botones en consecuencia. La app movil usa los endpoints nativos
`POST /api/auth/google/token` y `POST /api/auth/apple/token`.

---

## Pruebas end-to-end con Playwright

**127 casos** repartidos en cinco proyectos, uno por servicio mas la app movil.
Todos los casos con interfaz **graban un video de evidencia**.

```bash
docker compose up -d --build     # la pila tiene que estar arriba

# una sola vez: dependencias y navegador de Playwright
npm --prefix e2e install
npm --prefix e2e run install:browsers

# desde la raiz del repositorio
npm run test:e2e                 # los 5 proyectos (127 casos)
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
| `backend-api`| 61    | no aplica (servicio sin interfaz) |
| `frontend`   | 33    | si |
| `dashboard`  | 13    | si |
| `landing`    | 6     | si |
| `mobile-app` | 14    | si |

El catalogo completo esta en [`docs/CASOS-DE-PRUEBA.md`](docs/CASOS-DE-PRUEBA.md).

---

## Estructura del repositorio

```
.
├── docker-compose.yml            Los 7 servicios
├── .env.example                  Todas las variables de entorno
├── apps/
│   ├── backend/                  NestJS + Fastify + TypeORM + Socket.IO
│   │   └── src/
│   │       ├── database/         Entidades, migracion inicial y seed
│   │       ├── modules/
│   │       │   ├── auth/         Registro, login, Google, Apple, JWT
│   │       │   ├── users/        Perfil y busqueda de personas
│   │       │   ├── lists/        Listas, integrantes y permisos
│   │       │   ├── items/        Productos, compra, recurrencia
│   │       │   ├── recurrence/   Motor programado (@Cron)
│   │       │   ├── realtime/     Gateway de Socket.IO
│   │       │   ├── notifications/Avisos web + push de Expo
│   │       │   ├── admin/        Metricas del dashboard
│   │       │   └── health/       Salud del servicio
│   │       └── redis/            Cache y almacenamiento de refresh tokens
│   ├── frontend/                 App web de usuarios (base /app/)
│   ├── dashboard/                Panel de administracion (base /dashboard/)
│   ├── landing/                  Pagina publica de descargas
│   └── mobile/                   App React Native (Expo) para iOS y Android
├── infra/nginx/                  Configuracion del proxy
├── e2e/                          Suite de Playwright y evidencia
└── docs/                         Arquitectura y catalogo de pruebas
```

---

## Desarrollo sin Docker

Levanta solo la infraestructura y corre cada app en modo watch:

```bash
docker compose up -d postgres redis

cd apps/backend   && npm install && POSTGRES_HOST=localhost REDIS_HOST=localhost npm run start:dev
cd apps/frontend  && npm install && npm run dev     # http://localhost:5173/app/
cd apps/dashboard && npm install && npm run dev     # http://localhost:5174/dashboard/
cd apps/landing   && npm install && npm run dev     # http://localhost:5175/
```

Los servidores de Vite ya redirigen `/api` y `/socket.io` a `http://localhost:8080`; si corres
el backend directamente en el host, cambia el `target` en el `vite.config.ts` correspondiente a
`http://localhost:3000`.

---

## Endpoints principales

| Metodo   | Ruta                                    | Que hace                                     |
| -------- | --------------------------------------- | -------------------------------------------- |
| `POST`   | `/api/auth/register`                    | Registro (nombre, correo, WhatsApp, clave)   |
| `POST`   | `/api/auth/login`                       | Inicio de sesion                              |
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
- [`docs/CASOS-DE-PRUEBA.md`](docs/CASOS-DE-PRUEBA.md) — los 127 casos de prueba, uno por uno.
