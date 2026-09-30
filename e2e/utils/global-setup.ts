import { request } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const API_URL = process.env.E2E_API_URL ?? `${BASE_URL}/api`;

/**
 * Comprueba que la pila de Docker está arriba antes de lanzar nada.
 * Si no lo está, falla con un mensaje claro en vez de con 40 timeouts.
 */
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({ ignoreHTTPSErrors: true });

  const deadline = Date.now() + 90_000;
  let lastError = 'sin respuesta';

  while (Date.now() < deadline) {
    try {
      const response = await context.get(`${API_URL}/health`, { timeout: 5000 });
      if (response.ok()) {
        const body = await response.json();
        if (body.database && body.redis) {
          // eslint-disable-next-line no-console
          console.log(`\n[e2e] backend listo en ${API_URL} (db + redis ok)\n`);
          await context.dispose();
          return;
        }
        lastError = `servicio degradado: ${JSON.stringify(body)}`;
      } else {
        lastError = `HTTP ${response.status()}`;
      }
    } catch (error) {
      lastError = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await context.dispose();
  throw new Error(
    `No se pudo contactar con el backend en ${API_URL} (${lastError}).\n` +
      `Levanta la pila antes de ejecutar las pruebas:\n\n    docker compose up -d --build\n`,
  );
}
