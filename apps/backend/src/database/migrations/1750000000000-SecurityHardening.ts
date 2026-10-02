import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityHardening1750000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE list_members m SET role='editor' FROM shopping_lists l
        WHERE m.list_id=l.id AND m.role='owner' AND m.user_id<>l.owner_id;
      UPDATE list_members m SET role='owner' FROM shopping_lists l
        WHERE m.list_id=l.id AND m.user_id=l.owner_id;
      INSERT INTO list_members(list_id,user_id,role) SELECT id,owner_id,'owner' FROM shopping_lists
        ON CONFLICT (list_id,user_id) DO NOTHING;
      CREATE UNIQUE INDEX one_owner_per_list ON list_members(list_id) WHERE role='owner';
      ALTER TABLE list_invitations ADD COLUMN last_sent_at timestamptz;
      UPDATE list_invitations SET last_sent_at=created_at;
      CREATE INDEX invitation_sender_window ON list_invitations(invited_by_id,last_sent_at);
      CREATE TABLE invitation_send_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, email varchar(180) NOT NULL,
        sent_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX invite_sender_events ON invitation_send_events(sender_id,sent_at);
      CREATE INDEX invite_recipient_events ON invitation_send_events(email,sent_at);
      ALTER TABLE list_items ADD COLUMN image_bytes integer NOT NULL DEFAULT 0 CHECK(image_bytes>=0);
      CREATE INDEX item_image_lookup ON list_items(image_key) WHERE image_key IS NOT NULL;
      CREATE TABLE image_deletions (image_key varchar(80) PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now());
      CREATE FUNCTION queue_deleted_item_image() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF OLD.image_key IS NOT NULL AND (TG_OP='DELETE' OR OLD.image_key IS DISTINCT FROM NEW.image_key) THEN
          INSERT INTO image_deletions(image_key) VALUES(OLD.image_key) ON CONFLICT DO NOTHING;
        END IF;
        RETURN NULL;
      END $$;
      CREATE TRIGGER item_image_cleanup AFTER DELETE OR UPDATE OF image_key ON list_items
        FOR EACH ROW EXECUTE FUNCTION queue_deleted_item_image();
      CREATE TABLE mail_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload text NOT NULL,
        kind varchar(20) NOT NULL, reference varchar(180) NOT NULL, version varchar(64) NOT NULL,
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
        lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX mail_outbox_due ON mail_outbox(available_at);
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE invitation_send_events; DROP TABLE mail_outbox; DROP TRIGGER item_image_cleanup ON list_items;
      DROP FUNCTION queue_deleted_item_image(); DROP TABLE image_deletions;
      DROP INDEX item_image_lookup; ALTER TABLE list_items DROP COLUMN image_bytes; ALTER TABLE list_invitations DROP COLUMN last_sent_at;
      DROP INDEX one_owner_per_list;`);
  }
}
