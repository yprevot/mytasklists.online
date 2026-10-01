# Diseño · MyTaskLists

Un solo sistema visual para la web, el panel, la landing y la app móvil.

## Idea

La etiqueta de góndola de un supermercado: superficies blancas sobre un fondo verde grisáceo muy claro, tinta verde casi negra, verde pino como color de marca y el amarillo de las etiquetas de precio reservado para lo **recurrente**. El rojo tomate es solo para lo **vencido**. Es una escena de pie, con una mano y luz de pasillo, así que todo es claro, de alto contraste y con zonas táctiles de al menos 44 px.

## Tokens

| Rol | Valor | Uso |
|---|---|---|
| `ground` | `#f1f3ef` | fondo de pantalla |
| `surface` | `#ffffff` | hojas, tarjetas, filas |
| `ink` / `ink-2` | `#15201a` / `#55625a` | texto / texto secundario |
| `line` / `line-strong` | `#dde3de` / `#c3ccc5` | filetes / bordes de campos |
| `pine` | `#1d5b45` (press `#164a38`, tinte `#e4efe9`) | marca, acción primaria, "comprado" |
| `tag` | `#f6c945` (suave `#fdf3cf`) | etiqueta de producto recurrente |
| `tomato` | `#c8371f` (suave `#fcede9`, texto `#8e2a17`) | producto vencido, errores |

Radios: 10 px controles, 14 px hojas. Sombras con desplazamiento y desenfoque suave, nunca halos.

## Tipografía

- Títulos y cifras: **Archivo** variable (peso 700–800, tracking ajustado).
- Cuerpo e interfaz: **Figtree** variable.
- Ambas se sirven desde el propio dominio (la política CSP solo permite `font-src 'self'`): `@fontsource-variable/*` en web y panel, archivos `woff2` en `apps/landing/src/fonts`.
- App móvil: fuentes del sistema, como se espera en una app nativa.

## Reglas de composición

- Los productos viven juntos en **una sola hoja separada por filetes**, como un ticket. El estado se lee en el aro del check y en la etiqueta, no en un borde de color.
- Amarillo = recurrente, rojo = vencido, pino = comprado. No se reutilizan para otra cosa.
- Sin texto con degradado, sin eyebrows sobre los títulos, sin tarjetas de icono + título + texto como estructura de página.
- Iconos: Bootstrap Icons en web y panel; en móvil, glifos dibujados con vistas. Los emojis solo aparecen como **contenido** (el icono que la persona elige para su lista).
- Teléfonos: la navegación pasa a una barra inferior; los formularios ocupan todo el ancho.

## Dónde vive

- Web: `apps/frontend/src/styles/app.css` (tokens + piel de Bootstrap + componentes `lc-*`).
- Panel: `apps/dashboard/src/styles/theme.css` (copia de los tokens) y `dashboard.css`. Si cambias un token, cámbialo en los dos.
- Landing: `apps/landing/src/styles.css`.
- Móvil: `apps/mobile/src/theme.ts` y `components/ui.tsx`.

