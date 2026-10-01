# Catálogo de casos de prueba

162 casos automatizados con Playwright, repartidos en cinco proyectos (uno por servicio y uno para la app móvil).

Ejecución completa:

```bash
docker compose up -d --build      # la pila debe estar arriba (incluye Mailpit en :8025)
npm run test:e2e                  # ejecuta los 5 proyectos
npm run test:e2e:report           # abre el informe HTML
```

Los videos de evidencia quedan en `e2e/evidence/<servicio>/CP-XXX-YYY-<descripción>.webm`,
con un índice en `e2e/evidence/INDICE.md`.

---

## Servicio `backend` (API REST + WebSocket)

**82 casos.** No aplica: es un servicio sin interfaz, se valida por peticiones HTTP y sockets.

### Servicio backend · salud e infraestructura

Archivo: `e2e/tests/backend/01-salud.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-API-001` | El endpoint de salud reporta base de datos y cache activas |
| `CP-API-002` | La documentación OpenAPI está publicada |
| `CP-API-003` | Los métodos de autenticación disponibles se anuncian |

### Servicio backend · registro e inicio de sesión

Archivo: `e2e/tests/backend/02-autenticacion.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-AUTH-001` | Registro con nombre completo, correo, WhatsApp y contraseña |
| `CP-AUTH-002` | No se permiten dos cuentas con el mismo correo |
| `CP-AUTH-003` | El registro valida el WhatsApp y la longitud de la contraseña |
| `CP-AUTH-004` | Inicio de sesión correcto y credenciales inválidas |
| `CP-AUTH-005` | El refresh token rota y el anterior queda invalidado |
| `CP-AUTH-006` | Cerrar sesión invalida el refresh token |
| `CP-AUTH-007` | Los endpoints protegidos exigen token |
| `CP-AUTH-008` | La cuenta sembrada de administración tiene rol admin |

### Servicio backend · listas de compras

Archivo: `e2e/tests/backend/03-listas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-LIST-001` | Una persona registrada puede tener varias listas |
| `CP-LIST-002` | El detalle separa pendientes y comprados |
| `CP-LIST-003` | Se puede renombrar y recolorear la lista |
| `CP-LIST-004` | Compartir una lista con otra persona registrada |
| `CP-LIST-005` | No se puede compartir con alguien que no está registrado |
| `CP-LIST-006` | Quien no es integrante no puede ver la lista |
| `CP-LIST-007` | Cada integrante decide si quiere recibir avisos |
| `CP-LIST-008` | La dueña puede retirar a un integrante y él pierde acceso |
| `CP-LIST-009` | Solo la propietaria puede eliminar la lista |

### Servicio backend · productos de la lista

Archivo: `e2e/tests/backend/04-productos.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-ITEM-001` | Agregar un producto de una sola vez |
| `CP-ITEM-002` | Agregar un producto con recurrencia programa su vencimiento |
| `CP-ITEM-003` | Marcar recurrencia sin indicar los días es un error |
| `CP-ITEM-004` | La recurrencia acepta entre 1 y 365 días |
| `CP-ITEM-005` | Al comprar, el producto pasa a la lista de comprados |
| `CP-ITEM-006` | Deshacer la compra regresa el producto a pendientes |
| `CP-ITEM-007` | La |
| `CP-ITEM-008` | Vaciar de golpe la lista de comprados |
| `CP-ITEM-009` | Editar un producto y activarle la recurrencia después |
| `CP-ITEM-010` | Eliminar un producto lo borra de la lista |
| `CP-ITEM-011` | Quien no pertenece a la lista no puede agregar productos |

### Servicio backend · motor de recurrencia

Archivo: `e2e/tests/backend/05-recurrencia.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-REC-001` | El ciclo se cuenta desde la compra, no desde el alta |
| `CP-REC-002` | Un recurrente sin comprar se marca como vencido |
| `CP-REC-003` | Comprar un vencido limpia la marca y reinicia el ciclo |
| `CP-REC-004` | Cerrar con la |
| `CP-REC-005` | Eliminar el producto sí cancela la recurrencia |
| `CP-REC-006` | Los ciclos se encadenan una y otra vez |
| `CP-REC-007` | Un producto puntual nunca se reactiva |

### Servicio backend · sincronización en tiempo real

Archivo: `e2e/tests/backend/06-tiempo-real.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-RT-001` | El WebSocket rechaza conexiones sin token válido |
| `CP-RT-002` | Quien comparte lista entra a su sala al conectarse |
| `CP-RT-003` | Al marcar un producto, la otra persona lo ve al instante |
| `CP-RT-004` | Quien tiene los avisos activos recibe la notificación |
| `CP-RT-005` | Quien desactiva los avisos no recibe notificación pero sí el cambio |
| `CP-RT-006` | Quien hace el cambio no se auto-notifica |
| `CP-RT-007` | El aviso queda guardado para consultarlo después |

### Servicio backend · avisos y dispositivos móviles

Archivo: `e2e/tests/backend/07-notificaciones.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-NOT-001` | Registrar y dar de baja el token push del teléfono |
| `CP-NOT-002` | La plataforma del dispositivo se valida |
| `CP-NOT-003` | Marcar avisos como leídos |
| `CP-NOT-004` | Cada quien solo ve sus propios avisos |

### Servicio backend · panel de administración

Archivo: `e2e/tests/backend/08-administracion.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-ADM-001` | Los indicadores globales están disponibles |
| `CP-ADM-002` | La serie diaria devuelve un punto por día |
| `CP-ADM-003` | La bitácora registra lo que ocurre en las listas |
| `CP-ADM-004` | Listado y búsqueda de usuarios |
| `CP-ADM-005` | Desactivar una cuenta impide iniciar sesión |
| `CP-ADM-006` | Una cuenta normal no puede entrar a administración |
| `CP-ADM-007` | El motor de recurrencia se puede disparar manualmente |
| `CP-ADM-008` | Listado de listas con propietario y conteos |

### Servicio backend · perfil y cache

Archivo: `e2e/tests/backend/09-cache-y-perfil.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-PERF-001` | Actualizar nombre, WhatsApp y preferencia de avisos |
| `CP-PERF-002` | Cambiar la contraseña exige la actual |
| `CP-PERF-003` | La búsqueda de personas ayuda a compartir listas |
| `CP-CACHE-001` | La cache de la lista se invalida al cambiar un producto |

### Servicio backend · seguridad de la cuenta

Archivo: `e2e/tests/backend/10-seguridad.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-SEC-001` | El registro envía un correo de verificación y el enlace (de un solo uso) confirma la cuenta |
| `CP-SEC-002` | Recuperar la contraseña cambia la clave y cierra todas las sesiones |
| `CP-SEC-003` | Recuperar contraseña no revela si el correo existe |
| `CP-SEC-004` | El login no revela si la cuenta existe ni con qué proveedor se creó |
| `CP-SEC-005` | Demasiados intentos fallidos bloquean temporalmente el correo (429) |
| `CP-SEC-006` | Cambiar la contraseña revoca los tokens anteriores y devuelve un par nuevo |
| `CP-SEC-007` | Desactivar una cuenta corta su access token al instante |
| `CP-SEC-008` | En clientes web el refresh token viaja en una cookie httpOnly |
| `CP-SEC-009` | Verificación en dos pasos: alta, login con código, recuperación y baja |
| `CP-SEC-010` | La búsqueda de personas solo acepta el correo exacto y no expone el WhatsApp |
| `CP-SEC-011` | La API y las páginas envían cabeceras de seguridad |

### Servicio backend · compatibilidad con versiones de la app

Archivo: `e2e/tests/backend/11-compatibilidad.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-COMPAT-001` | La API publica la versión mínima de la app móvil |
| `CP-COMPAT-002` | Una app por debajo de la mínima recibe 426 con un código estable |
| `CP-COMPAT-003` | El corte ocurre antes que la sesión: una app vieja no se manda al login |
| `CP-COMPAT-004` | La versión mínima, las posteriores y la web sin cabecera se atienden |

### Servicio backend · idiomas

Archivo: `e2e/tests/backend/12-idiomas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-I18N-001` | La API responde los errores en el idioma pedido |
| `CP-I18N-002` | El registro guarda el idioma y el perfil lo puede cambiar |
| `CP-I18N-003` | Cada integrante recibe los avisos en su idioma |
| `CP-I18N-004` | Los correos salen en el idioma de la persona |

### Servicio backend · boletín

Archivo: `e2e/tests/backend/13-boletin.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-NEWS-001` | Sin Listmonk configurado el boletín se anuncia desactivado |
| `CP-NEWS-002` | El alta valida el correo y sin Listmonk responde 503 (en el idioma pedido) |

---

## Servicio `frontend` (aplicación web de usuarios)

**39 casos.** Cada caso graba un video en `e2e/evidence/frontend/`.

### Frontend web · registro de usuarios

Archivo: `e2e/tests/frontend/01-registro.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-001` | Registro con nombre, correo, WhatsApp y contraseña |
| `CP-WEB-002` | El formulario valida los cuatro campos obligatorios |
| `CP-WEB-003` | Avisa cuando el correo ya está registrado |
| `CP-WEB-004` | Se ofrece registro con Google y con Apple |

### Frontend web · inicio y cierre de sesión

Archivo: `e2e/tests/frontend/02-sesion.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-005` | Inicio de sesión con correo y contraseña |
| `CP-WEB-006` | Credenciales incorrectas muestran el error |
| `CP-WEB-007` | Sin sesión, cualquier ruta privada lleva al login |
| `CP-WEB-008` | Cerrar sesión devuelve al login |

### Frontend web · gestión de listas

Archivo: `e2e/tests/frontend/03-listas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-009` | Crear una lista nueva desde cero |
| `CP-WEB-010` | Una persona puede tener varias listas a la vez |
| `CP-WEB-011` | Abrir una lista y volver al listado |
| `CP-WEB-012` | Eliminar una lista completa |

### Frontend web · lista estilo check

Archivo: `e2e/tests/frontend/04-productos.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-013` | Agregar un producto puntual a la lista |
| `CP-WEB-014` | Marcar como comprado lo baja tachado a la lista de abajo |
| `CP-WEB-015` | La |
| `CP-WEB-016` | Destachar un producto lo regresa a pendientes |
| `CP-WEB-017` | Vaciar de golpe la lista de comprados |
| `CP-WEB-018` | Eliminar un producto pendiente con el bote de basura |
| `CP-WEB-019` | Se puede indicar cantidad y unidad |

### Frontend web · productos recurrentes

Archivo: `e2e/tests/frontend/05-recurrencia.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-020` | Agregar |
| `CP-WEB-021` | Al comprarlo se anuncia cuándo volverá a la lista |
| `CP-WEB-022` | Pasados los 14 días el producto reaparece en pendientes |
| `CP-WEB-023` | Un recurrente vencido se pinta de otro color |
| `CP-WEB-024` | Comprar un vencido reinicia su ciclo |
| `CP-WEB-025` | El menú de recurrencia permite simular el paso del tiempo |

### Frontend web · listas compartidas en tiempo real

Archivo: `e2e/tests/frontend/06-compartir-tiempo-real.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-026` | Compartir una lista desde la interfaz |
| `CP-WEB-027` | Avisa si se intenta compartir con alguien sin cuenta |
| `CP-WEB-028` | Lo que una persona marca se actualiza al instante en la otra |
| `CP-WEB-029` | La otra persona recibe un pop-up con el aviso |
| `CP-WEB-030` | Quien apaga |

### Frontend web · mi cuenta

Archivo: `e2e/tests/frontend/07-cuenta.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-031` | Actualizar nombre, WhatsApp y preferencia de avisos |
| `CP-WEB-032` | Cambiar la contraseña desde la interfaz |
| `CP-WEB-033` | El indicador de conexión en vivo se enciende |

### Frontend web · seguridad de la cuenta

Archivo: `e2e/tests/frontend/08-seguridad.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-034` | Recuperar la contraseña desde la interfaz (enlace leído de Mailpit) |
| `CP-WEB-035` | El enlace del correo confirma la cuenta y quita el aviso |
| `CP-WEB-036` | La sesión no queda en localStorage sino en una cookie httpOnly |
| `CP-WEB-037` | Con verificación en dos pasos el login pide el código |

### Frontend web · idiomas

Archivo: `e2e/tests/frontend/09-idiomas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-WEB-038` | La app se abre en el idioma del navegador |
| `CP-WEB-039` | El selector cambia el idioma, lo recuerda y lo guarda en la cuenta |

---

## Servicio `dashboard` (panel de administración)

**15 casos.** Cada caso graba un video en `e2e/evidence/dashboard/`.

### Dashboard · acceso restringido

Archivo: `e2e/tests/dashboard/01-acceso.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-DASH-001` | Una cuenta de administración entra al panel |
| `CP-DASH-002` | Una cuenta normal es rechazada |
| `CP-DASH-003` | Sin sesión el panel redirige al login |
| `CP-DASH-004` | Cerrar sesión vuelve al login |

### Dashboard · resumen de indicadores

Archivo: `e2e/tests/dashboard/02-resumen.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-DASH-005` | Los cuatro indicadores principales están visibles |
| `CP-DASH-006` | El número de usuarios crece al registrarse alguien |
| `CP-DASH-007` | El motor de recurrencia se ejecuta desde el panel |
| `CP-DASH-008` | Los productos recurrentes vencidos se contabilizan |

### Dashboard · usuarios y listas

Archivo: `e2e/tests/dashboard/03-usuarios-y-listas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-DASH-009` | Buscar un usuario por correo |
| `CP-DASH-010` | Desactivar y reactivar una cuenta |
| `CP-DASH-011` | Las listas del sistema se ven con su propietario |

### Dashboard · bitácora de actividad

Archivo: `e2e/tests/dashboard/04-bitacora.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-DASH-012` | Las acciones sobre las listas quedan registradas |
| `CP-DASH-013` | La navegación lateral recorre las cuatro secciones |

### Dashboard · seguridad de la cuenta de administración

Archivo: `e2e/tests/dashboard/05-seguridad.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-DASH-014` | La página de seguridad muestra el estado de 2FA y genera el QR |

### Dashboard · idiomas

Archivo: `e2e/tests/dashboard/06-idiomas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-DASH-015` | El panel cambia de idioma y la elección se comparte con la app web |

---

## Servicio `landing` (página pública de descargas)

**8 casos.** Cada caso graba un video en `e2e/evidence/landing/`.

### Landing · página pública de descargas

Archivo: `e2e/tests/landing/01-landing.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-LAND-001` | El hero explica la propuesta y ofrece las dos descargas |
| `CP-LAND-002` | La sección de descarga repite ambas tiendas |
| `CP-LAND-003` | Se puede saltar a la aplicación web |
| `CP-LAND-004` | Se explican la recurrencia, el tiempo real y los avisos |
| `CP-LAND-005` | La página se adapta al móvil |
| `CP-LAND-006` | El pie enlaza la app, el panel y la API |
| `CP-LAND-008` | El formulario del boletín aparece solo si está disponible |
| `CP-LAND-009` | La política de privacidad se publica en español y en inglés |

### Landing · idiomas

Archivo: `e2e/tests/landing/02-idiomas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-LAND-007` | Con el navegador en inglés se muestra en inglés y se puede cambiar |

---

## App móvil React Native (iOS / Android)

**18 casos.** Cada caso graba un video en `e2e/evidence/mobile-app/`. Se ejecuta sobre el build `react-native-web` de la misma base de código.

### App móvil · acceso

Archivo: `e2e/tests/mobile/01-acceso.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-MOV-001` | Registro desde el teléfono con los cuatro datos |
| `CP-MOV-002` | El registro valida los campos antes de enviarlos |
| `CP-MOV-003` | Inicio de sesión con una cuenta existente |
| `CP-MOV-004` | Credenciales inválidas muestran el error |
| `CP-MOV-005` | Se ofrece inicio de sesión con Google y Apple |
| `CP-MOV-006` | Cerrar sesión desde mi cuenta |
| `CP-MOV-015` | Recuperar la contraseña desde el teléfono |

### App móvil · listas y recurrencia

Archivo: `e2e/tests/mobile/02-listas-y-recurrencia.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-MOV-007` | Crear una lista desde el teléfono |
| `CP-MOV-008` | Agregar un producto y marcarlo como comprado |
| `CP-MOV-009` | Agregar |
| `CP-MOV-010` | Un recurrente vencido se destaca en la lista |
| `CP-MOV-011` | La |

### App móvil · sincronización y avisos

Archivo: `e2e/tests/mobile/03-tiempo-real.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-MOV-012` | Lo que otra persona marca aparece al instante en el teléfono |
| `CP-MOV-013` | Llega el aviso emergente dentro de la app |
| `CP-MOV-014` | Compartir una lista desde el teléfono |

### App móvil · compatibilidad con la API

Archivo: `e2e/tests/mobile/04-compatibilidad.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-MOV-016` | La app se identifica con su versión en cada petición |
| `CP-MOV-017` | Una versión que ya no es compatible pide actualizar la app |

### App móvil · idiomas

Archivo: `e2e/tests/mobile/05-idiomas.spec.ts`

| Caso | Qué se comprueba |
| --- | --- |
| `CP-MOV-018` | Con el teléfono en inglés la app se abre en inglés y se puede cambiar |

---
