import { InitialSchema1710000000000 } from './1710000000000-InitialSchema';
import { AuthHardening1727000000000 } from './1727000000000-AuthHardening';
import { UserLocale1730000000000 } from './1730000000000-UserLocale';

/** Todas las migraciones, en orden. La app y la CLI de TypeORM usan esta misma lista */
export const MIGRATIONS = [
  InitialSchema1710000000000,
  AuthHardening1727000000000,
  UserLocale1730000000000,
];
