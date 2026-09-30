# Catalogo de casos de prueba

150 casos automatizados con Playwright, repartidos en cinco proyectos (uno por servicio y uno para la app movil).

Ejecucion completa:

```bash
docker compose up -d --build      # la pila debe estar arriba (incluye Mailpit en :8025)
npm run test:e2e                  # ejecuta los 5 proyectos
npm run test:e2e:report           # abre el informe HTML
```

Los videos de evidencia quedan en `e2e/evidence/<servicio>/CP-XXX-YYY-<descripcion>.webm`,
con un indice en `e2e/evidence/INDICE.md`.

---

## Servicio `backend` (API REST + WebSocket)

**76 casos.** No aplica: es un servicio sin interfaz, se valida por peticiones HTTP y sockets.

### Servicio backend · salud e infraestructura

Archivo: `e2e/tests/backend/01-salud.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-API-001` | El endpoint de salud reporta base de datos y cache activas |
| `CP-API-002` | La documentacion OpenAPI esta publicada |
| `CP-API-003` | Los metodos de autenticacion disponibles se anuncian |

### Servicio backend · registro e inicio de sesion

Archivo: `e2e/tests/backend/02-autenticacion.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-AUTH-001` | Registro con nombre completo, correo, WhatsApp y contrasena |
| `CP-AUTH-002` | No se permiten dos cuentas con el mismo correo |
| `CP-AUTH-003` | El registro valida el WhatsApp y la longitud de la contrasena |
| `CP-AUTH-004` | Inicio de sesion correcto y credenciales invalidas |
| `CP-AUTH-005` | El refresh token rota y el anterior queda invalidado |
| `CP-AUTH-006` | Cerrar sesion invalida el refresh token |
| `CP-AUTH-007` | Los endpoints protegidos exigen token |
| `CP-AUTH-008` | La cuenta sembrada de administracion tiene rol admin |

### Servicio backend · listas de compras

Archivo: `e2e/tests/backend/03-listas.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-LIST-001` | Una persona registrada puede tener varias listas |
| `CP-LIST-002` | El detalle separa pendientes y comprados |
| `CP-LIST-003` | Se puede renombrar y recolorear la lista |
| `CP-LIST-004` | Compartir una lista con otra persona registrada |
| `CP-LIST-005` | No se puede compartir con alguien que no esta registrado |
| `CP-LIST-006` | Quien no es integrante no puede ver la lista |
| `CP-LIST-007` | Cada integrante decide si quiere recibir avisos |
| `CP-LIST-008` | La duena puede retirar a un integrante y el pierde acceso |
| `CP-LIST-009` | Solo la propietaria puede eliminar la lista |

### Servicio backend · productos de la lista

Archivo: `e2e/tests/backend/04-productos.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-ITEM-001` | Agregar un producto de una sola vez |
| `CP-ITEM-002` | Agregar un producto con recurrencia programa su vencimiento |
| `CP-ITEM-003` | Marcar recurrencia sin indicar los dias es un error |
| `CP-ITEM-004` | La recurrencia acepta entre 1 y 365 dias |
| `CP-ITEM-005` | Al comprar, el producto pasa a la lista de comprados |
| `CP-ITEM-006` | Deshacer la compra regresa el producto a pendientes |
| `CP-ITEM-007` | La |
| `CP-ITEM-008` | Vaciar de golpe la lista de comprados |
| `CP-ITEM-009` | Editar un producto y activarle la recurrencia despues |
| `CP-ITEM-010` | Eliminar un producto lo borra de la lista |
| `CP-ITEM-011` | Quien no pertenece a la lista no puede agregar productos |

### Servicio backend · motor de recurrencia

Archivo: `e2e/tests/backend/05-recurrencia.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-REC-001` | El ciclo se cuenta desde la compra, no desde el alta |
| `CP-REC-002` | Un recurrente sin comprar se marca como vencido |
| `CP-REC-003` | Comprar un vencido limpia la marca y reinicia el ciclo |
| `CP-REC-004` | Cerrar con la |
| `CP-REC-005` | Eliminar el producto si cancela la recurrencia |
| `CP-REC-006` | Los ciclos se encadenan una y otra vez |
| `CP-REC-007` | Un producto puntual nunca se reactiva |

### Servicio backend · sincronizacion en tiempo real

Archivo: `e2e/tests/backend/06-tiempo-real.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-RT-001` | El WebSocket rechaza conexiones sin token valido |
| `CP-RT-002` | Quien comparte lista entra a su sala al conectarse |
| `CP-RT-003` | Al marcar un producto, la otra persona lo ve al instante |
| `CP-RT-004` | Quien tiene los avisos activos recibe la notificacion |
| `CP-RT-005` | Quien desactiva los avisos no recibe notificacion pero si el cambio |
| `CP-RT-006` | Quien hace el cambio no se auto-notifica |
| `CP-RT-007` | El aviso queda guardado para consultarlo despues |

### Servicio backend · avisos y dispositivos moviles

Archivo: `e2e/tests/backend/07-notificaciones.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-NOT-001` | Registrar y dar de baja el token push del telefono |
| `CP-NOT-002` | La plataforma del dispositivo se valida |
| `CP-NOT-003` | Marcar avisos como leidos |
| `CP-NOT-004` | Cada quien solo ve sus propios avisos |

### Servicio backend · panel de administracion

Archivo: `e2e/tests/backend/08-administracion.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-ADM-001` | Los indicadores globales estan disponibles |
| `CP-ADM-002` | La serie diaria devuelve un punto por dia |
| `CP-ADM-003` | La bitacora registra lo que ocurre en las listas |
| `CP-ADM-004` | Listado y busqueda de usuarios |
| `CP-ADM-005` | Desactivar una cuenta impide iniciar sesion |
| `CP-ADM-006` | Una cuenta normal no puede entrar a administracion |
| `CP-ADM-007` | El motor de recurrencia se puede disparar manualmente |
| `CP-ADM-008` | Listado de listas con propietario y conteos |

### Servicio backend · perfil y cache

Archivo: `e2e/tests/backend/09-cache-y-perfil.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-PERF-001` | Actualizar nombre, WhatsApp y preferencia de avisos |
| `CP-PERF-002` | Cambiar la contrasena exige la actual |
| `CP-PERF-003` | La busqueda de personas ayuda a compartir listas |
| `CP-CACHE-001` | La cache de la lista se invalida al cambiar un producto |

### Servicio backend · seguridad de la cuenta

Archivo: `e2e/tests/backend/10-seguridad.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-SEC-001` | El registro envia un correo de verificacion y el enlace (de un solo uso) confirma la cuenta |
| `CP-SEC-002` | Recuperar la contrasena cambia la clave y cierra todas las sesiones |
| `CP-SEC-003` | Recuperar contrasena no revela si el correo existe |
| `CP-SEC-004` | El login no revela si la cuenta existe ni con que proveedor se creo |
| `CP-SEC-005` | Demasiados intentos fallidos bloquean temporalmente el correo (429) |
| `CP-SEC-006` | Cambiar la contrasena revoca los tokens anteriores y devuelve un par nuevo |
| `CP-SEC-007` | Desactivar una cuenta corta su access token al instante |
| `CP-SEC-008` | En clientes web el refresh token viaja en una cookie httpOnly |
| `CP-SEC-009` | Verificacion en dos pasos: alta, login con codigo, recuperacion y baja |
| `CP-SEC-010` | La busqueda de personas solo acepta el correo exacto y no expone el WhatsApp |
| `CP-SEC-011` | La API y las paginas envian cabeceras de seguridad |

### Servicio backend · compatibilidad con versiones de la app

Archivo: `e2e/tests/backend/11-compatibilidad.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-COMPAT-001` | La API publica la version minima de la app movil |
| `CP-COMPAT-002` | Una app por debajo de la minima recibe 426 con un codigo estable |
| `CP-COMPAT-003` | El corte ocurre antes que la sesion: una app vieja no se manda al login |
| `CP-COMPAT-004` | La version minima, las posteriores y la web sin cabecera se atienden |

---

## Servicio `frontend` (aplicacion web de usuarios)

**37 casos.** Cada caso graba un video en `e2e/evidence/frontend/`.

### Frontend web · registro de usuarios

Archivo: `e2e/tests/frontend/01-registro.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-001` | Registro con nombre, correo, WhatsApp y contrasena |
| `CP-WEB-002` | El formulario valida los cuatro campos obligatorios |
| `CP-WEB-003` | Avisa cuando el correo ya esta registrado |
| `CP-WEB-004` | Se ofrece registro con Google y con Apple |

### Frontend web · inicio y cierre de sesion

Archivo: `e2e/tests/frontend/02-sesion.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-005` | Inicio de sesion con correo y contrasena |
| `CP-WEB-006` | Credenciales incorrectas muestran el error |
| `CP-WEB-007` | Sin sesion, cualquier ruta privada lleva al login |
| `CP-WEB-008` | Cerrar sesion devuelve al login |

### Frontend web · gestion de listas

Archivo: `e2e/tests/frontend/03-listas.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-009` | Crear una lista nueva desde cero |
| `CP-WEB-010` | Una persona puede tener varias listas a la vez |
| `CP-WEB-011` | Abrir una lista y volver al listado |
| `CP-WEB-012` | Eliminar una lista completa |

### Frontend web · lista estilo check

Archivo: `e2e/tests/frontend/04-productos.spec.ts`

| Caso | Que se comprueba |
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

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-020` | Agregar |
| `CP-WEB-021` | Al comprarlo se anuncia cuando volvera a la lista |
| `CP-WEB-022` | Pasados los 14 dias el producto reaparece en pendientes |
| `CP-WEB-023` | Un recurrente vencido se pinta de otro color |
| `CP-WEB-024` | Comprar un vencido reinicia su ciclo |
| `CP-WEB-025` | El menu de recurrencia permite simular el paso del tiempo |

### Frontend web · listas compartidas en tiempo real

Archivo: `e2e/tests/frontend/06-compartir-tiempo-real.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-026` | Compartir una lista desde la interfaz |
| `CP-WEB-027` | Avisa si se intenta compartir con alguien sin cuenta |
| `CP-WEB-028` | Lo que una persona marca se actualiza al instante en la otra |
| `CP-WEB-029` | La otra persona recibe un pop-up con el aviso |
| `CP-WEB-030` | Quien apaga |

### Frontend web · mi cuenta

Archivo: `e2e/tests/frontend/07-cuenta.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-031` | Actualizar nombre, WhatsApp y preferencia de avisos |
| `CP-WEB-032` | Cambiar la contrasena desde la interfaz |
| `CP-WEB-033` | El indicador de conexion en vivo se enciende |

### Frontend web · seguridad de la cuenta

Archivo: `e2e/tests/frontend/08-seguridad.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-WEB-034` | Recuperar la contrasena desde la interfaz (enlace leido de Mailpit) |
| `CP-WEB-035` | El enlace del correo confirma la cuenta y quita el aviso |
| `CP-WEB-036` | La sesion no queda en localStorage sino en una cookie httpOnly |
| `CP-WEB-037` | Con verificacion en dos pasos el login pide el codigo |

---

## Servicio `dashboard` (panel de administracion)

**14 casos.** Cada caso graba un video en `e2e/evidence/dashboard/`.

### Dashboard · acceso restringido

Archivo: `e2e/tests/dashboard/01-acceso.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-DASH-001` | Una cuenta de administracion entra al panel |
| `CP-DASH-002` | Una cuenta normal es rechazada |
| `CP-DASH-003` | Sin sesion el panel redirige al login |
| `CP-DASH-004` | Cerrar sesion vuelve al login |

### Dashboard · resumen de indicadores

Archivo: `e2e/tests/dashboard/02-resumen.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-DASH-005` | Los cuatro indicadores principales estan visibles |
| `CP-DASH-006` | El numero de usuarios crece al registrarse alguien |
| `CP-DASH-007` | El motor de recurrencia se ejecuta desde el panel |
| `CP-DASH-008` | Los productos recurrentes vencidos se contabilizan |

### Dashboard · usuarios y listas

Archivo: `e2e/tests/dashboard/03-usuarios-y-listas.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-DASH-009` | Buscar un usuario por correo |
| `CP-DASH-010` | Desactivar y reactivar una cuenta |
| `CP-DASH-011` | Las listas del sistema se ven con su propietario |

### Dashboard · bitacora de actividad

Archivo: `e2e/tests/dashboard/04-bitacora.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-DASH-012` | Las acciones sobre las listas quedan registradas |
| `CP-DASH-013` | La navegacion lateral recorre las cuatro secciones |

### Dashboard · seguridad de la cuenta de administracion

Archivo: `e2e/tests/dashboard/05-seguridad.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-DASH-014` | La pagina de seguridad muestra el estado de 2FA y genera el QR |

---

## Servicio `landing` (pagina publica de descargas)

**6 casos.** Cada caso graba un video en `e2e/evidence/landing/`.

### Landing · pagina publica de descargas

Archivo: `e2e/tests/landing/01-landing.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-LAND-001` | El hero explica la propuesta y ofrece las dos descargas |
| `CP-LAND-002` | La seccion de descarga repite ambas tiendas |
| `CP-LAND-003` | Se puede saltar a la aplicacion web |
| `CP-LAND-004` | Se explican la recurrencia, el tiempo real y los avisos |
| `CP-LAND-005` | La pagina se adapta al movil |
| `CP-LAND-006` | El pie enlaza la app, el panel y la API |

---

## App movil React Native (iOS / Android)

**17 casos.** Cada caso graba un video en `e2e/evidence/mobile-app/`. Se ejecuta sobre el build `react-native-web` de la misma base de codigo.

### App movil · acceso

Archivo: `e2e/tests/mobile/01-acceso.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-MOV-001` | Registro desde el telefono con los cuatro datos |
| `CP-MOV-002` | El registro valida los campos antes de enviarlos |
| `CP-MOV-003` | Inicio de sesion con una cuenta existente |
| `CP-MOV-004` | Credenciales invalidas muestran el error |
| `CP-MOV-005` | Se ofrece inicio de sesion con Google y Apple |
| `CP-MOV-006` | Cerrar sesion desde mi cuenta |
| `CP-MOV-015` | Recuperar la contrasena desde el telefono |

### App movil · listas y recurrencia

Archivo: `e2e/tests/mobile/02-listas-y-recurrencia.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-MOV-007` | Crear una lista desde el telefono |
| `CP-MOV-008` | Agregar un producto y marcarlo como comprado |
| `CP-MOV-009` | Agregar |
| `CP-MOV-010` | Un recurrente vencido se destaca en la lista |
| `CP-MOV-011` | La |

### App movil · sincronizacion y avisos

Archivo: `e2e/tests/mobile/03-tiempo-real.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-MOV-012` | Lo que otra persona marca aparece al instante en el telefono |
| `CP-MOV-013` | Llega el aviso emergente dentro de la app |
| `CP-MOV-014` | Compartir una lista desde el telefono |

### App movil · compatibilidad con la API

Archivo: `e2e/tests/mobile/04-compatibilidad.spec.ts`

| Caso | Que se comprueba |
| --- | --- |
| `CP-MOV-016` | La app se identifica con su version en cada peticion |
| `CP-MOV-017` | Una version que ya no es compatible pide actualizar la app |

---
