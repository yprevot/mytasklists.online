npm notice run mytasklists@1.0.0 impact
npm notice run node scripts/impact.mjs
## Impacto de los cambios contra `origin/main`

**🔴 Coordinar antes de desplegar** · 157 archivos

| Qué | Cómo se publica | Afectado |
| --- | --- | --- |
| backend | Deploy de servicios (Docker) | 34 archivos |
| frontend | Deploy de servicios (Docker) | 21 archivos |
| dashboard | Deploy de servicios (Docker) | 8 archivos |
| landing | Deploy de servicios (Docker) | 14 archivos |
| app móvil | Build nuevo y revisión de App Store / Google Play | 17 archivos |
| contrato | Lo usan todos los anteriores | incompatible (aprobado) |

### Qué revisar

- 🔴 Cambio incompatible aprobado (contrato 1.0.0 → 2.0.0). Orden obligatorio: publicar la app que ya no usa lo retirado, esperar su adopción, subir MOBILE_MIN_VERSION y después desplegar el backend.
- 🟡 Migraciones de base de datos (2). Deben funcionar con el backend anterior mientras conviven: agrega columnas nullable o con valor por defecto y no borres ni renombres en el mismo despliegue.
- 🟡 Cambios en tiempo real: conserva los eventos y campos que escuchan las apps publicadas.
- 🟡 La app móvil necesita un build nuevo para las tiendas (app.json, eas.json, package-lock.json, package.json, app.config.js, metro.config.js). Las personas actualizan cuando quieren: el backend debe seguir atendiendo a la versión anterior.
