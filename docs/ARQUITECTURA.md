# Arquitectura

Documento de apoyo al [README](../README.md): modelo de datos, decisiones tecnicas y como
encajan las piezas.

---

## 1. Servicios y responsabilidades

| Servicio    | Responsabilidad                                                                 |
| ----------- | ------------------------------------------------------------------------------- |
| `nginx`     | Unico puerto expuesto. Enruta `/`, `/app/`, `/dashboard/`, `/api/` y `/socket.io/`, hace gzip, gestiona el upgrade de WebSocket y pone las cabeceras de seguridad (CSP, HSTS…). En produccion termina TLS. |
| `landing`   | Sitio estatico con las descargas de iOS y Android. Sin logica ni dependencias.  |
| `frontend`  | SPA de usuarios. Solo habla con `/api` y `/socket.io`.                          |
| `dashboard` | SPA de administracion. Consume `/api/admin/*`, exige rol `admin`.               |
| `backend`   | Toda la logica: autenticacion, listas, recurrencia, tiempo real y avisos.       |
| `postgres`  | Fuente de verdad.                                                               |
| `redis`     | Cache de lecturas, refresh tokens, estado de sesion, tokens de un solo uso, contadores del rate limiting y pub/sub del adaptador de Socket.IO. |
| `mailpit`   | Solo desarrollo: SMTP que captura los correos de verificacion y recuperacion (bandeja en `:8025`). |

Los tres frontends se compilan en su propia imagen multi-stage y se sirven como estaticos
desde un nginx minimo; el nginx principal solo hace de proxy. Asi ninguna imagen de produccion
lleva Node ni dependencias de build.

---

## 2. Modelo de datos

```
users ──────┬──< list_members >────── shopping_lists ──< list_items
            │                              │                 │
            ├──< user_identities           └──< list_invitations
            ├──< device_tokens
            └──< notifications
                 activity_logs (bitacora suelta, alimenta el dashboard)
```

### `users`
Nombre completo, correo (unico, indexado en minusculas), WhatsApp, hash de contrasena
(`select: false`, nunca sale en las respuestas), proveedor con el que se creo la cuenta
(`local` | `google` | `apple`), rol, estado, correo verificado, 2FA (secreto TOTP cifrado y
hashes de los codigos de recuperacion, ambos `select: false`) y el interruptor global de
notificaciones.

### `user_identities`
Cuentas de Google/Apple vinculadas a un usuario, unicas por `(provider, subject)`. El `subject`
es el `sub` del proveedor, que no cambia aunque la persona cambie de correo; asi un usuario
puede tener Google y Apple a la vez y el inicio de sesion social nunca depende solo del correo.

### `shopping_lists` y `list_members`
Una persona puede tener varias listas y una lista puede tener varios integrantes. La tabla
intermedia guarda el **rol** (`owner`/`editor`/`viewer`) y la preferencia individual
`notify_on_change`: cada quien decide si quiere enterarse de los cambios de esa lista.

### `list_items` — el corazon del sistema

| Columna              | Para que sirve                                                       |
| -------------------- | -------------------------------------------------------------------- |
| `status`             | `pending` (lista de arriba) · `purchased` (lista de abajo, tachado) · `archived` (cerrado con la "x") |
| `is_recurring`       | Marca si el producto se vuelve a agregar solo                        |
| `recurrence_days`    | Periodo del ciclo (1 a 365, con `CHECK` en la base)                  |
| `activated_at`       | Cuando entro o volvio a entrar a pendientes                          |
| `due_at`             | `activated_at + recurrence_days`. Pasada esa fecha se marca vencido  |
| `next_activation_at` | `purchased_at + recurrence_days`. Cuando llega, el producto reaparece|
| `cycle_count`        | Cuantas veces se ha completado el ciclo                              |
| `overdue_notified_at`| Evita repetir el aviso de vencimiento en cada pasada del scheduler   |

Los campos calculados que consume la interfaz (`isOverdue`, `daysOverdue`, `daysUntilDue`,
`daysUntilReactivation`) **no se guardan**: se derivan en `item.mapper.ts` en cada lectura, asi
que nunca quedan desincronizados con el reloj.

---

## 3. Ciclo de vida de un producto recurrente

```
                    agregar (recurrencia = N dias)
                                │
                                ▼
                        status = pending
                        activated_at = ahora
                        due_at = ahora + N
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
   se compra antes de due_at            pasa due_at sin comprarse
              │                                   │
              ▼                                   ▼
   status = purchased                   sigue pending, pero con
   purchased_at = ahora                 isOverdue = true (otro color)
   next_activation_at = ahora + N       y un aviso unico a la lista
              │                                   │
              │                                   └── al comprarlo, vuelve
              │                                       al camino de la izquierda
              ▼
   la "x" → status = archived
   (la programacion se conserva)
              │
              ▼
   el scheduler ve next_activation_at <= ahora
              │
              ▼
   status = pending · activated_at = ahora · due_at = ahora + N
   cycle_count += 1 · evento item:reactivated + aviso
```

Puntos importantes:

- **El ciclo se cuenta desde la compra, no desde el alta.** Agregar el lunes y comprar el
  viernes con recurrencia de 14 dias significa reaparecer 14 dias despues del viernes.
- **Cerrar con la "x" no cancela nada.** `archived` solo lo oculta; el scheduler lo sigue
  vigilando. Para cancelar hay que borrar el producto.
- **Un producto puntual nunca se reactiva**: su `next_activation_at` siempre es `null`.

El motor (`RecurrenceService`) hace dos barridos por pasada: reactivar los vencidos de
`next_activation_at` y marcar como vencidos los `pending` que se pasaron de `due_at`. La
frecuencia se controla con `RECURRENCE_CRON`.

Para demos y pruebas automatizadas existe `POST /api/recurrence/items/:id/advance`, que resta N
dias a todas las fechas del producto y ejecuta el motor en el momento. Se puede desactivar en
produccion con `ALLOW_TIME_TRAVEL=false`.

---

## 4. Tiempo real

`RealtimeGateway` (Socket.IO sobre el mismo puerto que la API, proxeado por nginx):

1. **Autenticacion en el handshake.** Un middleware `server.use()` valida el JWT antes de
   aceptar la conexion, asi el cliente recibe un `connect_error` claro en vez de una
   desconexion seca.
2. **Salas.** Al conectarse, cada cliente entra a `user:<id>` (avisos personales) y a
   `list:<id>` por cada lista de la que forma parte. Al compartir una lista, el backend mete al
   nuevo integrante en la sala aunque ya estuviera conectado.
3. **Escalado.** `@socket.io/redis-adapter` reparte los eventos entre replicas del backend, asi
   que se puede escalar horizontalmente sin perder mensajes.

Los servicios de dominio solo llaman a `emitToList()` / `emitToUser()`; no conocen sockets.

---

## 5. Avisos

`NotificationsService.notifyListMembers()` resuelve los destinatarios aplicando tres filtros:
la preferencia de la lista (`list_members.notify_on_change`), el interruptor global del usuario
(`users.notifications_enabled`) y la exclusion de quien hizo el cambio. Despues:

- persiste una fila en `notifications` (historial y contador de no leidos),
- emite `notification` a la sala `user:<id>` → la web lo muestra como **pop-up**,
- envia la push por Expo a los `device_tokens` de iOS/Android registrados.

Los tokens que Expo reporta como `DeviceNotRegistered` se borran solos.

---

## 6. Autenticacion

- **Local**: bcrypt (12 rondas) + JWT de acceso corto (15 min) y refresh largo (30 dias).
  Correo de verificacion al registrarse y recuperacion de contrasena con tokens aleatorios de un
  solo uso (en Redis solo se guarda su SHA-256).
- **Rotacion de refresh**: cada renovacion invalida el token anterior. Los refresh vigentes
  viven en Redis (`refresh:<userId>:<jti>`), asi cerrar sesion los revoca al instante en todas
  las replicas.
- **Revocacion de access tokens**: cada token lleva la version de sesion del usuario (`sv`).
  Cambiar o recuperar la contrasena, cerrar todas las sesiones o desactivar la cuenta incrementa
  `auth:session-version:<userId>` (o marca `auth:disabled:<userId>`), y el `JwtAuthGuard` y el
  gateway rechazan desde ya los tokens anteriores. Los sockets del usuario se desconectan.
- **Clientes web**: con la cabecera `X-Auth-Client: web|dashboard` el refresh token viaja en
  una cookie `httpOnly`, `SameSite=Strict`, `Path=/api/auth` (una por SPA) y nunca en el cuerpo.
  El access token vive solo en memoria; al recargar se recupera con `/auth/refresh`. Las
  renovaciones se serializan entre pestanas con Web Locks porque el refresh rota en cada uso.
- **2FA (TOTP, RFC 6238)**: si la cuenta lo tiene activo, el login devuelve un reto de un solo
  uso (5 min, 5 intentos) que se resuelve en `/auth/mfa/verify`. No se acepta dos veces el
  mismo codigo. El secreto se guarda cifrado con AES-256-GCM (`APP_ENCRYPTION_KEY`).
- **Google y Apple**: implementados directamente contra los endpoints OIDC (sin passport) para
  poder reutilizar el mismo codigo en el flujo web con redireccion y en el flujo nativo de la
  app movil con `id_token`. El flujo web usa `state` de un solo uso, `nonce` y PKCE (Google).
  Los tokens se verifican con `jose` contra los JWKS de cada proveedor, aceptando como
  audiencia los client id web y nativos. El `client_secret` de Apple se firma al vuelo con ES256.
- Al volver del proveedor siempre se redirige a la app web propia (no hay URLs de retorno
  elegidas por el cliente): el refresh token queda en la cookie y en el fragmento solo viaja el
  estado o el reto de 2FA.
- **Rate limiting**: `ThrottlerGuard` global con contadores en Redis por IP (`request.ip`
  respeta `TRUST_PROXY`), limites propios para login/registro/2FA y para los endpoints que
  envian correo, y bloqueo temporal por correo tras 10 intentos fallidos de login.

Guards globales: `AppThrottlerGuard`, `JwtAuthGuard` (todo protegido salvo lo marcado con
`@Public()`) y `RolesGuard` (`@Roles(UserRole.ADMIN)`).

---

## 7. Cache

| Clave                     | Contenido                        | TTL     | Se invalida cuando            |
| ------------------------- | -------------------------------- | ------- | ----------------------------- |
| `list:<id>:detail`        | Detalle completo de la lista     | 30 s    | Cualquier cambio en la lista  |
| `user:<id>:lists`         | Resumen de listas del usuario    | 30 s    | Alta/baja de listas o miembros|
| `admin:stats`             | Metricas del dashboard           | 15 s    | Por expiracion                |
| `refresh:<userId>:<jti>`  | Refresh token vigente            | TTL JWT | Logout o rotacion             |
| `oauth:state:<state>`     | Anti-CSRF, nonce y PKCE de OAuth | 10 min  | Al consumirse                 |
| `auth:session-version:<id>` | Version de sesion vigente      | 45 dias | Se incrementa al revocar      |
| `auth:email-verify:<hash>` · `auth:pwd-reset:<hash>` | Tokens de un solo uso | 24 h · 1 h | Al usarse |
| `auth:mfa-challenge:<token>` | Reto de 2FA del login         | 5 min   | Al resolverse o tras 5 fallos |
| `throttle:*`              | Contadores del rate limiting     | ventana | Por expiracion                |

La invalidacion es explicita: cada escritura sobre una lista borra su detalle y el resumen de
todos sus integrantes, de modo que la siguiente lectura ya ve los cambios (comprobado en
`CP-CACHE-001`).

---

## 8. Decisiones y sus motivos

| Decision | Motivo |
| --- | --- |
| Fastify en vez de Express | Mas throughput y menos overhead por peticion; NestJS lo soporta de forma nativa. |
| TypeORM con migracion SQL escrita a mano | `synchronize` esta desactivado: el esquema de produccion nunca cambia solo. |
| Campos de recurrencia calculados en lectura | Evita un estado derivado que se quede viejo cuando el reloj avanza. |
| `archived` en vez de borrado fisico | Permite cerrar un producto con la "x" sin perder su recurrencia ni el historial. |
| Adaptador de Redis para Socket.IO | Permite escalar el backend a varias replicas sin partir las salas. |
| OAuth propio en vez de passport | El mismo codigo sirve para el flujo web con redireccion y el nativo del movil. |
| React Native Web para las pruebas del movil | Playwright no controla apps nativas; el build web ejecuta exactamente la misma base de codigo y permite grabar video. |
| Refresh token en cookie httpOnly en la web | Un XSS no puede leerlo; el access token dura 15 min y vive solo en memoria. La app movil usa el Keychain/Keystore. |
| Version de sesion en Redis para revocar access tokens | Exacta (no depende de la resolucion en segundos de `iat`) y cuesta una lectura de Redis por peticion. |
| TOTP implementado en el backend | Son unas decenas de lineas verificadas contra los vectores del RFC 6238; evita otra dependencia en el manejo de secretos. |
| `npm ci` con el lockfile del monorepo en los Dockerfile | Builds reproducibles: la imagen instala exactamente las versiones auditadas. |
