# Implementación del plan de registro, SEO, unidades y pagos

Fecha: 1 de octubre de 2026. Entorno de validación: Docker local en http://localhost:8080 y Mailpit en http://localhost:8025. No se ha desplegado en producción ni enviado correos a direcciones reales.

## Cambios entregados

1. La landing usa **Ingresar**, enlazado al inicio de sesión. Añade navegación a precios y descargas.
2. HTML independiente en español e inglés, títulos y descripciones, canonical, hreflang, Open Graph, Twitter, imagen social, JSON-LD SoftwareApplication, sitemap y robots. Las páginas privadas no se indexan. Las rutas públicas inexistentes responden 404. `LANDING_NOINDEX=true` genera HTML noindex y robots cerrado para staging.
3. El registro empieza con el correo: comprobación de duplicados, respuesta neutral, enlace de 30 minutos por defecto, token aleatorio guardado como hash, reenvío con cooldown/límite por hora y consumo único con transacción. El correo del enlace es inmutable; el segundo paso pide nombre, WhatsApp y dos contraseñas. El usuario se crea verificado únicamente al completar ese paso. El token viaja en el fragmento y se retira de la URL. SMTP debe aceptar el mensaje antes de sustituir el token anterior. El registro antiguo queda cerrado (426); Google/Apple conservan su flujo existente.
4. Web y React Native comparten unidades: unidades, libras, kg, gramos, litros, ml, onzas y personalizado. Cantidad decimal, coma/punto, unidad propia obligatoria de hasta 20 caracteres. La API conserva códigos existentes y la recurrencia.
5. Página de descargas con alternativas siempre visibles. Enlaces de tienda sólo si están declarados publicados; comprobación servidor de 404/410 con caché de 10 minutos. Android directo requiere APK firmado publicado mediante `scripts/publish-apk.mjs`: apksigner, versión inmutable, manifiesto atómico, tamaño y SHA-256 verificado por el servidor. Sin archivo real, se indica que todavía no está disponible. iOS ofrece web con manifiesto/iconos instalables y TestFlight configurable; no simula una instalación mediante IPA.
6. Gratis y Premium de **5 USD/mes**. Stripe Checkout/Portal para web y Android directo; Expo IAP para App Store/Google Play. Validación autoritativa del servidor, vinculación a cuenta, notificaciones verificadas, reconciliación cada 15 minutos, cancelación/restauración y límites configurables. No se concede Premium por un redirect o un precio enviado por el cliente. Los descuentos cambiados expiran el checkout anterior; se reutiliza únicamente el mismo código confirmado. El borrado de cuenta exige resolver la suscripción y cualquier checkout pendiente.
7. Código promocional en web y APK directo: porcentaje o importe fijo USD, duración, caducidad, restricciones y máximo de usos administrados en Stripe; el total se confirma antes de pagar. Panel administrativo con MFA para creación/desactivación y bitácora. En tiendas, códigos/ofertas nativos: Google utiliza oferta elegible y token de tienda; Apple su hoja de canje. Un código Stripe no habilita Premium en una tienda.

## Configuración comercial pendiente

Stripe es la preferencia del propietario para México, USA y Canadá. Su disponibilidad incluye estos países: https://stripe.com/global. Falta confirmar el país de la entidad que cobrará y los beneficios/límites de Gratis/Premium. No se han inventado restricciones para los usuarios existentes.

Copiar únicamente los valores necesarios de `.env.example` al gestor de secretos. Para Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (500 centavos USD, mensual, activo), `STRIPE_WEBHOOK_SECRET`, `BILLING_MODE`. Configurar `BILLING_BENEFITS_ES/EN`, los límites opcionales y `BILLING_COMMERCE_READY=true`; entonces `BILLING_ENABLED=true`. Usar sandbox primero. `STRIPE_AUTOMATIC_TAX` debe activarse sólo tras configurar impuestos en la cuenta. Configurar Portal, productos, política de impuestos y cancelación antes de abrir cobros.

Webhooks: `/api/billing/webhook/stripe`, `/api/billing/webhook/apple`, `/api/billing/webhook/google` (ver rutas del controlador antes de registrar). Apple necesita claves del servidor, identificadores de app/producto y certificados raíz disponibles dentro del contenedor; Google necesita cuenta de servicio, producto, base plan (`GOOGLE_BASE_PLAN_ID`, por defecto `monthly`), paquete y OIDC de Pub/Sub. Los certificados Apple se montan como archivos, nunca se guardan claves en el repositorio.

Descargas: `eas build --platform android --profile direct` desde `apps/mobile` requiere cuenta EAS y firma. Publicar el resultado firmado: `APKSIGNER=/ruta/build-tools/apksigner node scripts/publish-apk.mjs /ruta/release.apk 2.0.0`. La carpeta `downloads/` se monta sólo lectura en backend y landing. Declarar enlaces de tienda publicados solamente al existir su ficha. iOS puede configurarse con `IOS_TESTFLIGHT_URL`; validar la instalación web en dispositivos reales.

## Restricciones de compatibilidad y despliegue

Contrato mayor **2.0.0** y `behavior.json.registrationFlow=2`: no es compatible con clientes antiguos que llaman `/auth/register`. La coordinación está implementada en [COMPATIBILIDAD.md](COMPATIBILIDAD.md#coordinación-del-registro-por-correo-flujo-2): backend primero en `bridge` con mínimo 1.0.0, después cliente 2.0.0, confirmación de disponibilidad/adopción y finalmente `enforced` con mínimo 2.0.0. El registro antiguo nunca crea cuentas sin validar; en bridge sólo ese flujo pide actualizar, mientras login/listas continúan. No se realizó el corte ni la publicación en producción. Los cambios Expo IAP y Picker requieren binario nativo nuevo; no son una actualización OTA. Las migraciones son aditivas; no se elimina información ni se resetea la base. Antes de aplicar el índice único de correo normalizado, comprobar duplicados con `SELECT lower(trim(email)), count(*) FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1;`. Si aparecen, resolver la titularidad y conservar sus datos antes de migrar; no hay deduplicación destructiva automática.

Recrear imágenes para aplicar dependencias/migraciones; configurar `LANDING_PUBLIC_URL` al construir la landing para su dominio definitivo. En producción las imágenes son preconstruidas. Revisar `npm run impact` y `npm run contract:check`, respaldo y orden de despliegue documentado en `docs/COMPATIBILIDAD.md`.

## Pruebas y evidencia

El catálogo diseñado de 103 casos permanece en `PLAN-MEJORAS-REGISTRO-SEO-UNIDADES.md`; no equivale a 103 casos nuevos automatizados ni a pruebas del proveedor. Los nuevos escenarios están en `e2e/tests/backend/15-registro-previo-billing.spec.ts`, `e2e/tests/frontend/10-mejoras-registro-unidades-precios.spec.ts` y `e2e/tests/landing/02-seo-precios-descargas.spec.ts`. Se actualizó la regresión existente para la verificación previa y unidades.

`node --test scripts/test-registration-billing.cjs` y `node --test scripts/test-distribution.cjs` requieren primero compilar backend; utiliza dobles locales del proveedor y valida descuentos, checkout pendiente, cambio de precio, token consumido/expirado y fallo SMTP. No sustituyen las pruebas sandbox. `node --experimental-strip-types --test scripts/test-mobile-offers.cjs` valida la selección del plan mensual y sus ofertas; la selección sigue la especificación de OpenIAP: https://www.openiap.dev/docs/features/subscription.

Pendientes externos: entrega SMTP real/DNS, Stripe sandbox y live (incluidos SCA, reembolsos, impuestos y renovación), ofertas/productos y notificaciones de tiendas, compras/restauración en dispositivos físicos, APK firmado real, Search Console y rastreo/indexación en el dominio público. La integración no promete posicionamiento ni disponibilidad en tiendas.

La auditoría npm local móvil y la base anterior detectan los mismos 11 avisos moderados en la cadena de herramientas Expo/xcode/uuid. La propuesta automática implica degradar Expo a versiones antiguas; no se aplicó `--force`. La auditoría del workspace raíz detectó cero vulnerabilidades.

Resultados finales y capturas: [qa-artifacts/RESULTADOS.md](../qa-artifacts/RESULTADOS.md).
