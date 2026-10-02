import { MigrationInterface, QueryRunner } from 'typeorm';

export class ListInvitationsAndItemImages1740000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE list_items ADD COLUMN IF NOT EXISTS image_key varchar(80)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_list_invitations_pending_email
      ON list_invitations (lower(email), expires_at) WHERE status = 'pending'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS idx_list_invitations_pending_email');
    await q.query('ALTER TABLE list_items DROP COLUMN IF EXISTS image_key');
  }
}
