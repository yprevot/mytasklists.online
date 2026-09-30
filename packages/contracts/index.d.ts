/**
 * Contrato de la API de ListaDeCompras.
 *
 * Todo lo que viaja por la red entre el backend y sus clientes (web, panel y app
 * movil) se declara aqui una sola vez. El backend lo implementa y los clientes lo
 * consumen, asi que un cambio incompatible falla al compilar en todos a la vez.
 *
 * Convencion que usa `npm run contract:check` para decidir la direccion:
 * - Los tipos que terminan en `Request` y `ClientEvents` viajan del cliente al servidor.
 * - Todo lo demas viaja del servidor al cliente.
 */
export * from './models';
export * from './auth';
export * from './requests';
export * from './realtime';
export * from './compat';
