import { MigrationInterface, QueryRunner } from 'typeorm';

/** Idioma de cada persona para sus correos y avisos. Las cuentas existentes quedan en espanol. */
export class UserLocale1730000000000 implements MigrationInterface {
  name = 'UserLocale1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "locale" varchar(5) NOT NULL DEFAULT 'es'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
  }
}
