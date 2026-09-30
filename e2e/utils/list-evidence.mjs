/** Imprime el indice de videos de evidencia generado por las pruebas */
import { readFile } from 'node:fs/promises';

try {
  console.log(await readFile(new URL('../evidence/INDICE.md', import.meta.url), 'utf8'));
} catch {
  console.log('Todavia no hay evidencia. Ejecuta primero: npm run test --workspace e2e');
}
