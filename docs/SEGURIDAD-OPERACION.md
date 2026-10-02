# Seguridad y operación

Las fotos se leen con enlaces firmados de 9–10 minutos, ligados a usuario, versión de sesión y archivo. Son permisos temporales: quien copie un enlace válido puede usarlo durante ese intervalo. En cada lectura se consulta la membresía actual y que el producto siga referenciando el archivo. La expulsión, revocación de sesión y eliminación de cuenta cortan el acceso. Las respuestas llevan `private, no-store`; el gateway registra rutas sin parámetros. Web y móvil renuevan las fotos al volver a la pantalla y cada cuatro minutos.

PostgreSQL registra los archivos reemplazados o eliminados en `image_deletions`, incluso al borrar listas o cuentas mediante cascada. El worker reintenta cada cinco segundos; la conciliación revisa el directorio al arrancar y cada hora, con una hora de margen para archivos todavía no asociados. Los errores de disco conservan la tarea pendiente.

Se aceptan como máximo dos cargas de imagen simultáneas por instancia, antes de leer el cuerpo multipart. Cada cuenta propietaria dispone de un techo técnico de 100 MiB (`IMAGE_MAX_BYTES_PER_ACCOUNT`); los bytes se contabilizan sobre JPEG normalizados. Las imágenes de listas compartidas cuentan para quien posee la lista. El techo técnico de listas es 100 y de elementos, incluidos archivados, 2.000 por lista. Son protecciones operativas independientes de los beneficios comerciales aún pendientes de definición.

Las invitaciones tienen cooldown de 60 segundos por remitente/destinatario, máximo 20 envíos por cuenta/hora y 10 recibidos por destinatario/hora, más el throttle por IP. Cancelarlas no reinicia estos contadores. Solo el propietario canónico puede listar o cancelar pendientes. El registro y la cancelación bloquean la fila de invitación para resolver carreras.

El registro y las invitaciones escriben un outbox en su transacción. El contenido se cifra con AES-GCM y `APP_ENCRYPTION_KEY`. El worker reclama una tarea con un lease corto, libera la transacción y envía SMTP; reintenta con espera creciente, verifica que el enlace siga vigente y purga los trabajos al día. La entrega es al menos una vez: un cierre después de aceptar SMTP puede repetir el mismo correo. Una respuesta aceptada significa correo encolado, no entrega confirmada en el buzón.

## Identidades y despliegue

La base sigue el modelo de yunitztech: un único usuario, `POSTGRES_USER/PASSWORD`, propietario de la base. La API lo usa y ejecuta las migraciones al arrancar (`RUN_MIGRATIONS=true`). PostgreSQL y Redis solo están en la red `backend` (`internal: true`) y no publican puertos.

`apps/backend/src/database/run-migrations.ts` y la prueba `SEC-02` corresponden a un rol de aplicación sin privilegios (`APP_DB_USER`). Producción no los usa; quedan como referencia para la revisión pendiente.

`Desplegar` se ejecuta después de `CI` aprobado en main, o manualmente si el SHA ya pasó ese CI. Comprueba la punta actual de main y publica las cinco imágenes con el SHA exacto. Una clave SSH dedicada en `production` (`COOLIFY_RELEASE_SSH_KEY`, `COOLIFY_RELEASE_HOST_KEY`, variable `COOLIFY_RELEASE_HOST`) solo ejecuta `scripts/ops/mytasklists-release.py` mediante comando forzado, sin shell ni forwarding. Este comprueba CI de nuevo y solo cambia `IMAGE_TAG` de MyTaskLists en Coolify. El token existente conserva su permiso de despliegue.

Para rollback se fija explícitamente `IMAGE_TAG` a una revisión anterior validada en Coolify y se redespliega. El comando automático exige la punta de main; un rollback exige la operación administrativa documentada. Las migraciones de esta entrega añaden columnas/tablas y siguen siendo compatibles con la imagen anterior. Nunca reemplazar el volumen PostgreSQL.

## Copias y retención

La política Restic incluye `/var/lib/docker/volumes/*_item-images/_data`, los volcados SQL y `/data/coolify` (incluye descargas de APK). La fuente Ansible está en `infra-ionos-vps/roles/backup/defaults/main.yml`. Retención automática: siete copias diarias, cuatro semanales y seis mensuales. Las fotos borradas dejan de servirse inmediatamente pero pueden persistir en copias hasta caducar la retención; una restauración debe reaplicar las solicitudes de borrado posteriores al snapshot antes de abrir el servicio. Los volcados y los archivos se capturan en caliente; no equivalen a una instantánea atómica de escrituras concurrentes. Para recuperación hay que conciliar las referencias de imágenes con los archivos restaurados.

## Dependencias móviles

`uuid` transitivo de Xcode se fija a 11.1.1 y se valida compilando el APK. `node-forge` 1.4.0 continúa afectado por [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), sin versión corregida publicada al 1 de octubre de 2026. La excepción de herramientas de CI es exacta para ese aviso y caduca el 31 de octubre; otros avisos bloquean CI. No declara corregida la dependencia. El APK directo tiene OTA desactivado. Revisar una publicación corregida antes del vencimiento y ejecutar `node scripts/audit-dependencies.mjs` después de actualizar.

## Pendiente de revisión: aislamiento de red en Coolify

Detectado el 2 de octubre de 2026 y aplazado para revisarlo con calma. Afecta a mytasklists (vps1) y a yunitztech (vps2).

- Coolify 4.3.23 añade la red `<uuid>` de la app, que no es interna, a todos los servicios del compose (`bootstrap/helpers/parsers.php`). No ofrece opción para excluir uno; solo lo evita `network_mode`. Por eso PostgreSQL y Redis comparten red con gateway, frontend, landing y dashboard.
- Coolify conecta Traefik (`coolify-proxy`) a las redes de las apps, incluida `_backend`, aunque sea `internal: true`. En vps2 ese mismo Traefik está conectado también a Coolify, Authelia, Listmonk, Umami y Stalwart.
- Desde internet no hay exposición: 5432, 6379 y 3000 están cerrados, y UFW con `DOCKER-USER` solo admite 80/443 hacia contenedores. El riesgo es interno: un contenedor vecino o Traefik comprometidos llegan por red a PostgreSQL y Redis, y solo los separa la contraseña. Con un único usuario propietario, ese acceso tiene todos los privilegios sobre la base.
- Opciones para evaluar, aplicándolas igual en ambas apps: rol de aplicación sin privilegios (`APP_DB_USER`, ver `run-migrations.ts`); IP fija del backend en `_backend` (`ipv4_address`) y `pg_hba.conf` limitado a esa IP; usuarios ACL en Redis.
