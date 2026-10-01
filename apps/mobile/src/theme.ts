/**
 * Mismos tokens que la app web y el panel (apps/frontend/src/styles/app.css):
 * etiqueta de góndola, verde pino de marca y amarillo de etiqueta para lo
 * recurrente. Las fuentes son las del sistema, como se espera en una app nativa.
 */
export const colors = {
  brand: '#1d5b45',
  brandDark: '#164a38',
  brandSoft: '#e4efe9',
  brandLine: '#cfe2d8',
  /** Amarillo de la etiqueta de precio: lo recurrente */
  accent: '#f6c945',
  accentSoft: '#fdf3cf',
  accentLine: '#ecd278',
  danger: '#c8371f',
  dangerSoft: '#fcede9',
  dangerLine: '#f1c7be',
  dangerInk: '#8e2a17',
  success: '#2b7a56',
  warning: '#e3a008',
  ink: '#15201a',
  inkSoft: '#55625a',
  line: '#dde3de',
  lineStrong: '#c3ccc5',
  surface: '#ffffff',
  bg: '#f1f3ef',
  muted: '#66736b',
  chip: '#eef1ed',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

/** Sombra suave con desplazamiento, la misma en iOS y Android */
export const shadow = {
  card: {
    shadowColor: '#15201a',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pop: {
    shadowColor: '#15201a',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
