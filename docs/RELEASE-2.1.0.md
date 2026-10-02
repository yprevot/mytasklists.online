# MyTaskLists 2.1.0 — invitaciones, edición e imágenes

## Comportamiento

- La persona propietaria puede compartir una lista con un correo sin cuenta. Se envía un enlace de registro; al crear una cuenta con ese correo verificado, se aceptan las invitaciones pendientes que no hayan vencido. Las invitaciones duran 72 horas. Los roles editor y lector se conservan; compartir no transfiere la propiedad.
- Web y móvil editan nombre, cantidad, unidad, nota y recurrencia de elementos pendientes y comprados. Abrir el editor carga siempre el elemento seleccionado.
- Web adjunta archivos; móvil permite galería y cámara. JPEG, PNG y WebP válidos de hasta 5 MB se convierten a JPEG de hasta 1600 px por lado, sin metadatos. Los archivos anteriores se eliminan al reemplazar/quitar la imagen o borrar la lista/elemento.
- Se invalidan la caché y los clientes conectados cuando una invitación se acepta. Los cambios de imágenes escriben únicamente su campo y no sobrescriben una edición concurrente.

## Distribución y despliegue

- Android: versión 2.1.0, versionCode 2, APK release firmado con la misma clave privada de 2.0.0, API/socket HTTPS de producción y actualizaciones Expo desactivadas. `node scripts/build-android-direct.mjs` publica el APK y su manifiesto local; copiar el APK inmutable al servidor antes de cambiar `android.json` de forma atómica. La landing obtiene la versión y descarga desde `/api/distribution`.
- iPhone/iPad: aplicación web instalable desde Safari. No hay IPA distribuible para usuarios sin una cuenta Apple Developer y el canal/perfil de firma correspondiente; no se publica un archivo que simule instalación.
- La migración `1740000000000` agrega `list_items.image_key` y el índice de invitaciones pendientes. No elimina datos existentes. El volumen `item-images` se monta en `/app/uploads/items` en desarrollo y producción. Debe incluirse en las copias de seguridad junto a PostgreSQL; un volcado SQL no contiene las fotos.
- Mantener `MOBILE_ROLLOUT_PHASE=bridge` y mínimo 1.0.0. Los clientes anteriores conservan login/listas y omiten el nuevo campo de imagen. Los pagos siguen dependiendo de la configuración comercial existente.

## Pruebas

- API: `e2e/tests/backend/17-invitaciones-edicion-imagenes.spec.ts` cubre invitación/registro/acceso inmediato, roles, edición comprada, imágenes reales, sustitución/eliminación, archivos dañados, tamaño y edición concurrente.
- Web: `e2e/tests/frontend/11-edicion-imagenes-invitacion.spec.ts` comprueba registro desde la invitación, edición pendiente/comprada, imagen visible y persistencia después de recargar.
- Móvil (React Native Web): `e2e/tests/mobile/09-edicion-imagenes.spec.ts` comprueba carga correcta del editor al cambiar de elemento, guardar en comprados y subir desde galería con un Blob real.
- Ejecutar la suite completa con `npm run test:e2e` contra la pila local y Mailpit. Si el puerto 8025 está ocupado: `MAILPIT_UI_PORT=8026` al iniciar Docker y `E2E_MAILPIT_URL=http://localhost:8026` al lanzar Playwright.
- La exportación web y las pruebas de navegador no acreditan cámara ni instalación física; comprobar además el APK instalado en Android y registrar por separado emulador/dispositivo real.
