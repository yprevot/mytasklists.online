import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── Tipos enumerados ───────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "users_provider_enum" AS ENUM('local','google','apple')`);
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM('user','admin')`);
    await queryRunner.query(`CREATE TYPE "list_members_role_enum" AS ENUM('owner','editor','viewer')`);
    await queryRunner.query(`CREATE TYPE "list_items_status_enum" AS ENUM('pending','purchased','archived')`);
    await queryRunner.query(`CREATE TYPE "list_invitations_role_enum" AS ENUM('owner','editor','viewer')`);
    await queryRunner.query(`CREATE TYPE "list_invitations_status_enum" AS ENUM('pending','accepted','revoked')`);
    await queryRunner.query(`CREATE TYPE "device_tokens_platform_enum" AS ENUM('ios','android','web')`);
    await queryRunner.query(
      `CREATE TYPE "notifications_type_enum" AS ENUM('item.added','item.purchased','item.restored','item.removed','item.updated','item.reactivated','item.overdue','list.shared','list.updated','member.left')`,
    );
    await queryRunner.query(`CREATE TYPE "notifications_channel_enum" AS ENUM('web','push','both')`);

    // ── users ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "full_name"             varchar(160)  NOT NULL,
        "email"                 varchar(180)  NOT NULL,
        "whatsapp"              varchar(25),
        "password_hash"         varchar(120),
        "provider"              "users_provider_enum" NOT NULL DEFAULT 'local',
        "provider_id"           varchar(191),
        "avatar_url"            varchar(500),
        "role"                  "users_role_enum" NOT NULL DEFAULT 'user',
        "email_verified"        boolean NOT NULL DEFAULT false,
        "is_active"             boolean NOT NULL DEFAULT true,
        "notifications_enabled" boolean NOT NULL DEFAULT true,
        "last_login_at"         timestamptz,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" (lower("email"))`);

    // ── shopping_lists ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "shopping_lists" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"        varchar(120) NOT NULL,
        "description" varchar(400),
        "color"       varchar(9)  NOT NULL DEFAULT '#0d6efd',
        "icon"        varchar(8)  NOT NULL DEFAULT '🛒',
        "owner_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "is_archived" boolean NOT NULL DEFAULT false,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "idx_lists_owner" ON "shopping_lists" ("owner_id")`);

    // ── list_members ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "list_members" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "list_id"          uuid NOT NULL REFERENCES "shopping_lists"("id") ON DELETE CASCADE,
        "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role"             "list_members_role_enum" NOT NULL DEFAULT 'editor',
        "notify_on_change" boolean NOT NULL DEFAULT true,
        "joined_at"        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_list_member" UNIQUE ("list_id","user_id")
      )`);
    await queryRunner.query(`CREATE INDEX "idx_members_list" ON "list_members" ("list_id")`);
    await queryRunner.query(`CREATE INDEX "idx_members_user" ON "list_members" ("user_id")`);

    // ── list_items ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "list_items" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "list_id"             uuid NOT NULL REFERENCES "shopping_lists"("id") ON DELETE CASCADE,
        "name"                varchar(140) NOT NULL,
        "quantity"            numeric(10,2) NOT NULL DEFAULT 1,
        "unit"                varchar(20)  NOT NULL DEFAULT 'pza',
        "note"                varchar(300),
        "category"            varchar(40)  NOT NULL DEFAULT 'general',
        "status"              "list_items_status_enum" NOT NULL DEFAULT 'pending',
        "is_recurring"        boolean NOT NULL DEFAULT false,
        "recurrence_days"     integer,
        "activated_at"        timestamptz NOT NULL DEFAULT now(),
        "due_at"              timestamptz,
        "next_activation_at"  timestamptz,
        "purchased_at"        timestamptz,
        "purchased_by_id"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "last_purchased_at"   timestamptz,
        "cycle_count"         integer NOT NULL DEFAULT 0,
        "overdue_notified_at" timestamptz,
        "created_by_id"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "sort_order"          integer NOT NULL DEFAULT 0,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_recurrence_days" CHECK ("recurrence_days" IS NULL OR "recurrence_days" > 0)
      )`);
    await queryRunner.query(`CREATE INDEX "idx_item_list_status" ON "list_items" ("list_id","status")`);
    await queryRunner.query(`CREATE INDEX "idx_item_next_activation" ON "list_items" ("next_activation_at")`);
    await queryRunner.query(`CREATE INDEX "idx_item_due" ON "list_items" ("due_at")`);

    // ── list_invitations ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "list_invitations" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "list_id"       uuid NOT NULL REFERENCES "shopping_lists"("id") ON DELETE CASCADE,
        "email"         varchar(180) NOT NULL,
        "token"         varchar(64)  NOT NULL,
        "invited_by_id" uuid,
        "role"          "list_invitations_role_enum"   NOT NULL DEFAULT 'editor',
        "status"        "list_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at"    timestamptz NOT NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_invitation_token" ON "list_invitations" ("token")`);
    await queryRunner.query(`CREATE INDEX "idx_invitation_email" ON "list_invitations" ("email")`);
    await queryRunner.query(`CREATE INDEX "idx_invitation_list" ON "list_invitations" ("list_id")`);

    // ── device_tokens ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "device_tokens" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token"        varchar(255) NOT NULL,
        "platform"     "device_tokens_platform_enum" NOT NULL DEFAULT 'android',
        "device_name"  varchar(120),
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_device_token" ON "device_tokens" ("token")`);
    await queryRunner.query(`CREATE INDEX "idx_device_user" ON "device_tokens" ("user_id")`);

    // ── notifications ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "list_id"    uuid,
        "item_id"    uuid,
        "actor_id"   uuid,
        "type"       "notifications_type_enum" NOT NULL,
        "title"      varchar(160) NOT NULL,
        "body"       varchar(400) NOT NULL,
        "payload"    jsonb NOT NULL DEFAULT '{}'::jsonb,
        "channel"    "notifications_channel_enum" NOT NULL DEFAULT 'both',
        "is_read"    boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "idx_notifications_user" ON "notifications" ("user_id","is_read")`);

    // ── activity_logs ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "list_id"    uuid,
        "user_id"    uuid,
        "item_id"    uuid,
        "action"     varchar(60) NOT NULL,
        "summary"    varchar(240),
        "metadata"   jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "idx_activity_created" ON "activity_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_activity_action" ON "activity_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "idx_activity_list" ON "activity_logs" ("list_id")`);
    await queryRunner.query(`CREATE INDEX "idx_activity_user" ON "activity_logs" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "list_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "list_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "list_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shopping_lists"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    for (const type of [
      'notifications_channel_enum',
      'notifications_type_enum',
      'device_tokens_platform_enum',
      'list_invitations_status_enum',
      'list_invitations_role_enum',
      'list_items_status_enum',
      'list_members_role_enum',
      'users_role_enum',
      'users_provider_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${type}"`);
    }
  }
}
