/** Versiones `x.y.z` de la app movil. Ignora sufijos como `-beta.1` o `+42`. */
export const parseVersion = (value: string): [number, number, number] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

/** Negativo si `a` es anterior a `b`, 0 si son iguales, positivo si es posterior */
export const compareVersions = (a: [number, number, number], b: [number, number, number]): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
