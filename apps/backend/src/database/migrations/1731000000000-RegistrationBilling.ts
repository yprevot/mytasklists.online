import { MigrationInterface, QueryRunner } from 'typeorm';
export class RegistrationBilling1731000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized ON users (lower(trim(email)))`);
    await q.query(`CREATE TABLE registration_requests (
      email varchar(180) PRIMARY KEY, token_hash varchar(64) UNIQUE, locale varchar(2) NOT NULL DEFAULT 'es',
      expires_at timestamptz, consumed_at timestamptz, last_sent_at timestamptz,
      window_start timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE TABLE billing_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      provider varchar(20) NOT NULL, external_id varchar(200) NOT NULL, customer_id varchar(200),
      provider_token text, status varchar(30) NOT NULL, period_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider, external_id))`);
    await q.query(`CREATE TABLE billing_events (
      provider varchar(20) NOT NULL, event_id varchar(200) NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(provider, event_id))`);
    await q.query(`CREATE TABLE billing_accounts(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,customer_id varchar(200) UNIQUE NOT NULL)`);
    await q.query(`CREATE TABLE billing_checkouts(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, session_id varchar(200) NOT NULL, expires_at timestamptz NOT NULL)`);
    await q.query(`CREATE TABLE billing_promotions (
      code varchar(64) PRIMARY KEY, stripe_id varchar(200) NOT NULL, active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now())`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE billing_checkouts, billing_accounts, billing_promotions, billing_events, billing_subscriptions, registration_requests');
    await q.query('DROP INDEX users_email_normalized');
  }
}
