/** Vive en su propio archivo para evitar la dependencia circular user ↔ user_identities */
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  APPLE = 'apple',
}
