# Plan: acceso, SEO, registro, unidades, descargas, suscripciones y promociones

Fecha: 2026-10-01. Estado: propuesta de implementación; los casos siguientes están diseñados, no implementados ni ejecutados.

Ampliación: incluye los requisitos 5 (distribución fuera de tiendas), 6 (Gratis y 5 USD/mes, pagos web/móvil), 7 (códigos promocionales) y 8 (edición sin conexión y sincronización). Especificar una integración en este documento no implica que haya cuentas comerciales, binarios publicados ni cobros activados.

## 1. Alcance y diagnóstico

Revisión del código local; no constituye auditoría de producción, indexación en Google ni entrega real del SMTP.

| Área | Evidencia local | Cambio requerido |
| --- | --- | --- |
| Acceso | `apps/landing/src/index.html`, `privacidad.html` y `terminos.html` usan «Abrir app web»; `i18n.js` usa «Open web app» | Unificar como «Ingresar» / «Sign in» y dirigir al inicio de sesión |
| SEO | `index.html` ya incluye title, description y Open Graph parcial; `i18n.js` traduce en el navegador | Completar metadatos, páginas indexables por idioma, contenido y descubrimiento |
| Rutas públicas | `apps/landing/nginx.conf` devuelve `index.html` como fallback | Evitar que rutas inexistentes respondan como landing válida con HTTP 200 |
| Registro | `auth.service.ts:register` crea usuario, envía verificación y emite sesión | Verificar posesión del correo antes de crear usuario o sesión |
| Correo | `MailService.sendInBackground` captura el error; sin SMTP se escribe el mensaje en logs | El nuevo flujo debe detectar fallos y no registrar enlaces secretos en logs |
| Unidades | `AddItemForm.tsx` usa texto libre; backend guarda `unit` de hasta 20 caracteres y cantidad decimal | Selector con valores conocidos y opción personalizada; conservar datos existentes |
| Compatibilidad | `packages/contracts`, clientes web/móvil y `e2e/utils/api-helpers.ts` dependen del registro directo | Adaptar contrato, clientes, fixtures y publicación coordinadamente |
| Distribución | El usuario confirma que la app no está publicada en App Store ni Google Play; `eas.json` tiene APK de preview, no un canal público de descarga configurado | Añadir página de descargas y artefactos release firmados; alternativa viable para iOS |
| Pagos | No se identifica integración de compras/suscripciones en las dependencias móviles revisadas | Diseñar facturación, permisos por plan y adaptadores de cobro web/tiendas |

Supuestos de producto: WhatsApp obligatorio como en el formulario actual; Google/Apple conservan su flujo; cambios funcionales de registro y unidades en web y móvil. Se mantiene el sistema visual de `DESIGN.md`, con etiquetas visibles, navegación por teclado y mensajes ES/EN. No se añade verificación de WhatsApp: validar su formato no demuestra que el número tenga una cuenta de WhatsApp.

## 2. P01 — Acción «Ingresar»

1. Sustituir la etiqueta en navegación, enlaces equivalentes y páginas legales de ambos idiomas.
2. Usar destino explícito `/app/login`, construido a partir de la URL configurada de la app para admitir dominios separados.
3. Con sesión vigente, la app resuelve la navegación hacia las listas; sin sesión, muestra el login. La landing no necesita consultar cookies privadas para decidir la etiqueta.
4. Conservar las acciones de descarga y diferenciar «Crear cuenta» donde corresponda.

Aceptación: todos los accesos equivalentes muestran «Ingresar» o «Sign in»; funcionan en escritorio, móvil y páginas legales; no hay bucles al tener sesión.

## 3. P02 — SEO de la landing

### Contenido y HTML

- Enfocar título, H1 y texto en «listas de compras compartidas», «lista del supermercado» y «productos recurrentes», usando términos naturales y funciones reales. Son hipótesis iniciales de búsqueda, no palabras con volumen medido.
- Mantener una jerarquía clara de encabezados y desarrollar cómo funciona, compras familiares, recurrencia y preguntas frecuentes útiles. Revisar las afirmaciones de disponibilidad en tiendas contra enlaces reales antes de publicarlas.
- Preparar title y description propios por página e idioma, canonical absoluta, `lang`, Open Graph completo, imagen social de 1200 × 630 con texto alternativo y Twitter Card. No añadir `meta keywords`.
- Añadir JSON-LD de `WebSite` y `SoftwareApplication` con datos comprobados y acordes al contenido visible. Omitir precios, valoraciones, descargas y organización que no estén documentados. Validar el JSON-LD en el DOM renderizado y con las herramientas de Google.

### Idiomas y descubrimiento

- Conservar `/` como landing española y generar `/en/` con contenido inglés completo en HTML estático, incluidos los metadatos. No hace falta cambiar de framework.
- Cada idioma tendrá canonical propia y enlaces `hreflang` recíprocos `es`, `en` y `x-default` hacia `/`. El selector de idioma será un enlace real; la preferencia guardada no debe sustituir el idioma del documento servido bajo una URL.
- Ajustar `build.mjs` para generar subdirectorios, sustituir variables recursivamente y usar rutas de recursos que funcionen desde `/en/`. Mantener las rutas legales existentes y sus equivalencias de idioma.
- Generar `sitemap.xml` con URLs públicas, canónicas, indexables y HTTP 200; incluir `lastmod` solo cuando corresponda a una modificación real.
- Publicar `robots.txt` con referencia al sitemap y acceso a los recursos necesarios. Excluir app, dashboard, API y rutas con tokens del sitemap. Aplicar `noindex` a superficies privadas/autenticación; no confiar en robots.txt como control de acceso ni bloquear el rastreo de una página de la que Google deba leer `noindex`.
- Unificar HTTPS y dominio canónico, redirigir duplicados y devolver 404 real para rutas públicas inexistentes. Mantener el fallback de las SPA limitado a `/app/` y `/dashboard/`.
- Configurar entornos de prueba como no indexables, sin trasladar esa configuración a producción.

### Rendimiento y seguimiento

- Medir antes y después con Lighthouse/PageSpeed; revisar fuentes locales, imágenes optimizadas, dimensiones reservadas, carga diferida bajo el primer pantallazo y JavaScript innecesario.
- Objetivos de experiencia: LCP ≤ 2,5 s, CLS ≤ 0,1 e INP ≤ 200 ms en el percentil 75 cuando exista suficiente información de usuarios reales. Separar estas métricas de los resultados de laboratorio.
- Verificar propiedad en Google Search Console y Bing Webmaster Tools, enviar sitemap e inspeccionar las dos landings. Registrar línea base de cobertura, impresiones, clics y consultas; revisar a las 2–4 semanas y después periódicamente.
- Acceso a Search Console/DNS y métricas de producción son dependencias externas para la implementación; el repositorio no prueba su disponibilidad.

Aceptación: HTML útil sin JavaScript en ambos idiomas; metadatos y enlaces correctos; sitemap/robots con contenido y MIME correctos; 404 real; ninguna URL privada o con token en sitemap; informe de rendimiento y comprobación posterior en producción.

## 4. P03 — Registro después de validar el correo

### Recorrido de la persona

1. «Crear cuenta» abre una pantalla que solicita únicamente correo electrónico.
2. Backend normaliza espacios externos y mayúsculas, valida formato y longitud, y consulta si existe en cualquier tipo de cuenta, incluidas cuentas sociales o desactivadas. No elimina puntos ni sufijos `+`.
3. Si existe, no envía un enlace de alta ni crea otra cuenta. La respuesta pública será neutral para evitar revelar qué direcciones tienen cuenta: «Si puedes registrarte con este correo, recibirás un enlace para continuar. Si ya tienes cuenta, ingresa o recupera tu contraseña».
4. Si no existe, prepara una solicitud temporal y envía un enlace al correo. Todavía no crea usuario, contraseña ni sesión. Mostrar «Revisa tu correo», opción de corregir dirección y reenvío con espera visible.
5. El enlace abre `/app/register/complete#token=…`. Se valida el token antes de mostrar el formulario. El correo verificado aparece de solo lectura; cambiarlo exige iniciar otra solicitud.
6. Pedir nombre completo, WhatsApp, contraseña y confirmar contraseña. Validar en cliente y servidor. Permitir mostrar/ocultar ambas contraseñas, pegado y gestores de contraseñas.
7. Al enviar correctamente, crear una sola cuenta con `emailVerified=true`, consumir el enlace y emitir la sesión con el mecanismo actual. Navegar a las listas. Si falla la emisión de sesión después de crear la cuenta, indicar que ya puede ingresar; nunca duplicar el alta.

### Contrato y persistencia propuestos

Agregar tipos nuevos en `packages/contracts` y DTO en backend:

| Endpoint propuesto | Datos | Resultado |
| --- | --- | --- |
| `POST /api/auth/registration/request` | `email`, idioma admitido | Respuesta neutral; petición limitada por correo e IP |
| `POST /api/auth/registration/validate` | `token` | Solo correo asociado y vigencia; no consume ni crea sesión |
| `POST /api/auth/registration/complete` | `token`, `fullName`, `whatsapp`, `password`, `passwordConfirmation` | Usuario verificado y sesión; correo derivado exclusivamente del token |

Crear entidad y migración aditivas para solicitudes: identificador, correo normalizado, hash del token, idioma, fechas de creación/caducidad/consumo/revocación y estado de envío. No guardar contraseñas en esta tabla. Limpiar solicitudes expiradas según retención configurada.

Usar token aleatorio criptográfico de al menos 32 bytes; almacenar solo su hash para validación, separado de los tokens de recuperación o de verificación de cuentas anteriores. Vigencia propuesta: 30 minutos. Reenvío: espera de 60 segundos, máximo inicial de 5 por correo/hora y 20 por IP/hora, configurables y revisables con uso real. Evitar que diferencias de respuesta, tiempos o límites revelen cuentas existentes.

La creación del usuario y el consumo del token se ejecutan en una transacción PostgreSQL, con bloqueo de la solicitud y restricción única del correo normalizado. Revisar esa restricción y posibles duplicados antes de migrar. Revalidar que no exista cuenta al completar: pudo crearse entre el envío y el clic. Dos peticiones simultáneas no pueden crear dos cuentas ni emitir dos altas.

Validar campos antes de consumir el token. Un error corregible de formulario no inutiliza el enlace. Una visita o previsualización del correo tampoco lo consume. El token permanece válido hasta completar, expirar o ser sustituido por un reenvío exitoso.

### Entrega del correo y errores

- Reutilizar Nodemailer y plantillas ES/EN con enlace HTTPS construido desde configuración confiable, no desde `Host` ni una URL enviada por el cliente.
- Para este flujo, esperar aceptación SMTP con timeout; no usar un envío en segundo plano que silencie fallos. No confundir aceptación SMTP con entrega en bandeja de entrada.
- En un reenvío, mantener el enlace anterior hasta que el nuevo envío sea aceptado; activar el nuevo e invalidar el anterior con serialización por correo. Documentar y recuperar el caso de aceptación SMTP seguida de fallo de persistencia: un reintento debe permitir obtener un enlace válido, sin crear cuentas.
- Si falla SMTP, invalidar el nuevo intento, permitir reintento controlado y mostrar un error temporal sin crear usuario. Hacer consistente la señal de indisponibilidad del servicio de correo para no convertir errores en consultas de existencia de cuentas.
- SMTP es requisito del registro en producción. En desarrollo usar Mailpit. No considerar «correo escrito en logs» un envío válido; quitar tokens, contraseñas y cuerpos de correo de logs, trazas y evidencia de pruebas.
- Leer el fragmento del enlace, retirarlo de la barra de direcciones y mantenerlo temporalmente en memoria; si se recarga tras retirarlo, pedir reabrir el correo. Enviar el token al backend en cuerpo POST, nunca en query ni telemetría. Aplicar `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y ausencia de scripts analíticos en esa pantalla.
- Nombre: conservar límites 3–160 caracteres tras trim. Contraseña: conservar por ahora política 8–128 y exigir igualdad exacta, sin trim; revisar el límite real en bytes del algoritmo bcrypt antes de aceptar contraseñas largas, evitando truncamiento silencioso. WhatsApp: validar formato internacional de forma consistente en cliente/servidor; mostrar ejemplo y prefijo de país.

### Cuentas anteriores y app móvil

- Usuarios existentes conservan acceso y estado de verificación. Mantener temporalmente `/verify-email` y su reenvío para cuentas antiguas; distinguirlos de la nueva solicitud sin cuenta.
- Google/Apple conservan la validación del proveedor y las protecciones actuales de vinculación; un alta local no puede reclamar un correo ya registrado por esas vías.
- Actualizar `RegisterScreen`, navegación, cliente API y traducciones. Primera versión propuesta: la solicitud puede iniciarse en móvil y el enlace completa el alta en la web responsive; después la persona ingresa en la app. No prometer apertura nativa del enlace sin implementar y probar universal/app links.
- Publicar clientes compatibles antes de activar obligatoriamente el flujo; coordinar versión mínima y la puerta de actualización descritas en `docs/COMPATIBILIDAD.md`.
- Al activar, el antiguo `POST /auth/register` deja de crear cuentas y devuelve un error de flujo actualizado que oriente al cliente; conservar el endpoint durante transición no debe permitir eludir la verificación. Adaptar OpenAPI, informe de impacto y reglas de compatibilidad de CI de forma explícita.
- Actualizar `registerUser` para solicitar el correo, leer Mailpit y completar con token. Las pruebas no deben introducir un bypass del requisito en producción.

Aceptación: ninguna cuenta local nueva ni sesión antes de poseer un token válido; ninguna contraseña sin confirmar; correo inmutable; reuso y carreras bloqueados; errores recuperables; web y móvil compatibles; flujo anterior sin vía alternativa de alta.

## 5. P04 — Selector de unidades

Usar un select con etiqueta «Unidad», valor inicial «Unidades» y catálogo inicial:

| Etiqueta ES | Valor guardado |
| --- | --- |
| Unidades | `pza` |
| Libras | `lb` |
| Kilogramos | `kg` |
| Gramos | `g` |
| Litros | `l` |
| Mililitros | `ml` |
| Onzas | `oz` |
| Personalizado… | Texto introducido por la persona |

Conservar `pza` como código interno evita reescribir datos y mantiene clientes anteriores; la etiqueta visible será «Unidades» / «Units». Los demás códigos se traducen al presentarlos. El selector no convierte cantidades entre sistemas.

- Al elegir «Personalizado…», mostrar y enfocar «Nombre de la unidad», obligatorio de 1–20 caracteres tras trim, por ejemplo «bolsas» o «manojos». Nunca guardar el valor marcador `custom` ni la etiqueta «Personalizado».
- Mostrar cantidad y unidad juntas en el formulario y en cada elemento; conservar dos decimales y límites actuales 0,01–99999. Una entrada vacía, cero o inválida debe producir un error, no transformarse silenciosamente en 1. Admitir entrada decimal coherente con el idioma y normalizarla para la API.
- Mantener el contrato `unit: string`: validar y normalizar el texto en altas y actualizaciones del backend. Las unidades históricas desconocidas se muestran como personalizadas conservando su texto; no reinterpretarlas automáticamente.
- Aplicar en web y móvil y en cualquier formulario existente de edición. Alinear opciones/códigos mediante un catálogo sin convertir accidentalmente el paquete actual de contratos `.d.ts` en una dependencia de ejecución.
- Después de guardar correctamente, reiniciar cantidad a 1 y unidad a Unidades; después de un fallo, conservar los datos para corregir o reintentar.
- Verificar que sincronización en tiempo real, compra, reactivación recurrente y clientes anteriores mantienen cantidad y unidad.

Aceptación: selector accesible; predeterminado correcto; todas las opciones persisten; personalizado obligatorio y legible; sin pérdida de unidades anteriores ni alteraciones de cantidad.

## 6. P05 — Descarga cuando la app no está disponible en tiendas

### Experiencia de descarga

1. Crear `/descargar/` y `/en/download/`, enlazadas desde landing, precios y navegación. Mostrar Android, iPhone/iPad y web; detectar plataforma solo para priorizar opciones, manteniendo selección manual.
2. Mientras las fichas no estén publicadas, mostrar directamente las alternativas disponibles. No anunciar «Disponible en App Store/Google Play» ni enviar a una ficha inexistente.
3. Mantener un manifiesto de versiones bajo control del servidor: plataforma, canal, estado de publicación, URL de tienda, versión, fecha de comprobación, regiones conocidas y artefacto alternativo. Estado inicial de tiendas: `not_published`, según lo indicado por el usuario.
4. Cuando exista ficha publicada y verificada, ofrecer «Ir a la tienda» y mantener visible la alternativa «¿No está disponible en tu región?». Abrir la tienda sin perder la página de descargas.
5. Si el estado es no publicado/no disponible, presentar descarga directa para Android y opciones válidas para iOS. Si la comprobación falla por timeout o bloqueo, marcar estado desconocido; no confundir un fallo de red con una app retirada.

No se puede detectar de forma fiable desde nuestra página el resultado de una navegación a una tienda de otro dominio o a la app nativa de la tienda. Se implementará el fallback antes de la navegación mediante configuración y comprobación periódica desde servidor, más una alternativa visible al volver. Un HTTP 200 tampoco prueba disponibilidad de la ficha en todas las regiones. Las comprobaciones usarán destinos permitidos y timeout, sin aceptar URLs arbitrarias del visitante.

### Android: archivo descargable desde nuestro servidor

- Generar un APK **release firmado**, instalable sin Expo Go, con backend de producción y un perfil EAS separado para distribución directa. No publicar el APK de desarrollo/preview actual ni un AAB como si fuera instalable directamente.
- Hospedar artefactos versionados, por ejemplo `/downloads/android/mytasklists-<version>.apk`, en almacenamiento persistente servido por HTTPS desde el dominio. Publicar versión, tamaño, fecha, Android mínimo y SHA-256.
- Verificar firma, integridad y arranque antes de actualizar atómicamente el manifiesto de última versión. Mantener claves de firma fuera del repositorio y conservar el certificado para futuras actualizaciones.
- Servir MIME y `Content-Disposition` correctos, soportar descargas interrumpidas/rangos y evitar que nginx responda HTML de la landing cuando falte el archivo. Ante 404, mostrar estado recuperable y acceso a la web.
- Incluir instrucciones breves para autorizar instalación desde el navegador según Android; no solicitar desactivar Play Protect. Revisar verificación de desarrollador/registro de paquetes exigidos por Android según región y fecha de lanzamiento.
- Planificar actualización del APK y continuidad de firma con la futura versión de Google Play. Verificar compatibilidad con Play App Signing antes de prometer actualización entre canales; si no es compatible, documentar la transición sin perder los datos de cuenta.

### iPhone/iPad: límites y alternativa instalable

Un IPA alojado en el servidor no es una descarga instalable universal para usuarios de iPhone. La distribución web nativa de Apple exige territorios, autorización, firma y requisitos específicos; no se asume que este proyecto sea elegible. No usar distribución Enterprise/Ad Hoc como distribución pública a consumidores.

- Alternativa inicial propuesta: preparar la app web como PWA y mostrar «Añadir a pantalla de inicio», con instrucciones para iOS y opción «Ingresar desde el navegador».
- Incluir manifest, iconos, `start_url`/scope bajo `/app/`, modo standalone, HTTPS y estrategia de actualización. Si se incorpora service worker, limitarlo al shell público, no cachear respuestas autenticadas ni pagos, y mostrar estado sin conexión; la edición offline y sincronización se implementan explícitamente en P08; no prometer push sin implementarlo.
- Si existe una beta TestFlight aprobada y con cupo, ofrecer «Probar beta en TestFlight», claramente identificada como beta. Nunca mostrar un enlace ficticio; TestFlight no sustituye la distribución comercial permanente.
- Añadir descarga nativa directa iOS solo como fase condicionada a elegibilidad y aprobación reales. La PWA es una alternativa funcional, no debe presentarse como el mismo binario nativo.

Aceptación: con ambas tiendas no publicadas, Android descarga e instala un APK real desde el servidor e iOS puede usar/añadir la web a inicio; no hay botones rotos ni promesas de instalación nativa no soportada. La instalación se valida en dispositivos reales, además de las comprobaciones HTTP.

## 7. P06 — Página de precios y pagos web/móviles

### Oferta comercial y recorrido

Crear `/precios/` y `/en/pricing/`, con enlaces desde landing y app, FAQ de facturación, comparación y dos opciones:

| Plan | Precio solicitado | Acción |
| --- | --- | --- |
| Gratis | 0 USD, sin tarjeta | Crear cuenta gratis / Continuar gratis |
| Premium (nombre propuesto) | 5 USD al mes, renovación mensual | Elegir Premium / Administrar suscripción si ya está contratado |

El precio web base se guarda como `500` centavos USD en configuración del servidor/proveedor. No es pago por descarga: el APK/PWA se puede instalar gratis y el acceso depende de la cuenta. En tiendas, configurar precio base USD equivalente cuando esté disponible y mostrar el precio localizado que devuelva la tienda; no sustituir automáticamente 5,00 por 4,99 ni prometer cobros en USD en todas las regiones. Definir tratamiento de impuestos antes de publicar; mostrar moneda, impuestos aplicables, importe final, periodicidad y renovación antes de confirmar.

Está pendiente decidir la diferencia funcional entre planes. Propuesta para revisión: ambos conservan listas compartidas, recurrencia y unidades; Gratis tendrá límites de uso y Premium límites ampliados. **No se fijan cantidades ni se anuncian capacidades ilimitadas sin decisión del propietario.** Definir también si los límites de una lista compartida corresponden a su dueño o a cada integrante; propuesta: límites de creación/capacidad según dueño, sin exigir pago a cada invitado por colaborar.

Recorrido: elegir plan → ingresar o verificar correo y registrarse → recuperar selección → introducir promoción opcional → revisar importe/renovación → pagar → comprobar estado en servidor → activar Premium. El alta inicial puede quedar Gratis mientras el pago está pendiente. No cobrar a una persona sin vincular la operación a su cuenta verificada. Si inicia el registro desde precios, P03 conserva de forma segura la intención de plan y vuelve a este recorrido, en vez de navegar siempre a las listas.

### Canales de pago

| Canal de distribución | Integración propuesta | Condición |
| --- | --- | --- |
| Web de escritorio, navegador móvil y PWA | Stripe Checkout + Billing, con portal de cliente | Sujeto a país/cuenta comercial compatibles; tarjetas y wallets disponibles para ese cliente |
| APK Android descargado desde nuestro servidor | Checkout web seguro abierto en navegador del sistema, con retorno a app | Variante de distribución directa y confirmación en backend; no activar por detectar simplemente «Android» |
| App publicada en Google Play | Google Play Billing para suscripción digital mensual | Producto/base plan configurados; validación servidor, reconocimiento de compras y RTDN |
| App publicada en App Store | StoreKit para suscripción autorrenovable mensual | Producto configurado; validación servidor y App Store Server Notifications |

Stripe es una propuesta, no una pasarela ya seleccionada o contratada. Confirmar país de la entidad que cobra y cuenta comercial; PayPal podría añadirse como segundo proveedor si se elige expresamente, con su propio ciclo de suscripción. Apple Pay/Google Pay en checkout web son wallets y no sustituyen StoreKit/Google Play Billing para compras digitales en apps de tienda. Las excepciones de pagos externos dependen de región/programa: revisar políticas al publicar; no diseñar el lanzamiento alrededor de una excepción no autorizada.

Integrar SDK React Native compatible con la versión de Expo mediante development builds/EAS y builds de tienda; Expo Go y la app móvil ejecutada en navegador no prueban compras nativas. Los canales `direct`, `play` y `app_store` serán explícitos en configuración de build y en el servidor; una variante Play no debe heredar botones de checkout externo de la variante APK. Se puede evaluar un agregador como RevenueCat durante implementación, pero el alcance base contempla los adaptadores directos, sin asumir otra suscripción de infraestructura.

### Backend de suscripciones

- Crear módulos de billing y permisos por plan; migraciones aditivas para clientes de pago, suscripciones, transacciones/eventos de proveedor y derechos de acceso. Identificar producto, proveedor, usuario interno estable, entorno sandbox/producción, período vigente, renovación y estado.
- Añadir contratos/endpoints para consultar planes y estado de la cuenta, crear checkout, validar compras de tiendas, restaurarlas y abrir el portal de administración. Protegerlos por sesión y propiedad; no aceptar precio, descuento final, nivel Premium ni usuario beneficiario decididos por el cliente.
- Vincular compras nativas a la cuenta mediante identificadores opacos soportados por cada tienda y verificar bundle/package, producto, ambiente, transacción y propietario. Una compra restaurada no puede apropiarse de otra cuenta sin un procedimiento explícito de recuperación.
- Procesar webhooks/notificaciones autenticadas con firmas/verificación del proveedor, idempotencia y persistencia antes de responder. Admitir reintentos y eventos fuera de orden; consultar estado vigente cuando sea necesario y ejecutar conciliación periódica para recuperar eventos perdidos.
- Activar Premium únicamente desde estado confirmado en servidor; nunca desde URL de retorno, pantalla «pago exitoso», cliente manipulado ni compra pendiente. También contemplar períodos válidos de importe cero por promociones, sin exigir un cargo positivo.
- Gestionar compra, renovación, rechazo, autenticación adicional, gracia si corresponde al proveedor, cancelación al fin del período, expiración, reembolso y revocación. Separar cancelación de renovación de pérdida inmediata de acceso.
- Un derecho Premium de cuenta es utilizable entre plataformas. Antes de abrir otro checkout, detectar suscripción vigente o pendiente y dirigir al proveedor original para administrarla. Bloquear compras duplicadas controlables; si ocurren compras externas concurrentes entre tiendas, detectarlas y ofrecer resolución, sin afirmar que se pueden impedir todas.
- Al terminar Premium, pasar a Gratis sin borrar listas ni productos. Si supera el límite gratuito acordado, conservar consulta y definir qué nuevas operaciones quedan bloqueadas; mostrar explicación y recuperación al renovar. Aplicar límites también en API y a través de acciones compartidas/tiempo real.
- Los usuarios actuales se migran inicialmente a Gratis sin cobros automáticos ni borrados. Definir política de conservación de capacidades previas antes de imponer límites nuevos.
- Añadir «Mi plan», fecha de renovación/fin, «Administrar/cancelar», «Restaurar compras» en móvil y comprobantes del proveedor. Resolver explícitamente borrado de cuenta con suscripción vigente para evitar cobros huérfanos: cancelar mediante API cuando el canal lo admita o guiar al panel del proveedor; no confundir borrar cuenta con cancelar en una tienda.

Aceptación: Gratis funciona sin tarjeta; Premium respeta 5 USD/mes como precio base acordado; cobro real determinado por proveedor/canal y mostrado antes de confirmar; cuenta sincronizada entre plataformas; cancelación, restauración y expiración funcionan; permisos validados en servidor.

## 8. P07 — Códigos promocionales y descuentos

### Experiencia

- Añadir «¿Tienes un código promocional?» en la contratación Premium, con campo, botón «Aplicar», estado de validación, error comprensible y opción de quitarlo.
- Tras validar, mostrar precio base, descuento, importe a pagar, duración del beneficio y precio/fecha de renovación. Ejemplo de QA, no promoción real: 20 % de 5 USD = 4 USD antes de impuestos; indicar si solo aplica al primer mes o a varios.
- Cambiar de plan/canal/moneda o dejar vencer la cotización exige revalidar. Nunca cobrar el precio completo silenciosamente si la promoción deja de ser válida antes del pago: pedir revisar el importe actualizado.
- En tiendas usar la pantalla/mecanismo nativo de canje cuando sea requerido. Un código interno no debe desbloquear Premium directamente al margen de la compra validada.

### Reglas y administración

Crear catálogo de promociones y pantalla administrativa protegida por los permisos y 2FA existentes. Campos: código normalizado, tipo de descuento porcentual o fijo, moneda si es fijo, plan, canales, territorios admitidos, vigencia UTC, duración del beneficio, máximo global, máximo por cuenta, elegibilidad para nuevas/reactivadas/existentes, estado y referencias de ofertas en proveedores. Registrar cambios y canjes sin secretos.

Propuesta inicial: un código por compra, sin acumulación, una aplicación por cuenta/campaña; duración explícita por campaña, sin descuentos vitalicios implícitos. Los descuentos fijos no superan el subtotal ni producen importes negativos. Admitir 100 % solo si se configura expresamente y el proveedor lo soporta, mostrando cuándo empieza la renovación de pago. No crear códigos reales ni elegir porcentajes sin definición comercial.

La validación será del servidor y del proveedor. Reservar cupo temporal al iniciar checkout y confirmar canje al recibir la suscripción/transacción válida; liberar reservas al expirar o cancelar. Ver el precio no consume un uso. Resolver concurrencia del último cupo y webhooks duplicados de forma atómica. Las cuotas que se prometan como globales deben poder cumplirse en todos los canales; si una tienda permite canjes fuera de la app sin reserva previa, usar cupos asignados por canal/códigos finitos soportados y no anunciar un límite global instantáneo que no se pueda garantizar.

### Adaptación por proveedor

| Canal | Descuento |
| --- | --- |
| Stripe web/PWA/APK directo | Coupons/Promotion Codes asociados al producto mensual; descuento aplicado realmente a Checkout/Billing, no solo a la vista |
| Apple | Offer codes/ofertas de suscripción configurados y canjeados por mecanismos StoreKit/App Store; elegibilidad verificada por Apple |
| Google Play | Ofertas de suscripción de base plan y `offerToken` correspondiente; para campañas con código, resolver la oferta elegible y confirmar precio en Play Billing. Los promo codes nativos de suscripción pueden dar prueba gratuita, no equivalen a cualquier descuento porcentual |

Una campaña tendrá mapeo por proveedor. Publicarla únicamente en canales donde exista una oferta equivalente configurada; si no existe, mostrar «Este código no está disponible en este canal» sin trasladar automáticamente a un cobro externo prohibido. No prometer que el mismo texto de código sirve indistintamente en todas las tiendas. El derecho Premium obtenido sí se reflejará en la misma cuenta en todos sus dispositivos.

Aceptación: descuento real igual al informado y reflejado en el proveedor/comprobante; renovación explicada; códigos inválidos/vencidos/agotados sin cargo inesperado; controles de uso consistentes; administradores pueden crear, desactivar y consultar campañas.

## 9. Casos de prueba del registro

Preparación: base aislada, Mailpit, reloj controlable para vencimientos, correos únicos por caso y fixtures con usuario local verificado/no verificado, social y desactivado. En pruebas negativas comprobar estado de base, ausencia de sesión y cantidad de correos, además del mensaje visible. Casos parametrizados se ejecutan para cada variante indicada.

| ID | Escenario / acción | Resultado esperado |
| --- | --- | --- |
| REG-01 | Solicitar alta con correo nuevo válido | Un correo con enlace; solicitud temporal; cero usuarios y sesiones nuevos |
| REG-02 | Solicitar con espacios externos y mayúsculas | Correo normalizado; mismo destino lógico; no duplicados |
| REG-03 | Correo vacío, inválido o mayor al límite | Error de campo/400; sin envío ni solicitud válida |
| REG-04 | Correo local ya registrado, verificado o no | Respuesta neutral; ningún correo de alta ni cuenta adicional |
| REG-05 | Correo registrado mediante Google/Apple o desactivado | Mismo comportamiento público; sin alta ni reactivación |
| REG-06 | Solicitud correcta sin abrir enlace | No puede ingresar ni usar API protegida; no hay cuenta creada |
| REG-07 | Abrir enlace vigente | Muestra formulario y correo solo lectura; no crea cuenta ni consume enlace |
| REG-08 | Apertura automática del enlace por escáner/previsualizador | La persona todavía puede completar el registro |
| REG-09 | Token ausente, truncado, alterado o desconocido | No muestra formulario utilizable ni datos; permite volver a solicitar enlace |
| REG-10 | Token vencido, incluidos límites exactos de tiempo | Rechazo y opción de nuevo envío; no alta |
| REG-11 | Completar con datos válidos y contraseñas iguales | Exactamente un usuario verificado, contraseña hasheada, token consumido y sesión |
| REG-12 | Nombre vacío, solo espacios, demasiado corto/largo | Error de campo; sin alta; token disponible para corregir |
| REG-13 | WhatsApp vacío, inválido o fuera de longitud | Error de campo; sin alta; ejemplos y validación consistentes |
| REG-14 | Contraseña vacía, corta o superior al límite seguro, incluido Unicode | Rechazo consistente en cliente/API; sin truncamiento silencioso |
| REG-15 | Confirmación vacía o diferente, incluidas diferencias de espacios/case | Rechazo en cliente y API; no consume token |
| REG-16 | Corregir datos tras REG-12 a REG-15 | Mismo enlace permite completar una única vez |
| REG-17 | Manipular petición para enviar otro correo | No se registra ese correo; el servidor deriva identidad del token |
| REG-18 | Enviar token de recuperación o verificación antigua | No se acepta como autorización para registro nuevo |
| REG-19 | Reutilizar enlace después del alta | No crea usuario ni nueva sesión; ofrece ingresar |
| REG-20 | Doble clic y dos POST simultáneos con el mismo token | Solo una transacción de alta tiene éxito |
| REG-21 | Dos solicitudes concurrentes para el mismo correo | Estado coherente de solicitud; límites aplicados; nunca dos usuarios |
| REG-22 | Crear cuenta por otra vía entre solicitud y finalización | No duplica ni vincula automáticamente; informa cómo ingresar |
| REG-23 | Reenviar dentro de 60 s o exceder cuotas | No envía; respuesta de límite coherente y cuenta regresiva |
| REG-24 | Reenvío permitido y aceptado por SMTP | Llega nuevo enlace; el anterior deja de autorizar el alta |
| REG-25 | SMTP falla, timeout o configuración ausente | No afirma envío exitoso, no crea usuario y permite recuperación controlada |
| REG-26 | Falla reenvío con enlace anterior vigente | El enlace anterior sigue funcionando; nuevo intento fallido no lo sustituye |
| REG-27 | SMTP acepta pero falla persistencia posterior | Sin cuenta; reintento obtiene enlace válido; error sin secretos en logs |
| REG-28 | Base de datos falla durante creación/consumo | Rollback completo; ningún usuario parcial ni token consumido sin usuario |
| REG-29 | Cuenta creada, pero falla sesión o se pierde respuesta | Un solo usuario; puede ingresar; repetir no genera otra alta |
| REG-30 | Abrir enlace en otro navegador/dispositivo | Funciona por posesión del enlace sin depender de la sesión inicial |
| REG-31 | Recargar pantalla después de retirar token de URL | Mensaje para reabrir correo; no error opaco ni token persistido |
| REG-32 | Corregir correo en pantalla de solicitud | Nuevo envío a la dirección corregida; formulario final vinculado a su token |
| REG-33 | Solicitar/completar en ES y EN | Formularios, correo, estados y errores en idioma correcto |
| REG-34 | Navegación por teclado y lector; móvil; gestores de contraseña | Etiquetas, foco, errores anunciados, pegado y controles utilizables |
| REG-35 | Invocar registro antiguo directamente sin token | No crea cuenta aunque se evite la UI; cliente antiguo recibe instrucción de actualización |
| REG-36 | Usuario antiguo ingresa, verifica, recupera contraseña o usa 2FA | Flujos existentes conservan su función y no aceptan tokens de registro |
| REG-37 | Registro iniciado en móvil, completado en navegador y login móvil | Usuario verificado puede ingresar y acceder a sus listas |
| REG-38 | Inspeccionar URL, cabeceras, logs, analítica y respuesta API | No hay contraseñas/tokens filtrados; enlace confiable y respuesta no cacheable |
| REG-39 | Variar Host o parámetros de redirección maliciosos | Correo siempre enlaza al origen autorizado; sin redirecciones abiertas |
| REG-40 | Comparar solicitud de correo existente y nuevo | Mismo esquema/estado público y comportamiento temporal sin diferencia evidente; no envío al existente |

## 10. Pruebas de acceso, SEO y unidades

| ID | Comprobación | Resultado esperado |
| --- | --- | --- |
| ACC-01 | Navegación y legales ES/EN, escritorio/móvil | Etiqueta y destino correctos; con/sin sesión funcionan |
| SEO-01 | HTML de `/` y `/en/` sin ejecutar JS | Contenido, idioma, title, description y canonical propios |
| SEO-02 | Selector, hreflang y enlaces internos | Alternativas recíprocas y navegables; no duplicados contradictorios |
| SEO-03 | Sitemap y robots sobre HTTP | 200, MIME apropiado, URLs canónicas; nada privado ni tokens |
| SEO-04 | Ruta inexistente y variantes de dominio/URL | 404 real o redirección canónica apropiada; nunca soft 404 |
| SEO-05 | Metadatos sociales y JSON-LD renderizado | Recursos accesibles y datos coincidentes con contenido real |
| SEO-06 | App, autenticación y staging | No indexables; landing de producción sí elegible |
| SEO-07 | Rendimiento y acceso móvil | Medidas antes/después y sin regresiones importantes; registrar entorno |
| UNI-01 | Crear sin modificar unidad | Guarda `pza` y muestra Unidades/Units |
| UNI-02 | Crear con cada opción estándar | Conserva código, cantidad y etiqueta tras recarga |
| UNI-03 | Personalizado válido, vacío, espacios y más de 20 caracteres | Persiste solo el válido; API también rechaza inválidos |
| UNI-04 | Cantidades 0,01, 1,5, 99999, cero, negativas y más de 2 decimales | Acepta valores válidos; normaliza separador local; rechaza otros sin sustituir por 1 |
| UNI-05 | Producto histórico con unidad desconocida | Se muestra y conserva como personalizada |
| UNI-06 | Comprar, reactivar recurrencia y sincronizar en dos clientes | Cantidad/unidad no cambian y son visibles en ambos |
| UNI-07 | Cambiar estándar/personalizado y guardar/reintentar | Campo condicional correcto; reset solo tras éxito; no guarda marcador interno |
| UNI-08 | Web/móvil, teclado, lector e idioma inglés | Opciones utilizables y etiquetas traducidas sin traducir códigos almacenados |

## 11. Casos de prueba de descargas, pagos y promociones

Usar binarios release de prueba firmados, Stripe test mode, StoreKit sandbox/TestFlight y pista de pruebas de Google Play con usuarios de prueba. No ejecutar cargos reales en CI. Verificar estado persistido, eventos y permisos además de la UI. Las pruebas nativas requieren builds y dispositivos compatibles, no solo Playwright.

| ID | Escenario / acción | Resultado esperado |
| --- | --- | --- |
| DES-01 | Ambas tiendas no publicadas | Android ofrece APK; iOS ofrece web instalable; sin fichas ficticias |
| DES-02 | Ficha disponible, no disponible por región o retirada | Estado/alternativa apropiados; fallback visible al volver |
| DES-03 | Timeout/bloqueo del monitor de tienda | Estado desconocido; no falsa retirada ni espera bloqueante |
| DES-04 | Descargar APK desde servidor | 200, MIME, tamaño y checksum correctos; archivo binario real |
| DES-05 | Archivo ausente, truncado o descarga interrumpida | No devuelve landing como APK; reintento/reanudación y acceso web |
| DES-06 | Instalar APK en Android y actualizar versión firmada | Arranca sin Expo Go; login/datos persisten; certificado compatible |
| DES-07 | Usar PWA en iPhone/iPad desde inicio | Icono, scope, navegación, login y estado sin conexión correctos; no promesa de IPA |
| DES-08 | TestFlight sin beta/cupo o con enlace vigente | Opción solo cuando existe; mensaje beta y alternativa web |
| DES-09 | Publicar versión nueva y revertir manifiesto | Solo apunta a artefactos verificados; enlaces versionados siguen coherentes |
| DES-10 | Canal Android directo frente a futura instalación Play | Firma/transición comprobadas; pagos elegidos por canal correcto |
| PAY-01 | Abrir precios ES/EN, móvil y escritorio | Gratis y 5 USD/mes base, condiciones, moneda y acciones legibles |
| PAY-02 | Elegir Gratis y completar registro | Cuenta utilizable sin tarjeta ni suscripción pagada |
| PAY-03 | Elegir Premium antes del registro | Tras validar correo conserva intención y muestra revisión de cobro |
| PAY-04 | Pagar web correctamente | Confirmación servidor activa Premium una sola vez; comprobante correcto |
| PAY-05 | Tarjeta rechazada, autenticación adicional o pago pendiente | Estado real, recuperación y ningún Premium prematuro |
| PAY-06 | Cancelar checkout o perder retorno de navegador | Sin falso éxito; webhook/consulta recupera estado de pago confirmado |
| PAY-07 | Alterar precio/plan/usuario o simular URL de éxito | Servidor rechaza o ignora manipulación; no concede acceso |
| PAY-08 | Webhook falso, repetido, desordenado o perdido | Firma validada; idempotencia; no retrocede estado; conciliación recupera |
| PAY-09 | Doble clic/dos checkouts e intento en otra plataforma | Una compra controlada; suscripción existente dirige a gestión; duplicados externos detectados |
| PAY-10 | Renovación exitosa y fallida | Período/acceso coherentes; gracia solo conforme al proveedor; recuperación visible |
| PAY-11 | Cancelar renovación antes del fin | Conserva Premium hasta fecha efectiva; después pasa a Gratis |
| PAY-12 | Expirar con datos sobre límite gratuito | Datos conservados; solo restricciones acordadas; renovar restaura capacidad |
| PAY-13 | Reembolso/revocación o disputa de cobro | Estado conciliado y permisos ajustados según regla definida |
| PAY-14 | Compra/restauración iOS y Android Play | Transacción validada/reconocida; producto/entorno correctos; Premium en cuenta |
| PAY-15 | Compra pendiente, cancelada o interrumpida en tienda | Sin acceso prematuro; restauración/reconsulta recupera confirmación posterior |
| PAY-16 | Restaurar compra asociada a otra cuenta | No permite apropiación ni asignación arbitraria |
| PAY-17 | Compra APK directo y retorno desde navegador | Backend confirma; app actualiza estado sin duplicar cobro |
| PAY-18 | Consultar/gestionar plan comprado por otro canal | Misma cuenta reconoce Premium y remite a proveedor original |
| PAY-19 | Moneda local, impuestos y precio no idéntico en tienda | Se muestra precio real antes de confirmar; no sustitución oculta de 5 USD |
| PAY-20 | Exceder límites vía API, lista compartida o concurrencia | Reglas de plan aplicadas en backend y según dueño definido |
| PAY-21 | Borrar cuenta con suscripción vigente | Flujo evita cobros huérfanos y explica gestión de la tienda; no presume cancelación |
| PAY-22 | Migrar cuentas antiguas y mezclar eventos test/live | No cobro automático; datos conservados; sandbox nunca activa producción |
| PRO-01 | Código porcentual válido: ejemplo 20 % sobre 5 USD | 4 USD antes de impuestos en resumen y proveedor |
| PRO-02 | Descuento fijo válido y reglas de redondeo | Cálculo en unidades monetarias menores; moneda correcta; sin negativos |
| PRO-03 | Código inexistente, inactivo, vencido o aún no vigente | Error claro; ningún descuento ni cambio de suscripción |
| PRO-04 | Código agotado o ya usado por la cuenta | Rechazo coherente incluso con sesiones/dispositivos diferentes |
| PRO-05 | Cuenta, plan, moneda, territorio o canal no elegibles | No aplica; explica restricción sin cobrar otro importe silenciosamente |
| PRO-06 | Escribir/quitar código y normalizar espacios/case | Cotización correcta; precio vuelve a base; no consume cupo por previsualizar |
| PRO-07 | Dos códigos o dos compradores por último cupo | Sin acumulación; cuota protegida según estrategia real de cada canal |
| PRO-08 | Checkout abandonado/fallido y webhook duplicado | Reserva liberada al corresponder; canje confirmado una sola vez |
| PRO-09 | Promoción vence/cambia entre cotización y pago | Revalida; solicita revisión si cambia el total; sin sorpresa de precio |
| PRO-10 | Primer mes con descuento y renovación posterior | Descuento termina en plazo anunciado; próximo cobro mostrado correctamente |
| PRO-11 | Campaña de varios meses o 100 % autorizada | Duración y acceso válidos; fecha/importe de futura renovación informados |
| PRO-12 | Canjear oferta Apple y Google Play elegible | Oferta nativa real y transacción verificada; no simple desbloqueo local |
| PRO-13 | Mismo código sin oferta equivalente en tienda | Mensaje de incompatibilidad; no inventa descuento ni redirección prohibida |
| PRO-14 | Crear/desactivar campaña como admin y como usuario normal | Solo admin autorizado puede cambiarla; auditoría de cambios |
| PRO-15 | Intentar modificar descuento final desde cliente | Proveedor/backend determinan importe; comparación contra comprobante |

## 12. P08 — Edición sin conexión y sincronización automática

### Alcance y experiencia

Disponible para Gratis y Premium, respetando los límites de cada plan cuando se confirme la sincronización. El objetivo es consultar listas previamente descargadas, agregar y editar elementos/notas, cambiar cantidades/unidades y marcar compras sin internet. Los cambios deben sobrevivir al cierre y reinicio de la app y enviarse al recuperar conexión.

- Implementar primero en la app nativa iOS/Android, con almacenamiento persistente local. Extender el mismo protocolo a web/PWA con almacenamiento local transaccional; instalar una PWA o reconectar Socket.IO no proporciona esta función por sí solo.
- Después de ingresar con internet, descargar datos de las listas accesibles y permitir elegir cuáles mantener disponibles sin conexión. Una lista nunca descargada requiere conexión la primera vez; mostrar ese estado claramente.
- Guardar cada cambio local y su operación pendiente en una misma transacción antes de indicar «Guardado en este dispositivo». Mostrar el cambio inmediatamente; no borrar el formulario antes de persistirlo.
- Mostrar estados «Sin conexión», «Cambios pendientes: N», «Sincronizando», «Sincronizado» y «Requiere atención», con fecha de última sincronización y botón «Sincronizar ahora» cuando haya conexión.
- Sincronizar al recuperar conexión, abrir la app, volver al primer plano o pulsar el botón. En segundo plano será un intento según capacidades del sistema operativo, nunca una garantía de ejecución inmediata con la app cerrada.
- Registro, recuperación de contraseña, invitaciones/gestión de integrantes, borrado de cuenta, compras y canje de promociones requieren internet. Crear, renombrar o borrar listas requiere internet en la primera entrega; los elementos y notas de listas ya disponibles sí admiten edición offline.
- Una sesión previamente iniciada permite trabajar localmente sin conexión; no se puede iniciar una sesión nueva offline. La confirmación del servidor siempre requiere credenciales vigentes.

### Persistencia y protocolo

1. Usar una base local transaccional: SQLite en nativo e IndexedDB en web/PWA, con migraciones y separación por cuenta. Mantener datos del servidor, proyección de cambios locales, cola de operaciones y cursor de sincronización. No usar solo estado React ni una cola exclusivamente en memoria.
2. Cada operación incluye UUID de operación, ID estable del elemento generado por cliente si es nuevo, lista, acción, campos modificados y versión base del servidor. Cantidad y unidad se tratan como un único grupo para evitar combinar valores incompatibles. No confiar en la hora del dispositivo para decidir precedencia.
3. Añadir contratos aditivos y endpoints autenticados para enviar operaciones y obtener cambios desde un cursor opaco. El servidor asigna revisiones y registra cambios y borrados explícitos; el cursor avanza sobre un orden de confirmación seguro que no omita transacciones concurrentes.
4. Persistir resultado por usuario/UUID de operación y aplicar cambio, versión y resultado idempotente en una misma transacción del servidor. Repetir la misma operación devuelve el resultado anterior; reutilizar el UUID con otro contenido se rechaza. Así un timeout después de guardar no duplica productos ni compras.
5. Enviar operaciones en orden por elemento, resolviendo primero su creación. Una compra expresa estado deseado, no «alternar», y una repetición no reinicia la recurrencia. Procesar resultados por operación: un conflicto no debe detener cambios independientes de otras listas.
6. Confirmar cada resultado y retirar/marcar la operación local en una transacción. Conservar pendientes hasta confirmar; después descargar cambios y reconstruir la vista combinando servidor y pendientes. Una respuesta perdida o cierre durante el proceso se recupera al siguiente intento.
7. Detectar errores de red, timeout y fallos temporales del servidor; reintentar con espera creciente y variación aleatoria. Una red detectada como disponible no prueba acceso a la API. Errores permanentes de validación, permisos o conflicto se muestran para resolver, sin bucle infinito.
8. Validar acceso actual, versión, formatos, límites de plan y recurrencia en servidor para cada operación, igual que en la API normal. Todas las vías de escritura online también actualizan las revisiones y el historial: la API existente no puede eludir controles de conflicto.
9. Si el cursor ya no está disponible por retención o cambia la pertenencia a listas, realizar sincronización completa sin perder la cola local. Un dispositivo que estuvo desconectado mucho tiempo no debe resucitar elementos borrados ni conservar acceso a listas revocadas al reconectar.
10. Mantener compatibilidad de clientes antiguos mediante campos/endpoints aditivos. Documentar retención del historial, resultados idempotentes y ventana máxima soportada; una operación demasiado antigua necesita revisión y no se aplica ciegamente como nueva.

### Conflictos y listas compartidas

- Ediciones concurrentes de campos independientes pueden combinarse si el servidor demuestra que esos campos no cambiaron desde la versión base. Cambios sobre el mismo campo/grupo requieren resolución explícita; no sobrescribir silenciosamente la nota de otra persona.
- Mostrar valor local y valor actual del servidor, quién/cuándo lo modificó cuando exista información, y acciones «Conservar mi cambio», «Usar cambio actualizado» o «Editar resultado». Conservar mi cambio crea una operación nueva sobre la revisión actual; si hay otra modificación mientras se resuelve, volver a revisar.
- Si el elemento fue borrado, no recrearlo automáticamente. Permitir descartar el cambio o, si conserva permisos, crear un elemento nuevo con un nuevo ID y los datos locales.
- Si perdió acceso a una lista o cambió su rol, rechazar escrituras pendientes; explicar el problema y retirar datos de la lista de la caché al confirmar la revocación. No mantener copias visibles de una lista compartida cuyo acceso ya se revocó.
- La compra offline se confirma al sincronizar y la recurrencia se calcula desde el momento de confirmación del servidor en esta primera versión, mostrándolo en la interfaz. No usar una fecha local manipulable como autoridad. Si servidor/otra persona ya cambió el ciclo, resolver el conflicto antes de comprar nuevamente.
- Notificaciones y cambios compartidos se emiten al confirmar en servidor, una sola vez. «Guardado en este dispositivo» no significa que los demás integrantes ya lo vean.

### Sesión, privacidad y recuperación

- Separar la base y cola por cuenta. Al cerrar sesión con pendientes, ofrecer sincronizar si hay conexión o confirmar descarte local; nunca enviarlos bajo una cuenta diferente. Al cerrar sesión efectivamente, retirar acceso local y limpiar los datos de esa cuenta conforme a la política elegida.
- Proteger almacenamiento nativo con cifrado y claves del almacenamiento seguro cuando sea compatible. En web/PWA, usar almacenamiento de la app separado del caché HTTP y explicar las limitaciones de un navegador/dispositivo compartido; no guardar tokens ni respuestas de pagos en la caché offline.
- Al recuperar internet con sesión vencida, intentar renovación; si falla, conservar pendientes y pedir ingresar de nuevo a la misma cuenta. Distinguir falta de internet de credenciales inválidas: un fallo de red no debe borrar datos o cerrar sesión.
- Ante almacenamiento lleno o error local, avisar que el cambio no se guardó y conservar el formulario. Documentar que borrar datos de la app/desinstalar o que el navegador elimine almacenamiento puede perder cambios aún no sincronizados.
- Las actualizaciones de app/base local conservan pendientes. No registrar contenido privado de notas ni credenciales en logs de sincronización; guardar métricas de éxito/error/conflictos con identificadores mínimos.

Aceptación: modo avión → crear/editar nota o elemento → cerrar/reabrir app → recuperar conexión → confirmar exactamente una vez en servidor → ver el mismo resultado en otro dispositivo. Debe conservar cambios frente a errores transitorios, mostrar conflictos y aplicar permisos actuales sin pérdida silenciosa de datos.

### Casos de prueba de sincronización

Preparar dos cuentas/dispositivos con lista compartida, una lista descargada y otra no descargada. Controlar red, respuestas perdidas, versiones, reloj de servidor y fallos de almacenamiento; validar base local, cola, estado del servidor y UI. Probar dispositivos iOS/Android reales para persistencia, ciclo de vida y recuperación; navegador para la variante PWA.

| ID | Escenario / acción | Resultado esperado |
| --- | --- | --- |
| SYN-01 | Abrir lista descargada en modo avión | Datos locales consultables y estado sin conexión visible |
| SYN-02 | Abrir lista nunca descargada sin conexión | Explica que requiere conexión inicial; no lista vacía engañosa |
| SYN-03 | Crear elemento y editar nota/cantidad/unidad offline | Persistencia local atómica, vista actualizada y pendientes visibles |
| SYN-04 | Cerrar forzosamente y reabrir app con pendientes | Datos y cola recuperados; ningún falso estado sincronizado |
| SYN-05 | Recuperar internet o volver al primer plano | Sincronización automática y resultado visible en otro dispositivo |
| SYN-06 | Timeout después de confirmar en servidor y reintentar | Una sola alta/compra; mismo resultado idempotente |
| SYN-07 | Crear elemento y después editar/comprar offline | Orden y dependencias respetados; ID estable y resultado coherente |
| SYN-08 | Comprar offline, repetir envío y activar recurrencia | Una confirmación; no reinicia ciclo; fecha basada en servidor |
| SYN-09 | Internet intermitente, API caída o portal cautivo | Pendientes conservados; reintentos limitados con espera; sin pérdida |
| SYN-10 | Dos personas cambian campos independientes | Combina únicamente cambios seguros; datos correctos en ambos |
| SYN-11 | Dos personas cambian la misma nota o cantidad/unidad | Conflicto visible; ninguna sobrescritura silenciosa |
| SYN-12 | Resolver conflicto y recibir otra edición concurrente | Nueva revisión validada; vuelve a pedir resolución si corresponde |
| SYN-13 | Servidor borra elemento que tiene edición pendiente | No lo resucita; ofrece descartar o crear otro con nuevo ID |
| SYN-14 | Revocar acceso/cambiar rol mientras dispositivo está offline | Al reconectar rechaza pendientes y retira caché revocada |
| SYN-15 | Sesión expirada o fallo de red durante renovación | No pierde cola; solicita autenticación solo cuando corresponde |
| SYN-16 | Cerrar sesión/cambiar de cuenta con pendientes | Advierte y aplica elección; ningún cruce de datos u operaciones |
| SYN-17 | Cola excede límites del plan o contiene datos inválidos | Rechazo por operación con explicación; otras operaciones continúan |
| SYN-18 | Cursor caducado, actualización de app o sincronización interrumpida | Recuperación completa/migración sin duplicación ni pérdida de pendientes |
| SYN-19 | Almacenamiento lleno y fallo al guardar localmente | No afirma guardado; conserva entrada y ofrece recuperación |
| SYN-20 | Sincronización manual, PWA y app en segundo plano | Estados correctos; capacidad validada por plataforma; sin prometer ejecución inmediata cerrada |

## 13. Orden de ejecución y entrega

| Etapa | Dependencia | Entregable verificable |
| --- | --- | --- |
| P01 Acceso | Ninguna | Copias y navegación corregidas; ACC-01 |
| P02 SEO | P01 para copias definitivas | HTML ES/EN, metadatos, sitemap, robots, rutas y reporte SEO |
| P03a Registro: contratos/datos/correo | Decisiones de producto y política de compatibilidad | Migración, endpoints, plantilla, concurrencia y pruebas API |
| P03b Registro: clientes | P03a | Web/móvil, estados/errores, fixtures Mailpit y pruebas E2E |
| P04 Unidades | Contrato existente | Selector web/móvil y validación compatible |
| P05 Distribución alternativa | P01 y binarios/firmas disponibles | Descargas Android verificadas, PWA iOS y estados de tiendas |
| P06a Planes y facturación web | P03; límites de planes, país/pasarela e impuestos definidos | Precios, permisos servidor, checkout, gestión y webhooks |
| P06b Compras móviles | P06a; cuentas/productos de tiendas y builds nativos | Billing de Play/StoreKit, restauración y pruebas sandbox |
| P07 Promociones | P06 y ofertas de cada proveedor | Administración, canje, cuotas y precio/renovación correctos |
| P08 Sin conexión y sincronización | P03/P04; revisiones y protocolo aditivo; reglas de P06 | Persistencia local, cola, conflictos y evidencia offline/online |
| P09 Integración y publicación coordinada | P01–P08 para cada canal que se active | Regresión completa, documentación actualizada y evidencia por plataforma |

En implementación: actualizar `docs/CASOS-DE-PRUEBA.md`, `docs/COMPATIBILIDAD.md`, documentación de despliegue, variables de entorno sin secretos y contratos OpenAPI. Ejecutar `npm run typecheck`, `npm run contract:check`, builds afectados y suites Playwright sobre la pila con Mailpit; el cambio incompatible de registro se documenta y coordina, no se oculta al checker. Usar el reloj de pruebas para caducidad y límites, sin esperas de 30 minutos.

La aceptación final requiere recorrer landing → registro → correo recibido → formulario → sesión → lista → producto con unidad en navegador de escritorio y móvil; también precios → registro verificado → promoción → pago confirmado → Premium → cancelación/fin de período. Validar descarga/instalación Android desde servidor y PWA iOS, además de compra/restauración en builds nativos cuando estén disponibles. Añadir recorrido sin conexión → persistencia tras reinicio → reconexión → sincronización en otro dispositivo y resolución de conflicto compartido. La suite móvil en navegador no acredita iOS/Android físicos. En producción comprobar SMTP real, origen HTTPS del enlace, reglas de indexación y estado de Search Console; esos resultados se registran aparte de la QA local. Añadir precios/descargas ES/EN al sitemap y enlazado de P02; su metadata comercial debe coincidir con las ofertas reales.

Entrega por disponibilidad: primero web/PWA/APK directo y sus pagos; después canales de tienda cuando estén aprobados, manteniendo P06b explícitamente pendiente hasta tener evidencia nativa. No presentar como completadas las compras de tiendas por haber probado Stripe o simulado respuestas. El SDK de compras puede requerir nueva compilación nativa; no asumir publicación solo por OTA.

Dependencias comerciales pendientes: beneficios/límites Gratis y Premium, política de usuarios actuales y listas compartidas, país de la entidad que cobra, pasarela web definitiva, inclusión de impuestos, cuentas de desarrollador/comerciales, productos/precios en tiendas, firma APK y reglas de campañas iniciales. No impiden redactar este plan; sí deben resolverse antes de activar esos cobros o restricciones. Las claves y certificados se gestionarán fuera del documento/repositorio.

Rollback: migración aditiva conservada; detener nuevas solicitudes si hay fallos graves, preservando login de cuentas existentes. No reactivar el registro sin verificación como solución de emergencia. La publicación se realiza después de implementar y validar este plan, no forma parte de su redacción.

Para billing: ante un fallo, desactivar nuevas compras/promociones afectadas sin cortar procesamiento de notificaciones ni acceso pagado vigente; conservar conciliación y gestión/cancelación. Para descargas: volver a un manifiesto de versión validado. No revertir migraciones borrando suscripciones, transacciones o canjes.

## 14. Referencias

- [Google: guía de SEO](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): rastreo, canonical, contenido útil y seguimiento. La preparación técnica no garantiza indexación ni posiciones.
- [Google: sitios multilingües](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites): URLs separadas por idioma y alternancias explícitas.
- [OWASP: tokens enviados por correo](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): referencia para aleatoriedad, caducidad, uso único y limitación de solicitudes; se aplican esos principios al alta previa, no se confunden registro y recuperación.
- [Android: distribución desde sitios web](https://developer.android.com/distribute/marketing-tools/alternative-distribution) y [verificación de desarrolladores](https://developer.android.com/developer-verification): APK e instalación fuera de tiendas; comprobar requisitos por región al lanzar.
- [Apple: distribución web en la UE](https://developer.apple.com/support/web-distribution-eu/): requiere elegibilidad y autorización; no equivale a alojar un IPA para cualquier iPhone.
- [Apple: reglas de pagos y servicios multiplataforma](https://developer.apple.com/app-store/review/guidelines/) y [Google Play: política de pagos](https://support.google.com/googleplay/android-developer/answer/9858738): suscripciones digitales en apps de tienda y excepciones por programas/regiones.
- [Stripe: integración de suscripciones](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) y [cupones/códigos](https://docs.stripe.com/billing/subscriptions/coupons): checkout, ciclo de vida y descuentos.
- [Apple: códigos de oferta de suscripción](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes/), [Google: suscripciones y ofertas](https://developer.android.com/google/play/billing/subscriptions) y [promociones de Play](https://support.google.com/googleplay/android-developer/answer/6321495): adaptar promociones a capacidades nativas, sin asumir equivalencia de códigos entre proveedores.

Fuentes de distribución/pagos consultadas durante esta ampliación; sus requisitos deben volver a verificarse antes de publicar cada canal.

## Estado de implementación

El código y los escenarios automatizados se documentan en [IMPLEMENTACION-MEJORAS.md](IMPLEMENTACION-MEJORAS.md). El catálogo de casos anterior representa el diseño de QA; las pruebas externas de SMTP, cobros, tiendas e instalación física siguen pendientes y no deben tratarse como aprobadas.
