# Compatibilidad entre versiones y despliegues

El sistema se publica por tres caminos que no avanzan al mismo ritmo:

| Que | Como llega a la gente | Quien decide cuando |
| --- | --- | --- |
| Backend, web, panel y landing | Docker (`deploy-services.yml`) | Nosotros, todo a la vez |
| App movil, cambio solo de JavaScript | Actualizacion OTA con EAS Update (`mobile.yml`) | Nosotros, llega en minutos |
| App movil, cambio nativo | Build nuevo en App Store y Google Play (`mobile.yml`) | Cada persona, cuando actualiza |

La consecuencia es una sola: **el backend siempre convive con versiones anteriores de la app**.
Todo lo que sigue sale de ahi. Por eso la app vive en el mismo repositorio (un cambio de API y
su uso en la app van en el mismo PR y las pruebas e2e los prueban juntos) pero se despliega
aparte.

---

## Lo que se comparte: `packages/contracts`

Todo lo que cruza la red se declara una sola vez en `packages/contracts`:

| Archivo | Contenido | Direccion |
| --- | --- | --- |
| `models.d.ts` | Usuario, lista, producto, integrante, aviso | servidor → cliente |
| `auth.d.ts` | Respuestas de login y 2FA | servidor → cliente |
| `requests.d.ts` | Cuerpos de las peticiones (`*Request`) | cliente → servidor |
| `realtime.d.ts` | Eventos de Socket.IO (`ServerEvents`, `ClientEvents`) | ambas |
| `compat.d.ts` | Version minima de la app y forma de los errores | servidor → cliente |

- **El backend lo implementa**: los mappers devuelven esos tipos, los DTO los implementan
  (`class CreateItemDto implements CreateItemRequest`) y los eventos de socket estan tipados.
- **Los clientes lo consumen**: web, panel y app movil importan de `@lista/contracts` en vez de
  mantener copias.
- **Solo son tipos** (`.d.ts`): no hay paso de compilacion ni codigo en tiempo de ejecucion. La
  app movil, que esta fuera de los workspaces de npm, lo encuentra con `paths` en su
  `tsconfig.json`; Babel borra esas importaciones al generar el bundle.

Si alguien cambia el contrato, **la compilacion falla en cada lugar que hay que ajustar**
(`npm run typecheck` revisa los cuatro). Eso es lo que hay que sincronizar, y nada mas.

Quedan fuera los tipos del panel de administracion: solo los usa el panel, que se despliega junto
con el backend.

---

## Semaforo: que se puede actualizar sin miedo

### 🟢 Sin miedo

- Cualquier cambio en web, panel o landing.
- Backend que no toca contrato, rutas, eventos ni migraciones.
- **Agregar**: campos a una respuesta, endpoints, eventos, campos *opcionales* a una peticion.
- App movil con cambios solo de JavaScript: sale por OTA.

### 🟡 Con cuidado

- **Migraciones**: el backend anterior sigue corriendo contra la base mientras arranca el
  nuevo. Agrega columnas nullable o con valor por defecto; no borres ni renombres en el mismo
  despliegue que deja de usarlas.
- **Cambio nativo en la app** (dependencias, `app.json`, iconos): requiere build de tienda y
  durante semanas conviven la version nueva y la anterior.
- **Tiempo real**: conserva los eventos y campos que escuchan las apps publicadas.

### 🔴 Coordinar antes de desplegar

- Quitar o renombrar un campo de una respuesta, cambiar su tipo o volverlo opcional.
- Agregar un valor a un tipo cerrado (`ItemStatus`, `MemberRole`): una app vieja no sabria que
  hacer con el. `AppNotification.type` es abierto a proposito: se pueden sumar tipos de aviso.
- Agregar un campo *obligatorio* a una peticion.
- Quitar o renombrar una ruta.

---

## Como saberlo sin pensarlo

```bash
npm run impact                      # contra origin/main
npm run impact -- main              # contra otra rama
npm run contract:check              # solo el contrato, con el detalle de lo incompatible
```

`impact` responde que se despliega (servicios, OTA o tienda), el nivel de riesgo y que revisar.
`contract:check` compara el contrato con el de la rama base usando el propio compilador de
TypeScript: lo que viaja al cliente debe seguir encajando en la forma vieja y lo que viaja al
servidor debe seguir aceptando lo que mandan las apps viejas.

En GitHub Actions:

- **Cada PR** muestra el informe de impacto en el resumen del job y **falla si el contrato rompe
  a las apps publicadas** sin haberlo aprobado (ver abajo).
- **El deploy automatico de servicios se niega** con un cambio 🔴: hay que coordinarlo y
  lanzarlo a mano.

---

## Como hacer un cambio incompatible

Ejemplo: renombrar `Item.unit` a `Item.unitName`.

1. **Agregar sin quitar.** `unitName` entra al contrato y al backend; `unit` se queda. Es 🟢.
2. **Publicar la app que usa lo nuevo.** Sube `version` en `apps/mobile/app.json` (p. ej. 1.4.0)
   y publica (OTA o tienda, lo decide `mobile.yml`).
3. **Esperar a que se adopte** (estadisticas de App Store Connect, Google Play y EAS).
4. **Subir `MOBILE_MIN_VERSION=1.4.0`** en el `.env` del servidor y reiniciar el backend
   (`docker compose up -d backend`). Desde ese momento las apps anteriores muestran
   "Actualiza la app" en lugar de fallar a medias.
5. **Retirar lo viejo.** Quita `unit` del contrato y sube la version mayor de
   `packages/contracts/package.json` (1.x → 2.0.0). Esa subida es la aprobacion explicita: sin
   ella el PR no pasa. Despliega los servicios a mano.

---

## Version minima de la app

- La app manda en cada peticion `X-App-Version` (la `version` de `app.json`) y
  `X-App-Platform`.
- Por debajo de `MOBILE_MIN_VERSION` la API responde **426** con `code: "APP_UPDATE_REQUIRED"` y
  el enlace a la tienda (`MOBILE_STORE_URL_IOS`, `MOBILE_STORE_URL_ANDROID`).
- El corte se evalua antes que la sesion: una app vieja ve "Actualiza la app", no el login.
- La app consulta `GET /api/app/compatibility` al abrir, asi que el aviso aparece de inmediato.
- La web y el panel no mandan la cabecera y nunca se cortan: se despliegan con el backend.
- **Sube `version` en `app.json` en cada publicacion**, sea de tienda u OTA. Es lo unico que
  permite exigirla despues. `npm run impact` avisa si la app cambio y la version no.

---

## OTA o tienda

`app.json` usa `runtimeVersion: { policy: "fingerprint" }`: EAS calcula una huella de todo lo
nativo y **una actualizacion OTA solo llega a los binarios con la misma huella**. Aunque la
decision fuera equivocada, una OTA nunca cae en un binario incompatible.

`npm run impact` decide el camino: cambios en `app.json`, en las dependencias de `package.json`,
en `package-lock.json`, `eas.json`, `assets/`, `ios/`, `android/` o `plugins/` van a tienda; el
resto, por OTA.

---

## Workflows

| Workflow | Cuando | Que hace |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Cada PR y cada push a `main` | Impacto, contrato, tipos y build de todo, pruebas e2e |
| `.github/workflows/deploy-services.yml` | Push a `main` que no sea solo de la app, docs o pruebas | Despliega por SSH con Docker; se niega con 🔴 salvo lanzamiento manual |
| `.github/workflows/mobile.yml` | Push a `main` que toca `apps/mobile` o el contrato | OTA con EAS Update o build de tienda |

Configuracion en GitHub (Settings → Environments / Secrets and variables):

| Nombre | Tipo | Para |
| --- | --- | --- |
| `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` | Variables del environment `production` | Servidor y carpeta del repositorio |
| `DEPLOY_SSH_KEY` | Secreto | Clave privada con acceso al servidor |
| `DEPLOY_KNOWN_HOSTS` | Secreto | Salida de `ssh-keyscan tu-servidor` |
| `EAS_ENABLED` | Variable | `true` para activar las publicaciones de la app |
| `EXPO_TOKEN` | Secreto | Token de expo.dev → Access tokens |

Sin `DEPLOY_HOST` o sin `EAS_ENABLED=true` los workflows de publicacion no hacen nada. Antes de
activar el de la app hay que vincularla una vez con EAS: `npx eas init` y
`npx eas update:configure` dentro de `apps/mobile`.
