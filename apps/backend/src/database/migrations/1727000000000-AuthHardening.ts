import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Endurecimiento de la autenticación:
 *  - `user_identities`: cuentas de Google/Apple vinculadas por `sub` (no por correo).
 *  - Columnas de 2FA (TOTP) en `users`.
 */
export class AuthHardening1727000000000 implements MigrationInterface {
  name = 'AuthHardening1727000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider"     "users_provider_enum" NOT NULL,
        "subject"      varchar(191) NOT NULL,
        "email"        varchar(180),
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "last_used_at" timestamptz
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_identities_provider_subject" ON "user_identities" ("provider", "subject")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_user_identities_user" ON "user_identities" ("user_id")`);

    // Las cuentas sociales existentes pasan a la tabla nueva
    await queryRunner.query(`
      INSERT INTO "user_identities" ("user_id", "provider", "subject", "email", "created_at")
      SELECT "id", "provider", "provider_id", "email", "created_at"
        FROM "users"
       WHERE "provider_id" IS NOT NULL AND "provider" <> 'local'
      ON CONFLICT DO NOTHING`);

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "totp_secret" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "totp_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "totp_recovery_codes" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_recovery_codes"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_secret"`);
    await queryRunner.query(`DROP TABLE "user_identities"`);
  }
}
