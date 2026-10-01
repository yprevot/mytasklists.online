# Validación local — 1 de octubre de 2026

Docker en http://localhost:8080; Mailpit en http://localhost:8025. Chromium/Playwright, sin dispositivos físicos ni cuentas de pago habilitadas.

| Servicio | Casos aprobados | Evidencia |
| --- | ---: | --- |
| API, regresión completa | 103/103 | backend-results.json |
| API, comprobación posterior de cambios | 19/19 | backend-delta-results.json |
| Web, regresión completa | 42/42 | frontend-results.json |
| Web, recorrido Premium y nuevos escenarios | 4/4 | frontend-delta-results.json |
| Landing ES/EN, precios, SEO y descargas | 18/18 | landing-results.json |
| React Native ejecutado en web | 19/19 | mobile-results.json |
| Administración | 16/16 | dashboard-results.json |
| Lógica de registro, cobros y distribución | 12/12 | backend-unit.tap |
| Selección de ofertas nativas | 2/2 | mobile-offers-unit.tap |

199 casos de integración distintos aprobados; las comprobaciones posteriores repiten casos salvo el recorrido Premium añadido. 14 pruebas de lógica con dobles locales. Cero fallos en las ejecuciones finales. El catálogo de 103 casos de diseño del plan es distinto de los 103 casos de la suite API; no implica que todas las integraciones externas estén probadas.

Typecheck de backend/web/panel/móvil, imágenes Docker, nginx -t, contrato 2.0.0 y git diff --check: aprobados. Exportación Expo web/Android/iOS: aprobada (bundles JavaScript/Hermes; no APK/IPA firmado). Robots y HTML noindex de staging comprobados; builds públicos restituidos. Revisión visual de precios en escritorio y descargas/registro/plan a 390 px; sin overflow horizontal. Detección mecánica de UI sin hallazgos en los archivos escaneados.

Auditoría npm raíz: 0 vulnerabilidades. Móvil: 11 moderadas, iguales a la base anterior, en la cadena Expo/xcode/uuid; ninguna alta/crítica. No se aplicó una degradación forzada de Expo.

Capturas: landing.png, precios.png, descargas.png, registro.png, plan.png. Las estadísticas JSON excluyen la configuración del proceso y adjuntos para no conservar datos sensibles. Los videos de Playwright se generan en e2e/evidence/ (ignorado por git).

Pendiente fuera de este entorno: SMTP real y DNS, cuentas/productos/impuestos Stripe, compras sandbox/live, App Store/Play y ofertas nativas, notificaciones reales, firma/publicación del APK, instalación y compras en dispositivos físicos, Search Console/indexación pública y despliegue coordinado. Falta la decisión comercial sobre beneficios/límites y país de la entidad que cobrará.
