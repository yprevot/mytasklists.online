# Compatibilidad entre versiones y despliegues

El sistema se publica por tres caminos que no avanzan al mismo ritmo:

| Qué | Cómo llega a la gente | Quién decide cuándo |
| --- | --- | --- |
| Backend, web, panel y landing | Imágenes en GHCR + Coolify (`deploy.yml`) | Nosotros, todo a la vez |
| App móvil, cambio solo de JavaScript | Actualización OTA con EAS Update (`mobile.yml`) | Nosotros, llega en minutos |
| App móvil, cambio nativo | Build nuevo en App Store y Google Play (`mobile.yml`) | Cada persona, cuando actualiza |

La consecuencia es una sola: **el backend siempre convive con versiones anteriores de la app**.
Todo lo que sigue sale de ahí. Por eso la app vive en el mismo repositorio (un cambio de API y
su uso en la app van en el mismo PR y las pruebas e2e los prueban juntos) pero se despliega
aparte.

---

## Lo que se comparte: `packages/contracts`

Todo lo que cruza la red se declara una sola vez en `packages/contracts`:

| Archivo | Contenido | Dirección |
| --- | --- | --- |
| `models.d.ts` | Usuario, lista, producto, integrante, aviso | servidor → cliente |
| `auth.d.ts` | Respuestas de login y 2FA | servidor → cliente |
| `requests.d.ts` | Cuerpos de las peticiones (`*Request`) | cliente → servidor |
| `realtime.d.ts` | Eventos de Socket.IO (`ServerEvents`, `ClientEvents`) | ambas |
| `compat.d.ts` | Versión mínima de la app y forma de los errores | servidor → cliente |

- **El backend lo implementa**: los mappers devuelven esos tipos, los DTO los implementan
  (`class CreateItemDto implements CreateItemRequest`) y los eventos de socket están tipados.
- **Los clientes lo consumen**: web, panel y app móvil importan de `@lista/contracts` en vez de
  mantener copias.
- **Solo son tipos** (`.d.ts`): no hay paso de compilación ni código en tiempo de ejecución. La
  app móvil, que está fuera de los workspaces de npm, lo encuentra con `paths` en su
  `tsconfig.json`; Babel borra esas importaciones al generar el bundle.

Si alguien cambia el contrato, **la compilación falla en cada lugar que hay que ajustar**
(`npm run typecheck` revisa los cuatro). Eso es lo que hay que sincronizar, y nada más.

Quedan fuera los tipos del panel de administración: solo los usa el panel, que se despliega junto
con el backend.

---

## Semáforo: qué se puede actualizar sin miedo

### 🟢 Sin miedo

- Cualquier cambio en web, panel o landing.
- Backend que no toca contrato, rutas, eventos ni migraciones.
- **Agregar**: campos a una respuesta, endpoints, eventos, campos *opcionales* a una petición.
- App móvil con cambios solo de JavaScript: sale por OTA.

### 🟡 Con cuidado

- **Migraciones**: el backend anterior sigue corriendo contra la base mientras arranca el
  nuevo. Agrega columnas nullable o con valor por defecto; no borres ni renombres en el mismo
  despliegue que deja de usarlas.
- **Cambio nativo en la app** (dependencias, `app.json`, iconos): requiere build de tienda y
  durante semanas conviven la versión nueva y la anterior.
- **Tiempo real**: conserva los eventos y campos que escuchan las apps publicadas.

### 🔴 Coordinar antes de desplegar

- Quitar o renombrar un campo de una respuesta, cambiar su tipo o volverlo opcional.
- Agregar un valor a un tipo cerrado (`ItemStatus`, `MemberRole`): una app vieja no sabría qué
  hacer con él. `AppNotification.type` es abierto a propósito: se pueden sumar tipos de aviso.
- Agregar un campo *obligatorio* a una petición.
- Quitar o renombrar una ruta.

---

## Cómo saberlo sin pensarlo

```bash
npm run impact                      # contra origin/main
npm run impact -- main              # contra otra rama
npm run contract:check              # solo el contrato, con el detalle de lo incompatible
```

`impact` responde qué se despliega (servicios, OTA o tienda), el nivel de riesgo y qué revisar.
`contract:check` compara el contrato con el de la rama base usando el propio compilador de
TypeScript: lo que viaja al cliente debe seguir encajando en la forma vieja y lo que viaja al
servidor debe seguir aceptando lo que mandan las apps viejas.

En GitHub Actions:

- **Cada PR** muestra el informe de impacto en el resumen del job y **falla si el contrato rompe
  a las apps publicadas** sin haberlo aprobado (ver abajo).
- **El deploy automático de servicios se niega** con un cambio 🔴: hay que coordinarlo y
  lanzarlo a mano.

---

## Cómo hacer un cambio incompatible

Ejemplo: renombrar `Item.unit` a `Item.unitName`.

1. **Agregar sin quitar.** `unitName` entra al contrato y al backend; `unit` se queda. Es 🟢.
2. **Publicar la app que usa lo nuevo.** Sube `version` en `apps/mobile/app.json` (p. ej. 1.4.0)
   y publica (OTA o tienda, lo decide `mobile.yml`).
3. **Esperar a que se adopte** (estadísticas de App Store Connect, Google Play y EAS).
4. **Subir `MOBILE_MIN_VERSION=1.4.0`** en el `.env` del servidor y reiniciar el backend
   (`docker compose up -d backend`). Desde ese momento las apps anteriores muestran
   "Actualiza la app" en lugar de fallar a medias.
5. **Retirar lo viejo.** Quita `unit` del contrato y sube la versión mayor de
   `packages/contracts/package.json` (1.x → 2.0.0). Esa subida es la aprobación explícita: sin
   ella el PR no pasa. Despliega los servicios a mano.

---

## Versión mínima de la app

- La app manda en cada petición `X-App-Version` (la `version` de `app.json`) y
  `X-App-Platform`.
- Por debajo de `MOBILE_MIN_VERSION` la API responde **426** con `code: "APP_UPDATE_REQUIRED"` y
  el enlace a la tienda (`MOBILE_STORE_URL_IOS`, `MOBILE_STORE_URL_ANDROID`).
- El corte se evalúa antes que la sesión: una app vieja ve "Actualiza la app", no el login.
- La app consulta `GET /api/app/compatibility` al abrir, así que el aviso aparece de inmediato.
- La web y el panel no mandan la cabecera y nunca se cortan: se despliegan con el backend.
- **Sube `version` en `app.json` en cada publicación**, sea de tienda u OTA. Es lo único que
  permite exigirla después. `npm run impact` avisa si la app cambió y la versión no.

---

## OTA o tienda

`app.json` usa `runtimeVersion: { policy: "fingerprint" }`: EAS calcula una huella de todo lo
nativo y **una actualización OTA solo llega a los binarios con la misma huella**. Aunque la
decisión fuera equivocada, una OTA nunca cae en un binario incompatible.

`npm run impact` decide el camino: cambios en `app.json`, en las dependencias de `package.json`,
en `package-lock.json`, `eas.json`, `assets/`, `ios/`, `android/` o `plugins/` van a tienda; el
resto, por OTA.

---

## Workflows

| Workflow | Cuando | Qué hace |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Cada PR y cada push a `main` | Impacto, contrato, tipos y build de todo, pruebas e2e |
| `.github/workflows/deploy.yml` | Push a `main` que no sea solo de la app, docs o pruebas | Publica las imágenes en GHCR y despliega en Coolify; se niega con 🔴 salvo lanzamiento manual |
| `.github/workflows/mobile.yml` | Push a `main` que toca `apps/mobile` o el contrato | OTA con EAS Update o build de tienda |

Configuración en GitHub (Settings → Environments / Secrets and variables):

| Nombre | Tipo | Para |
| --- | --- | --- |
| `DEPLOY_ENABLED` | Variable del **repositorio** | `true` para publicar y desplegar |
| `SITE_URL` | Variable del environment `production` | URL pública (comprueba `/version.json`) |
| `COOLIFY_WEBHOOK`, `COOLIFY_TOKEN` | Secretos del environment `production` | Webhook de la app y token de Coolify solo con permiso `deploy` |
| `EAS_ENABLED` | Variable | `true` para activar las publicaciones de la app |
| `EXPO_TOKEN` | Secreto | Token de expo.dev → Access tokens |

Sin `DEPLOY_ENABLED=true` o sin `EAS_ENABLED=true` los workflows de publicación no hacen nada. Antes de
activar el de la app hay que vincularla una vez con EAS: `npx eas init` y
`npx eas update:configure` dentro de `apps/mobile`.

## Coordinación del registro por correo (flujo 2)

La entrega actual implementa una fase **bridge**: primero se publica el backend con el registro por correo disponible, conservando login, sesiones y listas de la app 1.x. El registro antiguo nunca crea usuarios sin verificar; en una app antigua responde 426 con `APP_UPDATE_REQUIRED`, mínimo 2.0.0 y enlaces de descarga/web. El corte global sólo ocurre en **enforced**.

1. Configurar en Coolify/compose `MOBILE_ROLLOUT_PHASE=bridge`, `MOBILE_MIN_VERSION=1.0.0` y `MOBILE_RELEASE_READY_VERSION=`. Ejecutar el deploy manual de servicios. La retirada del registro antiguo requiere despliegue manual aunque bridge conserve los demás flujos.
2. Comprobar el servidor: `npm run release:check -- --url=https://mytasklists.online`. Debe anunciar `registrationFlow=2`, `rolloutPhase=bridge` y mínimo 1.0.0. El cliente nuevo consulta esa capacidad antes de registrar; ante un backend anterior muestra un mensaje y no llama a un endpoint inexistente.
3. Publicar binarios 2.0.0; Expo IAP y Picker requieren build nativo. El workflow móvil comprueba el backend antes de iniciar una publicación. Un build EAS terminado no equivale a aprobación/publicación en las tiendas. Para Android directo se utiliza el perfil `direct` y el publicador de APK firmado existente. iOS requiere ficha publicada o TestFlight disponible.
4. Verificar instalación, acceso, registro y compras/restauración donde corresponda; confirmar disponibilidad de 2.0.0 para las plataformas distribuidas y revisar adopción en EAS/tiendas. Declarar `MOBILE_RELEASE_READY_VERSION=2.0.0` sólo después. Es una confirmación del operador, no una medida automática de adopción.
5. Antes del corte, ejecutar `MOBILE_ROLLOUT_PHASE=enforced MOBILE_MIN_VERSION=2.0.0 MOBILE_RELEASE_READY_VERSION=2.0.0 npm run release:check -- --before --url=https://mytasklists.online`. Rechaza servidores sin flujo 2, Android sin APK suficiente/ficha publicada e iOS sin ficha/TestFlight. En tiendas la versión/adopción se confirma manualmente; sus enlaces no prueban por sí solos la versión instalada.
6. Establecer esos tres valores en el backend y redesplegar. El arranque rechaza un corte sin fase/confirmación coherentes. Comprobar la configuración efectiva con el mismo comando **sin `--before`**: las apps 1.x reciben 426 antes del login y pueden abrir descargas o la web; la app 2.x continúa.

En GitHub configurar las variables `MOBILE_ROLLOUT_PHASE`, `MOBILE_MIN_VERSION`, `MOBILE_RELEASE_READY_VERSION` y `SITE_URL` con los mismos valores efectivos de Coolify. Los workflows no cambian las variables de Coolify. El workflow móvil usa el environment `production`, igual que el job de deploy. Las credenciales EAS/Coolify siguen siendo secretos. El deploy verifica la política candidata, la disponibilidad antes de enforced y la política efectiva después del deploy.

Para revertir un corte de compatibilidad sin perder datos: volver a `bridge`, mínimo 1.0.0 y confirmación vacía, manteniendo el backend con flujo 2. No volver al backend antiguo: el cliente nuevo depende del registro por correo. Revisar disponibilidad de las rutas y correr `release:check`. No bajar el mínimo de una API que haya retirado otros contratos necesarios para 1.x.

Pruebas locales: `npm run test:rollout`, `e2e/tests/backend/16-coordinacion-movil.spec.ts` y `e2e/tests/mobile/08-coordinacion-backend.spec.ts`. La activación en producción y la publicación de los binarios siguen requiriendo las cuentas/configuración reales; no se ejecutaron desde esta tarea.
