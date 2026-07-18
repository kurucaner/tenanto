import type { Pool, PoolClient } from "pg";

export const runMigrations = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();

  try {
    const migrationsTableMigration = migrations.find((m) => m.name === "create_migrations_table");
    if (migrationsTableMigration) {
      await migrationsTableMigration.up(client);
    }

    await client.query("SELECT pg_advisory_lock($1)", [8_424_242]);

    const result = await client.query("SELECT version FROM migrations ORDER BY version");
    const appliedVersions = new Set(result.rows.map((row) => row.version as number));

    for (const migration of migrations) {
      if (migration.name === "create_migrations_table") continue;

      if (!appliedVersions.has(migration.version)) {
        await client.query("BEGIN");
        try {
          await migration.up(client);

          await client.query("INSERT INTO migrations (version, name) VALUES ($1, $2)", [
            migration.version,
            migration.name,
          ]);

          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          console.error(`[DB] Migration v${migration.version} (${migration.name}) failed:`, error);
          throw error;
        }
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [8_424_242]).catch(() => undefined);
    client.release();
  }
};

type TDBClient = Pool | PoolClient;

const SOFT_DELETE_TABLES = [
  "property_reservations",
  "property_income_lines",
  "property_expenses",
  "property_units",
] as const;

interface IMigration {
  down: (client: TDBClient) => Promise<void>;
  name: string;
  up: (client: TDBClient) => Promise<void>;
  version: number;
}

export const migrations: IMigration[] = [
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS migrations CASCADE;`);
    },
    name: "create_migrations_table",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
    version: 0,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS users CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS user_type CASCADE;`);
      await client.query(`DROP FUNCTION IF EXISTS update_updated_at CASCADE;`);
    },
    name: "create_base_tables",
    up: async (client: TDBClient) => {
      // 1. Shared trigger function for updated_at
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // 2. Enums
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE user_type AS ENUM ('user', 'admin');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      // 3. Users table
      await client.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          google_id VARCHAR(255) UNIQUE,
          apple_id VARCHAR(255) UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255),
          user_type user_type NOT NULL DEFAULT 'user',
          onboarding_completed_at TIMESTAMP WITH TIME ZONE,
          is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
          deleted_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`CREATE INDEX idx_users_email ON users(LOWER(TRIM(email)));`);
    },
    version: 1,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
    },
    name: "create_refresh_tokens",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          revoked BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);`);
      await client.query(`CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);`);
    },
    version: 2,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS auth_otps CASCADE;`);
    },
    name: "create_auth_otps",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE auth_otps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          code_hash VARCHAR(255) NOT NULL,
          purpose VARCHAR(50) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(
        `CREATE INDEX idx_auth_otps_email_purpose ON auth_otps(LOWER(TRIM(email)), purpose);`
      );
    },
    version: 3,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS user_metadata CASCADE;`);
    },
    name: "create_user_metadata",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE user_metadata (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          app_version VARCHAR(255),
          country VARCHAR(255),
          device_brand VARCHAR(255),
          device_id VARCHAR(255),
          installation_id VARCHAR(255),
          locale VARCHAR(255),
          os_version VARCHAR(255),
          platform VARCHAR(255),
          timezone VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX idx_user_metadata_user_id ON user_metadata(user_id);`);
    },
    version: 4,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS user_account_events CASCADE;`);
    },
    name: "create_user_account_events",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE user_account_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type VARCHAR(64) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(
        `CREATE INDEX idx_user_account_events_user_id ON user_account_events(user_id);`
      );
      await client.query(
        `CREATE INDEX idx_user_account_events_created_at ON user_account_events(created_at DESC);`
      );
    },
    version: 5,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS admin_audit_events CASCADE;`);
    },
    name: "create_admin_audit_events",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE admin_audit_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actor_user_id UUID NOT NULL REFERENCES users(id),
          actor_email VARCHAR(255) NOT NULL,
          action VARCHAR(128) NOT NULL,
          resource_type VARCHAR(64) NOT NULL,
          resource_id UUID,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          ip_address INET,
          user_agent TEXT
        );
      `);
      await client.query(`
        CREATE INDEX idx_admin_audit_events_created_at_id
        ON admin_audit_events (created_at DESC, id DESC);
      `);
      await client.query(`
        CREATE INDEX idx_admin_audit_events_resource
        ON admin_audit_events (resource_type, resource_id, created_at DESC);
      `);
      await client.query(`
        CREATE INDEX idx_admin_audit_events_actor
        ON admin_audit_events (actor_user_id, created_at DESC);
      `);
    },
    version: 6,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS support_requests CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS support_request_status CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS support_category CASCADE;`);
    },
    name: "create_support_requests",
    up: async (client: TDBClient) => {
      await client.query(`CREATE TYPE support_category AS ENUM ('bug', 'feature', 'general');`);
      await client.query(
        `CREATE TYPE support_request_status AS ENUM ('pending', 'in_progress', 'resolved');`
      );
      await client.query(`
        CREATE TABLE support_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category support_category NOT NULL,
          message TEXT NOT NULL,
          status support_request_status NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE TRIGGER update_support_requests_updated_at
          BEFORE UPDATE ON support_requests
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
      await client.query(`CREATE INDEX idx_support_requests_user_id ON support_requests(user_id);`);
      await client.query(`CREATE INDEX idx_support_requests_status ON support_requests(status);`);
      await client.query(
        `CREATE INDEX idx_support_requests_created_at ON support_requests(created_at DESC);`
      );
    },
    version: 7,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS app_config CASCADE;`);
    },
    name: "create_app_config",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE app_config (
          id SERIAL PRIMARY KEY,
          min_ios_app_version VARCHAR(20) NOT NULL,
          min_android_app_version VARCHAR(20) NOT NULL,
          maintenance_mode BOOLEAN DEFAULT FALSE,
          app_store_url TEXT,
          play_store_url TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE TRIGGER update_app_config_updated_at
          BEFORE UPDATE ON app_config
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
      await client.query(`
        INSERT INTO app_config (min_ios_app_version, min_android_app_version)
        VALUES ('1.0.0', '1.0.0');
      `);
    },
    version: 8,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS email_unsubscribes CASCADE;`);
    },
    name: "create_email_unsubscribes",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE email_unsubscribes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email_lower ON email_unsubscribes(LOWER(TRIM(email)));`
      );
    },
    version: 9,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS push_tokens CASCADE;`);
    },
    name: "create_push_tokens",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE push_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          platform VARCHAR(20) NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);`);
      await client.query(
        `CREATE INDEX idx_push_tokens_user_active ON push_tokens(user_id, is_active);`
      );
    },
    version: 10,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_members CASCADE;`);
      await client.query(`DROP TABLE IF EXISTS properties CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_role CASCADE;`);
    },
    name: "create_properties",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_role AS ENUM ('owner', 'manager', 'accountant');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE properties (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          phone_number VARCHAR(50),
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_properties_updated_at
          BEFORE UPDATE ON properties
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`CREATE INDEX idx_properties_created_at ON properties(created_at DESC);`);
      await client.query(`CREATE INDEX idx_properties_created_by ON properties(created_by);`);

      await client.query(`
        CREATE TABLE property_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role property_role NOT NULL,
          added_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (property_id, user_id)
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_members_updated_at
          BEFORE UPDATE ON property_members
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(
        `CREATE INDEX idx_property_members_property_id ON property_members(property_id);`
      );
      await client.query(`CREATE INDEX idx_property_members_user_id ON property_members(user_id);`);
    },
    version: 11,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_invites CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_invite_status CASCADE;`);
    },
    name: "create_property_invites",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_invite_status AS ENUM ('pending', 'accepted', 'email_failed');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE property_invites (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          email       VARCHAR(255) NOT NULL,
          role        property_role NOT NULL,
          invited_by  UUID NOT NULL REFERENCES users(id),
          status      property_invite_status NOT NULL DEFAULT 'pending',
          email_error TEXT,
          expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (property_id, email)
        );
      `);

      await client.query(
        `CREATE INDEX idx_property_invites_email ON property_invites(LOWER(TRIM(email)));`
      );
      await client.query(
        `CREATE INDEX idx_property_invites_property_id ON property_invites(property_id);`
      );
    },
    version: 12,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_units CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_unit_rental_type CASCADE;`);
    },
    name: "create_property_units",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_unit_rental_type AS ENUM ('short_term', 'long_term');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE property_units (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          unit_number   VARCHAR(50) NOT NULL,
          rental_type   property_unit_rental_type NOT NULL DEFAULT 'short_term',
          layout        VARCHAR(20) NOT NULL,
          created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (property_id, unit_number)
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_units_updated_at
          BEFORE UPDATE ON property_units
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(
        `CREATE INDEX idx_property_units_property_id ON property_units(property_id);`
      );
    },
    version: 13,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_settings CASCADE;`);
    },
    name: "create_property_settings",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_settings (
          property_id                      UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
          sales_tax_rate                   NUMERIC(6,5) NOT NULL DEFAULT 0.06,
          miami_dade_surtax_rate           NUMERIC(6,5) NOT NULL DEFAULT 0.01,
          convention_development_tax_rate  NUMERIC(6,5) NOT NULL DEFAULT 0.03,
          resort_tax_rate                  NUMERIC(6,5) NOT NULL DEFAULT 0.04,
          airbnb_commission_rate           NUMERIC(6,5) NOT NULL DEFAULT 0.155,
          booking_commission_rate          NUMERIC(6,5) NOT NULL DEFAULT 0.15,
          expedia_commission_rate          NUMERIC(6,5) NOT NULL DEFAULT 0.15,
          direct_commission_rate           NUMERIC(6,5) NOT NULL DEFAULT 0.035,
          created_at                       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at                       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_settings_updated_at
          BEFORE UPDATE ON property_settings
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    },
    version: 14,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_reservations CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_reservation_status CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_reservation_channel CASCADE;`);
    },
    name: "create_property_reservations",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_reservation_status AS ENUM ('stayed', 'canceled', 'no_show', 'active');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_reservation_channel AS ENUM ('airbnb', 'booking', 'expedia', 'direct');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE property_reservations (
          id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id                   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          unit_id                       UUID NOT NULL REFERENCES property_units(id) ON DELETE RESTRICT,
          guest_name                    VARCHAR(255) NOT NULL,
          reservation_number            VARCHAR(100),
          check_in                      DATE NOT NULL,
          check_out                     DATE NOT NULL,
          nights                        INTEGER NOT NULL,
          status                        property_reservation_status NOT NULL DEFAULT 'active',
          channel                       property_reservation_channel NOT NULL,
          room_rate                     NUMERIC(12,2) NOT NULL DEFAULT 0,
          cleaning_fee                  NUMERIC(12,2) NOT NULL DEFAULT 0,
          gross_income                  NUMERIC(12,2) NOT NULL DEFAULT 0,
          sales_tax                     NUMERIC(12,2) NOT NULL DEFAULT 0,
          miami_dade_surtax             NUMERIC(12,2) NOT NULL DEFAULT 0,
          convention_development_tax    NUMERIC(12,2) NOT NULL DEFAULT 0,
          resort_tax                    NUMERIC(12,2) NOT NULL DEFAULT 0,
          channel_commission            NUMERIC(12,2) NOT NULL DEFAULT 0,
          net_income                    NUMERIC(12,2) NOT NULL DEFAULT 0,
          created_at                    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_reservations_updated_at
          BEFORE UPDATE ON property_reservations
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(
        `CREATE INDEX idx_property_reservations_property_id ON property_reservations(property_id);`
      );
      await client.query(
        `CREATE INDEX idx_property_reservations_property_check_in ON property_reservations(property_id, check_in DESC);`
      );
      await client.query(
        `CREATE INDEX idx_property_reservations_unit_id ON property_reservations(unit_id);`
      );
    },
    version: 15,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_income_lines CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_income_line_type CASCADE;`);
    },
    name: "create_property_income_lines",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_income_line_type AS ENUM (
            'cleaning_only',
            'extra_cleaning',
            'extra_service',
            'beach_equipment_rental'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE property_income_lines (
          id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id                   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          unit_id                       UUID NOT NULL REFERENCES property_units(id) ON DELETE RESTRICT,
          reservation_id                UUID REFERENCES property_reservations(id) ON DELETE SET NULL,
          line_type                     property_income_line_type NOT NULL,
          amount                        NUMERIC(12,2) NOT NULL,
          transaction_date              DATE NOT NULL,
          description                   TEXT,
          guest_name                    VARCHAR(255),
          gross_income                  NUMERIC(12,2) NOT NULL DEFAULT 0,
          sales_tax                     NUMERIC(12,2) NOT NULL DEFAULT 0,
          miami_dade_surtax             NUMERIC(12,2) NOT NULL DEFAULT 0,
          convention_development_tax    NUMERIC(12,2) NOT NULL DEFAULT 0,
          resort_tax                    NUMERIC(12,2) NOT NULL DEFAULT 0,
          channel_commission            NUMERIC(12,2) NOT NULL DEFAULT 0,
          net_income                    NUMERIC(12,2) NOT NULL DEFAULT 0,
          created_at                    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_income_lines_updated_at
          BEFORE UPDATE ON property_income_lines
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(
        `CREATE INDEX idx_property_income_lines_property_date ON property_income_lines(property_id, transaction_date DESC);`
      );
      await client.query(
        `CREATE INDEX idx_property_income_lines_unit_id ON property_income_lines(unit_id);`
      );
      await client.query(
        `CREATE INDEX idx_property_income_lines_reservation_id ON property_income_lines(reservation_id) WHERE reservation_id IS NOT NULL;`
      );
    },
    version: 16,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_expenses CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS property_expense_category CASCADE;`);
    },
    name: "create_property_expenses",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_expense_category AS ENUM (
            'airbnb_commission',
            'booking_commission',
            'expedia_commission',
            'merchant_commission',
            'property_tax',
            'insurance',
            'credit_payment',
            'electricity',
            'water',
            'internet',
            'gas',
            'fire_alarm',
            'sewerage',
            'waste_management',
            'phone',
            'legal_fee_permit',
            'subscription',
            'cleaning',
            'salary',
            'material',
            'maintenance',
            'other'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE property_expenses (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          category        property_expense_category NOT NULL,
          amount          NUMERIC(12,2) NOT NULL,
          expense_date    DATE,
          person_name     VARCHAR(255),
          description     TEXT,
          created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_expenses_updated_at
          BEFORE UPDATE ON property_expenses
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(
        `CREATE INDEX idx_property_expenses_property_date ON property_expenses(property_id, expense_date DESC NULLS LAST);`
      );
      await client.query(
        `CREATE INDEX idx_property_expenses_property_category ON property_expenses(property_id, category);`
      );
    },
    version: 17,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS message TEXT;`);
      await client.query(`
        UPDATE support_requests sr
        SET message = (
          SELECT sm.body
          FROM support_messages sm
          WHERE sm.support_request_id = sr.id
          ORDER BY sm.created_at ASC, sm.id ASC
          LIMIT 1
        )
        WHERE message IS NULL;
      `);
      await client.query(`ALTER TABLE support_requests ALTER COLUMN message SET NOT NULL;`);
      await client.query(`DROP TABLE IF EXISTS support_messages CASCADE;`);
    },
    name: "create_support_messages",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE support_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          support_request_id UUID NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
          author_user_id UUID NOT NULL REFERENCES users(id),
          body TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX idx_support_messages_request_created
        ON support_messages (support_request_id, created_at ASC, id ASC);
      `);
      await client.query(`
        INSERT INTO support_messages (support_request_id, author_user_id, body, created_at)
        SELECT id, user_id, message, created_at
        FROM support_requests
        WHERE message IS NOT NULL AND message <> '';
      `);
      await client.query(`ALTER TABLE support_requests DROP COLUMN message;`);
    },
    version: 18,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        DELETE FROM property_members pm
        USING properties p
        WHERE pm.property_id = p.id
          AND pm.user_id = p.created_by
          AND pm.added_by = p.created_by
          AND pm.role = 'owner'::property_role;
      `);
    },
    name: "backfill_property_creator_members",
    up: async (client: TDBClient) => {
      await client.query(`
        INSERT INTO property_members (property_id, user_id, role, added_by)
        SELECT p.id, p.created_by, 'owner'::property_role, p.created_by
        FROM properties p
        WHERE NOT EXISTS (
          SELECT 1
          FROM property_members pm
          WHERE pm.property_id = p.id AND pm.user_id = p.created_by
        );
      `);
    },
    version: 19,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS user_notifications CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS user_notification_type CASCADE;`);
    },
    name: "create_user_notifications",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TYPE user_notification_type AS ENUM (
          'property_member_added',
          'property_member_removed',
          'support_request_reply'
        );
      `);
      await client.query(`
        CREATE TABLE user_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type user_notification_type NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          resource_type VARCHAR(64),
          resource_id UUID,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX idx_user_notifications_user_created_id
        ON user_notifications (user_id, created_at DESC, id DESC);
      `);
      await client.query(`
        CREATE INDEX idx_user_notifications_user_unread
        ON user_notifications (user_id)
        WHERE read_at IS NULL;
      `);
    },
    version: 20,
  },
  {
    down: async () => {
      // PostgreSQL does not support removing enum values; no-op.
    },
    name: "add_support_request_status_changed_notification_type",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TYPE user_notification_type ADD VALUE IF NOT EXISTS 'support_request_status_changed';
      `);
    },
    version: 21,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS support_message_attachments;`);
    },
    name: "create_support_message_attachments",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE support_message_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          support_message_id UUID NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
          storage_key TEXT NOT NULL,
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX idx_support_message_attachments_message_id
        ON support_message_attachments (support_message_id);
      `);
    },
    version: 22,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS support_staged_uploads;`);
      await client.query(`DROP TYPE IF EXISTS support_staged_upload_status;`);
    },
    name: "create_support_staged_uploads",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TYPE support_staged_upload_status AS ENUM ('pending', 'confirmed', 'linked');
      `);
      await client.query(`
        CREATE TABLE support_staged_uploads (
          storage_key TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          status support_staged_upload_status NOT NULL DEFAULT 'pending',
          confirmed_at TIMESTAMPTZ,
          linked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX idx_support_staged_uploads_user_status
        ON support_staged_uploads (user_id, status);
      `);
    },
    version: 23,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN IF NOT EXISTS sales_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS miami_dade_surtax NUMERIC(12,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS convention_development_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS resort_tax NUMERIC(12,2) NOT NULL DEFAULT 0;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN IF NOT EXISTS sales_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS miami_dade_surtax NUMERIC(12,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS convention_development_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS resort_tax NUMERIC(12,2) NOT NULL DEFAULT 0;
      `);
      await client.query(`
        ALTER TABLE property_settings
          ADD COLUMN IF NOT EXISTS sales_tax_rate NUMERIC(6,5) NOT NULL DEFAULT 0.06,
          ADD COLUMN IF NOT EXISTS miami_dade_surtax_rate NUMERIC(6,5) NOT NULL DEFAULT 0.01,
          ADD COLUMN IF NOT EXISTS convention_development_tax_rate NUMERIC(6,5) NOT NULL DEFAULT 0.03,
          ADD COLUMN IF NOT EXISTS resort_tax_rate NUMERIC(6,5) NOT NULL DEFAULT 0.04;
      `);
      await client.query(`DROP TABLE IF EXISTS property_tax_rates CASCADE;`);
      await client.query(`
        ALTER TABLE property_reservations DROP COLUMN IF EXISTS tax_breakdown;
      `);
      await client.query(`
        ALTER TABLE property_income_lines DROP COLUMN IF EXISTS tax_breakdown;
      `);
    },
    name: "property_tax_rates",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_tax_rates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          rate NUMERIC(6,5) NOT NULL CHECK (rate >= 0 AND rate <= 1),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX idx_property_tax_rates_property
        ON property_tax_rates (property_id, sort_order);
      `);
      await client.query(`
        CREATE TRIGGER update_property_tax_rates_updated_at
          BEFORE UPDATE ON property_tax_rates
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        INSERT INTO property_tax_rates (property_id, name, rate, sort_order)
        SELECT property_id, 'Sales tax', sales_tax_rate, 0 FROM property_settings
        UNION ALL
        SELECT property_id, 'Miami-Dade surtax', miami_dade_surtax_rate, 1 FROM property_settings
        UNION ALL
        SELECT property_id, 'Convention development tax (CDT)', convention_development_tax_rate, 2 FROM property_settings
        UNION ALL
        SELECT property_id, 'Resort tax', resort_tax_rate, 3 FROM property_settings;
      `);

      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN tax_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);
      await client.query(`
        UPDATE property_reservations pr
        SET tax_breakdown = COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'taxRateId', ptr.id::text,
                'name', ptr.name,
                'rate', ptr.rate,
                'amount', CASE ptr.sort_order
                  WHEN 0 THEN pr.sales_tax
                  WHEN 1 THEN pr.miami_dade_surtax
                  WHEN 2 THEN pr.convention_development_tax
                  WHEN 3 THEN pr.resort_tax
                END
              )
              ORDER BY ptr.sort_order
            )
            FROM property_tax_rates ptr
            WHERE ptr.property_id = pr.property_id
          ),
          '[]'::jsonb
        );
      `);

      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN tax_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);
      await client.query(`
        UPDATE property_income_lines pil
        SET tax_breakdown = COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'taxRateId', ptr.id::text,
                'name', ptr.name,
                'rate', ptr.rate,
                'amount', CASE ptr.sort_order
                  WHEN 0 THEN pil.sales_tax
                  WHEN 1 THEN pil.miami_dade_surtax
                  WHEN 2 THEN pil.convention_development_tax
                  WHEN 3 THEN pil.resort_tax
                END
              )
              ORDER BY ptr.sort_order
            )
            FROM property_tax_rates ptr
            WHERE ptr.property_id = pil.property_id
          ),
          '[]'::jsonb
        );
      `);

      await client.query(`
        ALTER TABLE property_settings
          DROP COLUMN sales_tax_rate,
          DROP COLUMN miami_dade_surtax_rate,
          DROP COLUMN convention_development_tax_rate,
          DROP COLUMN resort_tax_rate;
      `);
      await client.query(`
        ALTER TABLE property_reservations
          DROP COLUMN sales_tax,
          DROP COLUMN miami_dade_surtax,
          DROP COLUMN convention_development_tax,
          DROP COLUMN resort_tax;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN sales_tax,
          DROP COLUMN miami_dade_surtax,
          DROP COLUMN convention_development_tax,
          DROP COLUMN resort_tax;
      `);
    },
    version: 24,
  },
  {
    down: async (_client: TDBClient) => {
      // No rollback for recalculated stay income values.
    },
    name: "recalculate_stay_income_per_night_room_rate",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE OR REPLACE FUNCTION migrate_recalc_stay_income(
          p_nights INTEGER,
          p_room_rate NUMERIC,
          p_cleaning_fee NUMERIC,
          p_channel property_reservation_channel,
          p_rental_type property_unit_rental_type,
          p_property_id UUID,
          p_airbnb_commission_rate NUMERIC,
          p_booking_commission_rate NUMERIC,
          p_expedia_commission_rate NUMERIC,
          p_direct_commission_rate NUMERIC
        )
        RETURNS TABLE (
          gross_income NUMERIC,
          tax_breakdown JSONB,
          channel_commission NUMERIC,
          net_income NUMERIC
        )
        LANGUAGE plpgsql
        IMMUTABLE
        AS $$
        DECLARE
          v_room_total NUMERIC;
          v_taxable_base NUMERIC;
          v_total_taxes NUMERIC;
          v_commission_rate NUMERIC;
          v_commission NUMERIC;
        BEGIN
          v_room_total := ROUND(p_room_rate * p_nights, 2);

          IF p_rental_type = 'long_term'::property_unit_rental_type THEN
            gross_income := v_room_total;
            tax_breakdown := '[]'::jsonb;
            channel_commission := 0;
            net_income := v_room_total;
            RETURN NEXT;
            RETURN;
          END IF;

          v_taxable_base := ROUND(v_room_total + p_cleaning_fee, 2);

          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'taxRateId', ptr.id::text,
                'name', ptr.name,
                'rate', ptr.rate,
                'amount', ROUND(v_taxable_base * ptr.rate, 2)
              )
              ORDER BY ptr.sort_order
            ),
            '[]'::jsonb
          )
          INTO tax_breakdown
          FROM property_tax_rates ptr
          WHERE ptr.property_id = p_property_id;

          SELECT COALESCE(SUM((item->>'amount')::numeric), 0)
          INTO v_total_taxes
          FROM jsonb_array_elements(tax_breakdown) AS item;

          v_commission_rate := CASE p_channel
            WHEN 'airbnb'::property_reservation_channel THEN p_airbnb_commission_rate
            WHEN 'booking'::property_reservation_channel THEN p_booking_commission_rate
            WHEN 'expedia'::property_reservation_channel THEN p_expedia_commission_rate
            WHEN 'direct'::property_reservation_channel THEN p_direct_commission_rate
          END;
          v_commission := ROUND(v_taxable_base * v_commission_rate, 2);

          gross_income := ROUND(v_taxable_base + v_total_taxes, 2);
          channel_commission := v_commission;
          net_income := ROUND(v_taxable_base - v_total_taxes - v_commission, 2);
          RETURN NEXT;
        END;
        $$;
      `);

      await client.query(`
        UPDATE property_reservations pr
        SET
          gross_income = sub.gross_income,
          tax_breakdown = sub.tax_breakdown,
          channel_commission = sub.channel_commission,
          net_income = sub.net_income
        FROM (
          SELECT
            pr_inner.id,
            calc.gross_income,
            calc.tax_breakdown,
            calc.channel_commission,
            calc.net_income
          FROM property_reservations pr_inner
          INNER JOIN property_units pu ON pr_inner.unit_id = pu.id
          INNER JOIN property_settings ps ON ps.property_id = pr_inner.property_id
          CROSS JOIN LATERAL migrate_recalc_stay_income(
            pr_inner.nights,
            pr_inner.room_rate,
            pr_inner.cleaning_fee,
            pr_inner.channel,
            pu.rental_type,
            pr_inner.property_id,
            ps.airbnb_commission_rate,
            ps.booking_commission_rate,
            ps.expedia_commission_rate,
            ps.direct_commission_rate
          ) calc
        ) sub
        WHERE pr.id = sub.id;
      `);

      await client.query(`DROP FUNCTION IF EXISTS migrate_recalc_stay_income(
        INTEGER, NUMERIC, NUMERIC, property_reservation_channel, property_unit_rental_type,
        UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC
      );`);
    },
    version: 25,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`ALTER TABLE properties DROP COLUMN IF EXISTS legal_name;`);
    },
    name: "add_property_legal_name",
    up: async (client: TDBClient) => {
      await client.query(`ALTER TABLE properties ADD COLUMN legal_name VARCHAR(255);`);
    },
    version: 26,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`ALTER TABLE property_units DROP COLUMN IF EXISTS unit_kind;`);
      await client.query(`DROP TYPE IF EXISTS property_unit_kind;`);
    },
    name: "add_property_unit_kind",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_unit_kind AS ENUM ('rentable', 'amenity');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await client.query(`
        ALTER TABLE property_units
          ADD COLUMN unit_kind property_unit_kind NOT NULL DEFAULT 'rentable';
      `);
    },
    version: 27,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_income_line_type AS ENUM (
            'cleaning_only',
            'extra_cleaning',
            'extra_service',
            'beach_equipment_rental'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN line_type property_income_line_type;
      `);
      await client.query(`
        UPDATE property_income_lines pil
        SET line_type = CASE ilt.name
          WHEN 'Extra cleaning' THEN 'extra_cleaning'::property_income_line_type
          WHEN 'Beach equipment rental' THEN 'beach_equipment_rental'::property_income_line_type
          WHEN 'Cleaning only' THEN 'cleaning_only'::property_income_line_type
          WHEN 'Extra service' THEN 'extra_service'::property_income_line_type
          ELSE 'extra_cleaning'::property_income_line_type
        END
        FROM property_income_line_types ilt
        WHERE ilt.id = pil.income_line_type_id;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          ALTER COLUMN line_type SET NOT NULL;
      `);
      await client.query(`
        DROP INDEX IF EXISTS idx_property_income_lines_income_line_type_id;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN income_line_type_id;
      `);
      await client.query(`DROP TABLE IF EXISTS property_income_line_types;`);
    },
    name: "property_income_line_types",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_income_line_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          name VARCHAR(80) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        INSERT INTO property_income_line_types (property_id, name, sort_order)
        SELECT p.id, 'Extra cleaning', 0
        FROM properties p
        UNION ALL
        SELECT p.id, 'Beach equipment rental', 1
        FROM properties p;
      `);

      await client.query(`
        INSERT INTO property_income_line_types (property_id, name, sort_order)
        SELECT DISTINCT pil.property_id, 'Cleaning only', 2
        FROM property_income_lines pil
        WHERE pil.line_type = 'cleaning_only'
          AND NOT EXISTS (
            SELECT 1
            FROM property_income_line_types t
            WHERE t.property_id = pil.property_id
              AND t.name = 'Cleaning only'
          );
      `);

      await client.query(`
        INSERT INTO property_income_line_types (property_id, name, sort_order)
        SELECT DISTINCT pil.property_id, 'Extra service', 3
        FROM property_income_lines pil
        WHERE pil.line_type = 'extra_service'
          AND NOT EXISTS (
            SELECT 1
            FROM property_income_line_types t
            WHERE t.property_id = pil.property_id
              AND t.name = 'Extra service'
          );
      `);

      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN income_line_type_id UUID REFERENCES property_income_line_types(id);
      `);

      await client.query(`
        UPDATE property_income_lines pil
        SET income_line_type_id = t.id
        FROM property_income_line_types t
        WHERE t.property_id = pil.property_id
          AND (
            (pil.line_type = 'extra_cleaning' AND t.name = 'Extra cleaning')
            OR (pil.line_type = 'beach_equipment_rental' AND t.name = 'Beach equipment rental')
            OR (pil.line_type = 'cleaning_only' AND t.name = 'Cleaning only')
            OR (pil.line_type = 'extra_service' AND t.name = 'Extra service')
          );
      `);

      await client.query(`
        ALTER TABLE property_income_lines
          ALTER COLUMN income_line_type_id SET NOT NULL;
      `);

      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN line_type;
      `);

      await client.query(`DROP TYPE property_income_line_type;`);

      await client.query(`
        CREATE INDEX idx_property_income_lines_income_line_type_id
          ON property_income_lines(income_line_type_id);
      `);
    },
    version: 28,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          DROP COLUMN IF EXISTS channel_commission_rate;
      `);
    },
    name: "add_property_reservations_channel_commission_rate",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN channel_commission_rate NUMERIC(6,5) NOT NULL DEFAULT 0;
      `);

      await client.query(`
        UPDATE property_reservations pr
        SET channel_commission_rate = CASE
          WHEN pu.rental_type = 'long_term'::property_unit_rental_type THEN 0
          WHEN pr.channel_commission = 0 THEN 0
          ELSE CASE pr.channel
            WHEN 'airbnb'::property_reservation_channel THEN ps.airbnb_commission_rate
            WHEN 'booking'::property_reservation_channel THEN ps.booking_commission_rate
            WHEN 'expedia'::property_reservation_channel THEN ps.expedia_commission_rate
            WHEN 'direct'::property_reservation_channel THEN ps.direct_commission_rate
          END
        END
        FROM property_units pu
        INNER JOIN property_settings ps ON ps.property_id = pu.property_id
        WHERE pu.id = pr.unit_id;
      `);
    },
    version: 29,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_unit_kind AS ENUM ('rentable', 'amenity');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await client.query(`
        ALTER TABLE property_units
          ADD COLUMN unit_kind property_unit_kind NOT NULL DEFAULT 'rentable';
      `);
    },
    name: "remove_property_unit_kind",
    up: async (client: TDBClient) => {
      await client.query(`
        DELETE FROM property_income_lines pil
        USING property_units pu
        WHERE pil.unit_id = pu.id
          AND pu.unit_kind = 'amenity';
      `);
      await client.query(`
        DELETE FROM property_units
        WHERE unit_kind = 'amenity';
      `);
      await client.query(`ALTER TABLE property_units DROP COLUMN unit_kind;`);
      await client.query(`DROP TYPE property_unit_kind;`);
    },
    version: 30,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_long_stays CASCADE;`);
    },
    name: "create_property_long_stays",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_long_stays (
          id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          unit_id           UUID NOT NULL REFERENCES property_units(id) ON DELETE RESTRICT,
          guest_name        VARCHAR(255) NOT NULL,
          lease_start_date  DATE NOT NULL,
          term_months       INTEGER NOT NULL,
          monthly_rent      NUMERIC(12,2) NOT NULL DEFAULT 0,
          created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_long_stays_updated_at
          BEFORE UPDATE ON property_long_stays
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(
        `CREATE INDEX idx_property_long_stays_property_id ON property_long_stays(property_id);`
      );
      await client.query(
        `CREATE INDEX idx_property_long_stays_unit_id ON property_long_stays(unit_id);`
      );
    },
    version: 31,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`ALTER TABLE property_expenses DROP COLUMN IF EXISTS tax_free;`);
    },
    name: "add_property_expenses_tax_free",
    up: async (client: TDBClient) => {
      await client.query(
        `ALTER TABLE property_expenses ADD COLUMN IF NOT EXISTS tax_free BOOLEAN NOT NULL DEFAULT FALSE;`
      );
    },
    version: 32,
  },
  {
    down: async (client: TDBClient) => {
      // Reverts to NOT NULL; fails if any property-amenity (null unit) rows exist.
      await client.query(`ALTER TABLE property_income_lines ALTER COLUMN unit_id SET NOT NULL;`);
    },
    name: "property_income_lines_unit_id_nullable",
    up: async (client: TDBClient) => {
      await client.query(`ALTER TABLE property_income_lines ALTER COLUMN unit_id DROP NOT NULL;`);
    },
    version: 33,
  },
  {
    // Airbnb now excludes the resort tax from gross and payout. Backfill existing Airbnb
    // reservations by subtracting their stored "Resort tax" breakdown amount from
    // gross_income and net_income (uses the snapshot amount, not current tax settings).
    down: async (client: TDBClient) => {
      await client.query(`
        UPDATE property_reservations pr
        SET gross_income = ROUND((pr.gross_income + rt.resort_amount)::numeric, 2),
            net_income   = ROUND((pr.net_income   + rt.resort_amount)::numeric, 2)
        FROM (
          SELECT r.id, COALESCE((
              SELECT (elem->>'amount')::numeric
              FROM jsonb_array_elements(COALESCE(r.tax_breakdown, '[]'::jsonb)) AS elem
              WHERE lower(elem->>'name') = lower('Resort tax') LIMIT 1
            ), 0) AS resort_amount
          FROM property_reservations r
          WHERE r.channel = 'airbnb'
        ) rt
        WHERE pr.id = rt.id AND rt.resort_amount <> 0;
      `);
    },
    name: "backfill_airbnb_exclude_resort_tax",
    up: async (client: TDBClient) => {
      await client.query(`
        UPDATE property_reservations pr
        SET gross_income = ROUND((pr.gross_income - rt.resort_amount)::numeric, 2),
            net_income   = ROUND((pr.net_income   - rt.resort_amount)::numeric, 2)
        FROM (
          SELECT r.id, COALESCE((
              SELECT (elem->>'amount')::numeric
              FROM jsonb_array_elements(COALESCE(r.tax_breakdown, '[]'::jsonb)) AS elem
              WHERE lower(elem->>'name') = lower('Resort tax') LIMIT 1
            ), 0) AS resort_amount
          FROM property_reservations r
          WHERE r.channel = 'airbnb'
        ) rt
        WHERE pr.id = rt.id AND rt.resort_amount <> 0;
      `);
    },
    version: 34,
  },
  {
    down: async (client: TDBClient) => {
      for (const table of SOFT_DELETE_TABLES) {
        await client.query(`
          ALTER TABLE ${table}
            DROP COLUMN IF EXISTS is_deleted,
            DROP COLUMN IF EXISTS deleted_at;
        `);
      }
    },
    name: "add_soft_delete_columns",
    up: async (client: TDBClient) => {
      for (const table of SOFT_DELETE_TABLES) {
        await client.query(`
          ALTER TABLE ${table}
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        `);
      }
    },
    version: 35,
  },
  {
    down: async (_client: TDBClient) => {
      // Irreversible: room_total cannot be losslessly converted back to per-night room_rate.
    },
    name: "room_rate_to_room_total",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM property_reservations WHERE nights < 1) THEN
            RAISE EXCEPTION 'room_total migration: nights must be >= 1';
          END IF;
        END $$;
      `);

      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN IF NOT EXISTS room_total NUMERIC(12,2);
      `);

      await client.query(`
        UPDATE property_reservations
        SET room_total = ROUND(room_rate * nights, 2)
        WHERE room_total IS NULL;
      `);

      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM property_reservations WHERE room_total IS NULL) THEN
            RAISE EXCEPTION 'room_total migration: backfill incomplete';
          END IF;
        END $$;
      `);

      await client.query(`
        ALTER TABLE property_reservations
          ALTER COLUMN room_total SET NOT NULL,
          ALTER COLUMN room_total SET DEFAULT 0;
      `);

      await client.query(`
        ALTER TABLE property_reservations DROP COLUMN room_rate;
      `);
    },
    version: 36,
  },
  {
    down: async (_client: TDBClient) => {
      // Irreversible: cannot restore prior Expedia commission amounts.
    },
    name: "backfill_expedia_commission_base",
    up: async (client: TDBClient) => {
      await client.query(`
        UPDATE property_reservations
        SET
          channel_commission = ROUND(room_total * channel_commission_rate, 2),
          net_income = ROUND(
            net_income + channel_commission - ROUND(room_total * channel_commission_rate, 2),
            2
          )
        WHERE channel = 'expedia'::property_reservation_channel;
      `);
    },
    version: 37,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_income_lines
          DROP CONSTRAINT IF EXISTS property_income_lines_reservation_or_long_stay_exclusive;
      `);
      await client.query(`DROP INDEX IF EXISTS idx_property_income_lines_long_stay_id;`);
      await client.query(`ALTER TABLE property_income_lines DROP COLUMN IF EXISTS long_stay_id;`);
      await client.query(`DROP INDEX IF EXISTS idx_property_long_stays_active_unit;`);
      await client.query(`DROP INDEX IF EXISTS idx_property_long_stays_property_status;`);
      await client.query(`
        ALTER TABLE property_long_stays
          DROP COLUMN IF EXISTS tenant_phone,
          DROP COLUMN IF EXISTS tenant_email,
          DROP COLUMN IF EXISTS actual_end_date,
          DROP COLUMN IF EXISTS lease_end_date,
          DROP COLUMN IF EXISTS status;
      `);
      await client.query(`DROP TYPE IF EXISTS property_long_stay_status;`);
      await client.query(`
        DELETE FROM property_income_line_types
        WHERE name = 'Rent';
      `);
    },
    name: "long_stay_leases_mvp",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TYPE property_long_stay_status AS ENUM ('active', 'ended');
      `);

      await client.query(`
        ALTER TABLE property_long_stays
          ADD COLUMN status property_long_stay_status NOT NULL DEFAULT 'active',
          ADD COLUMN lease_end_date DATE,
          ADD COLUMN actual_end_date DATE,
          ADD COLUMN tenant_email VARCHAR(255),
          ADD COLUMN tenant_phone VARCHAR(50);
      `);

      await client.query(`
        UPDATE property_long_stays
        SET lease_end_date = (lease_start_date + (term_months || ' months')::interval)::date;
      `);

      await client.query(`
        ALTER TABLE property_long_stays
          ALTER COLUMN lease_end_date SET NOT NULL;
      `);

      // End duplicate active leases per unit, keeping the latest by start date.
      await client.query(`
        UPDATE property_long_stays pls
        SET
          status = 'ended',
          actual_end_date = pls.lease_end_date
        FROM (
          SELECT id
          FROM (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY unit_id
                ORDER BY lease_start_date DESC, created_at DESC
              ) AS rn
            FROM property_long_stays
          ) ranked
          WHERE rn > 1
        ) duplicates
        WHERE pls.id = duplicates.id;
      `);

      await client.query(`
        CREATE UNIQUE INDEX idx_property_long_stays_active_unit
          ON property_long_stays (unit_id)
          WHERE status = 'active';
      `);

      await client.query(`
        CREATE INDEX idx_property_long_stays_property_status
          ON property_long_stays (property_id, status);
      `);

      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN long_stay_id UUID REFERENCES property_long_stays(id) ON DELETE SET NULL;
      `);

      await client.query(`
        CREATE INDEX idx_property_income_lines_long_stay_id
          ON property_income_lines (long_stay_id);
      `);

      await client.query(`
        ALTER TABLE property_income_lines
          ADD CONSTRAINT property_income_lines_reservation_or_long_stay_exclusive
          CHECK (
            reservation_id IS NULL OR long_stay_id IS NULL
          );
      `);

      await client.query(`
        INSERT INTO property_income_line_types (property_id, name, sort_order)
        SELECT p.id, 'Rent', -1
        FROM properties p
        WHERE NOT EXISTS (
          SELECT 1
          FROM property_income_line_types t
          WHERE t.property_id = p.id
            AND LOWER(t.name) = 'rent'
        );
      `);
    },
    version: 38,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        CREATE UNIQUE INDEX idx_property_long_stays_active_unit
          ON property_long_stays (unit_id)
          WHERE status = 'active';
      `);
    },
    name: "allow_multiple_active_leases_per_unit",
    up: async (client: TDBClient) => {
      await client.query(`DROP INDEX IF EXISTS idx_property_long_stays_active_unit;`);
    },
    version: 39,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_long_stays DROP COLUMN IF EXISTS secondary_tenants;
      `);
      await client.query(`DROP INDEX IF EXISTS idx_property_long_stays_active_unit;`);
    },
    name: "primary_lease_secondary_tenants",
    up: async (client: TDBClient) => {
      await client.query(`
        UPDATE property_long_stays pls
        SET
          status = 'ended',
          actual_end_date = pls.lease_end_date
        FROM (
          SELECT id
          FROM (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY unit_id
                ORDER BY lease_start_date DESC, created_at DESC
              ) AS rn
            FROM property_long_stays
            WHERE status = 'active'
          ) ranked
          WHERE rn > 1
        ) duplicates
        WHERE pls.id = duplicates.id;
      `);

      await client.query(`
        CREATE UNIQUE INDEX idx_property_long_stays_active_unit
          ON property_long_stays (unit_id)
          WHERE status = 'active';
      `);

      await client.query(`
        ALTER TABLE property_long_stays
          ADD COLUMN IF NOT EXISTS secondary_tenants JSONB NOT NULL DEFAULT '[]';
      `);
    },
    version: 40,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(
        `ALTER TABLE property_expenses ADD COLUMN IF NOT EXISTS person_name VARCHAR(255);`
      );
    },
    name: "drop_property_expenses_person_name",
    up: async (client: TDBClient) => {
      await client.query(`ALTER TABLE property_expenses DROP COLUMN IF EXISTS person_name;`);
    },
    version: 41,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_long_stay_rent_periods;`);
    },
    name: "long_stay_rent_periods",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_long_stay_rent_periods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          long_stay_id UUID NOT NULL REFERENCES property_long_stays(id) ON DELETE CASCADE,
          effective_from_month CHAR(7) NOT NULL,
          monthly_rent NUMERIC(12,2) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (long_stay_id, effective_from_month)
        );
      `);
      await client.query(`
        CREATE INDEX idx_property_long_stay_rent_periods_long_stay
          ON property_long_stay_rent_periods (long_stay_id, effective_from_month DESC);
      `);
    },
    version: 42,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE support_messages
          DROP CONSTRAINT support_messages_author_user_id_fkey;
      `);
      await client.query(`
        ALTER TABLE support_messages
          ADD CONSTRAINT support_messages_author_user_id_fkey
          FOREIGN KEY (author_user_id) REFERENCES users(id);
      `);
    },
    name: "support_messages_author_user_cascade_delete",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE support_messages
          DROP CONSTRAINT support_messages_author_user_id_fkey;
      `);
      await client.query(`
        ALTER TABLE support_messages
          ADD CONSTRAINT support_messages_author_user_id_fkey
          FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE;
      `);
    },
    version: 43,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_invites
          DROP CONSTRAINT property_invites_invited_by_fkey;
      `);
      await client.query(`
        ALTER TABLE property_invites
          ADD CONSTRAINT property_invites_invited_by_fkey
          FOREIGN KEY (invited_by) REFERENCES users(id);
      `);

      await client.query(`
        ALTER TABLE property_members
          DROP CONSTRAINT property_members_added_by_fkey;
      `);
      await client.query(`
        UPDATE property_members SET added_by = user_id WHERE added_by IS NULL;
      `);
      await client.query(`
        ALTER TABLE property_members ALTER COLUMN added_by SET NOT NULL;
      `);
      await client.query(`
        ALTER TABLE property_members
          ADD CONSTRAINT property_members_added_by_fkey
          FOREIGN KEY (added_by) REFERENCES users(id);
      `);

      await client.query(`
        ALTER TABLE properties
          DROP CONSTRAINT properties_created_by_fkey;
      `);
      await client.query(`
        ALTER TABLE properties
          ADD CONSTRAINT properties_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id);
      `);

      await client.query(`
        ALTER TABLE admin_audit_events
          DROP CONSTRAINT admin_audit_events_actor_user_id_fkey;
      `);
      await client.query(`
        DELETE FROM admin_audit_events WHERE actor_user_id IS NULL;
      `);
      await client.query(`
        ALTER TABLE admin_audit_events ALTER COLUMN actor_user_id SET NOT NULL;
      `);
      await client.query(`
        ALTER TABLE admin_audit_events
          ADD CONSTRAINT admin_audit_events_actor_user_id_fkey
          FOREIGN KEY (actor_user_id) REFERENCES users(id);
      `);
    },
    name: "users_foreign_keys_delete_behavior",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE admin_audit_events
          DROP CONSTRAINT admin_audit_events_actor_user_id_fkey;
      `);
      await client.query(`
        ALTER TABLE admin_audit_events ALTER COLUMN actor_user_id DROP NOT NULL;
      `);
      await client.query(`
        ALTER TABLE admin_audit_events
          ADD CONSTRAINT admin_audit_events_actor_user_id_fkey
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
      `);

      await client.query(`
        ALTER TABLE properties
          DROP CONSTRAINT properties_created_by_fkey;
      `);
      await client.query(`
        ALTER TABLE properties
          ADD CONSTRAINT properties_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
      `);

      await client.query(`
        ALTER TABLE property_members
          DROP CONSTRAINT property_members_added_by_fkey;
      `);
      await client.query(`
        ALTER TABLE property_members ALTER COLUMN added_by DROP NOT NULL;
      `);
      await client.query(`
        ALTER TABLE property_members
          ADD CONSTRAINT property_members_added_by_fkey
          FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL;
      `);

      await client.query(`
        ALTER TABLE property_invites
          DROP CONSTRAINT property_invites_invited_by_fkey;
      `);
      await client.query(`
        ALTER TABLE property_invites
          ADD CONSTRAINT property_invites_invited_by_fkey
          FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;
      `);
    },
    version: 44,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`ALTER TABLE property_expenses DROP COLUMN IF EXISTS category_id;`);
      await client.query(`DROP TABLE IF EXISTS property_expense_category_types CASCADE;`);
    },
    name: "property_expense_category_types",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_expense_category_types (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          name          TEXT NOT NULL,
          sort_order    INT NOT NULL DEFAULT 0,
          is_annual_amount BOOLEAN NOT NULL DEFAULT false,
          is_commission    BOOLEAN NOT NULL DEFAULT false,
          created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TRIGGER update_property_expense_category_types_updated_at
          BEFORE UPDATE ON property_expense_category_types
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        CREATE INDEX idx_property_expense_category_types_property
          ON property_expense_category_types(property_id);
      `);

      await client.query(`
        INSERT INTO property_expense_category_types
          (property_id, name, sort_order, is_annual_amount, is_commission)
        SELECT
          p.id,
          d.name,
          d.sort_order,
          d.is_annual_amount,
          d.is_commission
        FROM properties p
        CROSS JOIN (VALUES
          (0,  'Airbnb commission',   false, true),
          (1,  'Booking commission',  false, true),
          (2,  'Cleaning',            false, false),
          (3,  'Credit payment',      false, false),
          (4,  'Electricity',         false, false),
          (5,  'Expedia commission',  false, true),
          (6,  'Fire alarm',          false, false),
          (7,  'Gas',                 false, false),
          (8,  'Insurance',           true,  false),
          (9,  'Internet',            false, false),
          (10, 'Legal fee / permit',  false, false),
          (11, 'Maintenance',         false, false),
          (12, 'Material',            false, false),
          (13, 'Merchant commission', false, true),
          (14, 'Other',               false, false),
          (15, 'Phone',               false, false),
          (16, 'Property tax',        true,  false),
          (17, 'Salary',              false, false),
          (18, 'Sewerage',            false, false),
          (19, 'Subscription',        false, false),
          (20, 'Waste management',    false, false),
          (21, 'Water',               false, false)
        ) AS d(sort_order, name, is_annual_amount, is_commission);
      `);

      await client.query(`
        ALTER TABLE property_expenses
          ADD COLUMN category_id UUID REFERENCES property_expense_category_types(id) ON DELETE RESTRICT;
      `);

      await client.query(`
        UPDATE property_expenses pe
        SET category_id = pect.id
        FROM property_expense_category_types pect
        WHERE pect.property_id = pe.property_id
          AND pect.name = CASE pe.category::text
            WHEN 'airbnb_commission'   THEN 'Airbnb commission'
            WHEN 'booking_commission'  THEN 'Booking commission'
            WHEN 'cleaning'            THEN 'Cleaning'
            WHEN 'credit_payment'      THEN 'Credit payment'
            WHEN 'electricity'         THEN 'Electricity'
            WHEN 'expedia_commission'  THEN 'Expedia commission'
            WHEN 'fire_alarm'          THEN 'Fire alarm'
            WHEN 'gas'                 THEN 'Gas'
            WHEN 'insurance'           THEN 'Insurance'
            WHEN 'internet'            THEN 'Internet'
            WHEN 'legal_fee_permit'    THEN 'Legal fee / permit'
            WHEN 'maintenance'         THEN 'Maintenance'
            WHEN 'material'            THEN 'Material'
            WHEN 'merchant_commission' THEN 'Merchant commission'
            WHEN 'other'               THEN 'Other'
            WHEN 'phone'               THEN 'Phone'
            WHEN 'property_tax'        THEN 'Property tax'
            WHEN 'salary'              THEN 'Salary'
            WHEN 'sewerage'            THEN 'Sewerage'
            WHEN 'subscription'        THEN 'Subscription'
            WHEN 'waste_management'    THEN 'Waste management'
            WHEN 'water'               THEN 'Water'
            ELSE NULL
          END;
      `);

      await client.query(`
        ALTER TABLE property_expenses ALTER COLUMN category_id SET NOT NULL;
      `);

      await client.query(`
        CREATE INDEX idx_property_expenses_category_id
          ON property_expenses(property_id, category_id);
      `);
    },
    version: 45,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(
        `ALTER TABLE property_expense_category_types ADD COLUMN IF NOT EXISTS is_commission BOOLEAN NOT NULL DEFAULT false;`
      );
    },
    name: "drop_expense_category_is_commission",
    up: async (client: TDBClient) => {
      await client.query(
        `ALTER TABLE property_expense_category_types DROP COLUMN IF EXISTS is_commission;`
      );
    },
    version: 46,
  },
  {
    down: async (client: TDBClient) => {
      // Re-add as nullable — enum values and NOT NULL cannot be restored without original data
      await client.query(`
        ALTER TABLE property_expenses
          ADD COLUMN IF NOT EXISTS category TEXT;
      `);
    },
    name: "drop_legacy_expense_category_column",
    up: async (client: TDBClient) => {
      await client.query(`DROP INDEX IF EXISTS idx_property_expenses_property_category;`);
      await client.query(`ALTER TABLE property_expenses DROP COLUMN IF EXISTS category;`);
      await client.query(`DROP TYPE IF EXISTS property_expense_category;`);
    },
    version: 47,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_settings
          ADD COLUMN IF NOT EXISTS airbnb_commission_rate NUMERIC(6,5) NOT NULL DEFAULT 0.155,
          ADD COLUMN IF NOT EXISTS booking_commission_rate NUMERIC(6,5) NOT NULL DEFAULT 0.15,
          ADD COLUMN IF NOT EXISTS expedia_commission_rate NUMERIC(6,5) NOT NULL DEFAULT 0.15,
          ADD COLUMN IF NOT EXISTS direct_commission_rate NUMERIC(6,5) NOT NULL DEFAULT 0.035;
      `);
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE property_reservation_channel AS ENUM ('airbnb', 'booking', 'expedia', 'direct');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN IF NOT EXISTS channel property_reservation_channel;
      `);
      await client.query(`
        ALTER TABLE property_reservations DROP COLUMN IF EXISTS channel_commission_id;
      `);
      await client.query(`DROP TABLE IF EXISTS property_channel_commissions CASCADE;`);
    },
    name: "property_channel_commissions",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_channel_commissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          name VARCHAR(80) NOT NULL,
          rate NUMERIC(6,5) NOT NULL CHECK (rate >= 0 AND rate <= 1),
          sort_order INT NOT NULL DEFAULT 0,
          exclude_cleaning_from_commission_base BOOLEAN NOT NULL DEFAULT false,
          exclude_resort_tax_from_payout BOOLEAN NOT NULL DEFAULT false,
          legacy_key TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX idx_property_channel_commissions_property
        ON property_channel_commissions (property_id, sort_order);
      `);

      await client.query(`
        CREATE TRIGGER update_property_channel_commissions_updated_at
          BEFORE UPDATE ON property_channel_commissions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        INSERT INTO property_channel_commissions (
          property_id,
          name,
          rate,
          sort_order,
          exclude_cleaning_from_commission_base,
          exclude_resort_tax_from_payout,
          legacy_key
        )
        SELECT property_id, 'Airbnb', airbnb_commission_rate, 0, false, true, 'airbnb'
        FROM property_settings
        UNION ALL
        SELECT property_id, 'Booking.com', booking_commission_rate, 1, false, false, 'booking'
        FROM property_settings
        UNION ALL
        SELECT property_id, 'Expedia', expedia_commission_rate, 2, true, false, 'expedia'
        FROM property_settings
        UNION ALL
        SELECT property_id, 'Direct web / merchant', direct_commission_rate, 3, false, false, 'direct'
        FROM property_settings;
      `);

      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN channel_commission_id UUID REFERENCES property_channel_commissions(id);
      `);

      await client.query(`
        UPDATE property_reservations pr
        SET channel_commission_id = pcc.id
        FROM property_channel_commissions pcc
        WHERE pcc.property_id = pr.property_id
          AND pcc.legacy_key = pr.channel::text;
      `);

      await client.query(`
        ALTER TABLE property_reservations
          ALTER COLUMN channel_commission_id SET NOT NULL;
      `);

      await client.query(`
        ALTER TABLE property_reservations DROP COLUMN channel;
      `);

      await client.query(`DROP TYPE property_reservation_channel;`);

      await client.query(`
        ALTER TABLE property_channel_commissions DROP COLUMN legacy_key;
      `);

      await client.query(`
        ALTER TABLE property_settings
          DROP COLUMN airbnb_commission_rate,
          DROP COLUMN booking_commission_rate,
          DROP COLUMN expedia_commission_rate,
          DROP COLUMN direct_commission_rate;
      `);
    },
    version: 48,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          DROP COLUMN IF EXISTS refunded_at,
          DROP COLUMN IF EXISTS refunded_by;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN IF EXISTS refunded_at,
          DROP COLUMN IF EXISTS refunded_by;
      `);
    },
    name: "income_refund_columns",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES users(id);
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES users(id);
      `);
    },
    version: 49,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(
        `DROP INDEX IF EXISTS idx_property_reservations_property_check_in_created_at;`
      );
      await client.query(
        `DROP INDEX IF EXISTS idx_property_income_lines_property_date_created_at;`
      );
    },
    name: "income_entries_list_pagination_indexes",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_property_reservations_property_check_in_created_at
          ON property_reservations (property_id, check_in DESC, created_at DESC);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_property_income_lines_property_date_created_at
          ON property_income_lines (property_id, transaction_date DESC, created_at DESC);
      `);
    },
    version: 50,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_user_favorites;`);
    },
    name: "property_user_favorites",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TABLE property_user_favorites (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, property_id)
        );
      `);
      await client.query(`
        CREATE INDEX idx_property_user_favorites_user_favorited_at
          ON property_user_favorites (user_id, favorited_at ASC);
      `);
    },
    version: 51,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          DROP COLUMN IF EXISTS refunded_amount;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN IF EXISTS refunded_amount;
      `);
    },
    name: "income_partial_refund_amount",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_reservations
          ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2);
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2);
      `);
      await client.query(`
        UPDATE property_reservations
        SET refunded_amount = gross_income
        WHERE refunded_at IS NOT NULL
          AND refunded_amount IS NULL;
      `);
      await client.query(`
        UPDATE property_income_lines
        SET refunded_amount = amount
        WHERE refunded_at IS NOT NULL
          AND refunded_amount IS NULL;
      `);
    },
    version: 52,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS property_tenant_email_recipients;`);
      await client.query(`DROP TABLE IF EXISTS property_tenant_email_campaigns;`);
      await client.query(`DROP TYPE IF EXISTS property_tenant_email_tenant_role;`);
      await client.query(`DROP TYPE IF EXISTS property_tenant_email_recipient_status;`);
      await client.query(`DROP TYPE IF EXISTS property_tenant_email_campaign_status;`);
    },
    name: "property_tenant_email_campaigns",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TYPE property_tenant_email_campaign_status AS ENUM (
          'queued',
          'sending',
          'completed',
          'completed_with_errors',
          'failed'
        );
      `);
      await client.query(`
        CREATE TYPE property_tenant_email_recipient_status AS ENUM (
          'queued',
          'sent',
          'failed',
          'skipped'
        );
      `);
      await client.query(`
        CREATE TYPE property_tenant_email_tenant_role AS ENUM ('primary', 'secondary');
      `);
      await client.query(`
        CREATE TABLE property_tenant_email_campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          created_by UUID NOT NULL REFERENCES users(id),
          subject VARCHAR(500) NOT NULL,
          html_body TEXT NOT NULL,
          text_body TEXT NOT NULL,
          status property_tenant_email_campaign_status NOT NULL DEFAULT 'queued',
          recipient_count INT NOT NULL DEFAULT 0,
          sent_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          skipped_count INT NOT NULL DEFAULT 0,
          idempotency_key VARCHAR(128) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ,
          UNIQUE (property_id, idempotency_key)
        );
      `);
      await client.query(`
        CREATE TABLE property_tenant_email_recipients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID NOT NULL REFERENCES property_tenant_email_campaigns(id) ON DELETE CASCADE,
          lease_id UUID NOT NULL REFERENCES property_long_stays(id) ON DELETE CASCADE,
          tenant_role property_tenant_email_tenant_role NOT NULL,
          tenant_name VARCHAR(255) NOT NULL,
          email VARCHAR(320) NOT NULL,
          status property_tenant_email_recipient_status NOT NULL DEFAULT 'queued',
          attempts INT NOT NULL DEFAULT 0,
          last_error TEXT,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await client.query(`
        CREATE INDEX idx_property_tenant_email_campaigns_property_created
          ON property_tenant_email_campaigns (property_id, created_at DESC);
      `);
      await client.query(`
        CREATE INDEX idx_property_tenant_email_recipients_campaign
          ON property_tenant_email_recipients (campaign_id);
      `);
      await client.query(`
        CREATE INDEX idx_property_tenant_email_recipients_campaign_status
          ON property_tenant_email_recipients (campaign_id, status);
      `);
      await client.query(`
        CREATE TRIGGER update_property_tenant_email_campaigns_updated_at
          BEFORE UPDATE ON property_tenant_email_campaigns
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
      await client.query(`
        CREATE TRIGGER update_property_tenant_email_recipients_updated_at
          BEFORE UPDATE ON property_tenant_email_recipients
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    },
    version: 53,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS export_jobs;`);
      await client.query(`DROP TYPE IF EXISTS export_resource_type;`);
      await client.query(`DROP TYPE IF EXISTS export_format;`);
      await client.query(`DROP TYPE IF EXISTS export_job_status;`);
    },
    name: "export_jobs",
    up: async (client: TDBClient) => {
      await client.query(`
        CREATE TYPE export_job_status AS ENUM (
          'pending',
          'processing',
          'completed',
          'failed',
          'expired'
        );
      `);
      await client.query(`
        CREATE TYPE export_format AS ENUM ('csv', 'xlsx');
      `);
      await client.query(`
        CREATE TYPE export_resource_type AS ENUM ('expenses');
      `);
      await client.query(`
        CREATE TABLE export_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          created_by UUID NOT NULL REFERENCES users(id),
          resource_type export_resource_type NOT NULL,
          format export_format NOT NULL,
          filters JSONB NOT NULL DEFAULT '{}',
          status export_job_status NOT NULL DEFAULT 'pending',
          row_count INT,
          file_name VARCHAR(500),
          s3_key VARCHAR(1024),
          error_message TEXT,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ
        );
      `);
      await client.query(`
        CREATE INDEX idx_export_jobs_property_created
          ON export_jobs (property_id, created_at DESC);
      `);
      await client.query(`
        CREATE INDEX idx_export_jobs_created_by_active
          ON export_jobs (created_by, property_id, resource_type, status);
      `);
      await client.query(`
        CREATE TRIGGER update_export_jobs_updated_at
          BEFORE UPDATE ON export_jobs
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    },
    version: 54,
  },
  {
    down: async () => {
      // PostgreSQL does not support removing enum values; no-op.
    },
    name: "property_export_phase5_resource_types_and_export_ready",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TYPE export_resource_type ADD VALUE IF NOT EXISTS 'income';
      `);
      await client.query(`
        ALTER TYPE export_resource_type ADD VALUE IF NOT EXISTS 'leases';
      `);
      await client.query(`
        ALTER TYPE user_notification_type ADD VALUE IF NOT EXISTS 'export_ready';
      `);
    },
    version: 55,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        DROP INDEX IF EXISTS user_notifications_campaign_completion_dedup;
      `);
      await client.query(`
        ALTER TABLE user_notifications DROP COLUMN IF EXISTS context_resource_id;
      `);
    },
    name: "tenant_email_campaign_completed_notification",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TYPE user_notification_type ADD VALUE IF NOT EXISTS 'tenant_email_campaign_completed';
      `);
      await client.query(`
        ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS context_resource_id UUID;
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_campaign_completion_dedup
          ON user_notifications (type, context_resource_id);
      `);
    },
    version: 56,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS tenant_refresh_tokens CASCADE;`);
      await client.query(`DROP TABLE IF EXISTS lease_tenant_memberships CASCADE;`);
      await client.query(`DROP TABLE IF EXISTS tenant_users CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS tenant_membership_status CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS tenant_membership_role CASCADE;`);
    },
    name: "create_tenant_portal_tables",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE tenant_membership_role AS ENUM ('primary', 'secondary');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        DO $$ BEGIN
          CREATE TYPE tenant_membership_status AS ENUM (
            'pending_invite',
            'pending_acceptance',
            'active',
            'declined',
            'revoked',
            'ended',
            'expired'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE tenant_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255),
          phone VARCHAR(50),
          email_verified_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE UNIQUE INDEX tenant_users_email_lower_idx
          ON tenant_users (LOWER(TRIM(email)));
      `);

      await client.query(`
        CREATE TRIGGER update_tenant_users_updated_at
          BEFORE UPDATE ON tenant_users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        CREATE TABLE lease_tenant_memberships (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lease_id UUID NOT NULL REFERENCES property_long_stays(id) ON DELETE CASCADE,
          tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
          role tenant_membership_role NOT NULL,
          invite_email VARCHAR(255) NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          status tenant_membership_status NOT NULL,
          invited_by UUID NOT NULL REFERENCES users(id),
          invite_token_hash VARCHAR(64),
          invited_at TIMESTAMP WITH TIME ZONE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          accepted_at TIMESTAMP WITH TIME ZONE,
          declined_at TIMESTAMP WITH TIME ZONE,
          revoked_at TIMESTAMP WITH TIME ZONE,
          ended_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX idx_lease_tenant_memberships_lease_id
          ON lease_tenant_memberships (lease_id);
      `);
      await client.query(`
        CREATE INDEX idx_lease_tenant_memberships_tenant_user_id
          ON lease_tenant_memberships (tenant_user_id);
      `);
      await client.query(`
        CREATE INDEX idx_lease_tenant_memberships_invite_email
          ON lease_tenant_memberships (LOWER(TRIM(invite_email)));
      `);
      await client.query(`
        CREATE INDEX idx_lease_tenant_memberships_status
          ON lease_tenant_memberships (status);
      `);
      await client.query(`
        CREATE UNIQUE INDEX lease_tenant_memberships_non_terminal_uniq
          ON lease_tenant_memberships (lease_id, LOWER(TRIM(invite_email)), role)
          WHERE status NOT IN ('declined', 'revoked', 'ended', 'expired');
      `);

      await client.query(`
        CREATE TRIGGER update_lease_tenant_memberships_updated_at
          BEFORE UPDATE ON lease_tenant_memberships
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        CREATE TABLE tenant_refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX idx_tenant_refresh_tokens_tenant_user
          ON tenant_refresh_tokens (tenant_user_id);
      `);
      await client.query(`
        CREATE INDEX idx_tenant_refresh_tokens_hash
          ON tenant_refresh_tokens (token_hash);
      `);
    },
    version: 57,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS auth_phone_otps CASCADE;`);
      await client.query(`DROP INDEX IF EXISTS tenant_users_phone_e164_uniq;`);
      await client.query(`DROP INDEX IF EXISTS tenant_users_apple_id_uniq;`);
      await client.query(`DROP INDEX IF EXISTS tenant_users_google_id_uniq;`);
      await client.query(`
        ALTER TABLE tenant_users
          DROP COLUMN IF EXISTS phone_verified_at,
          DROP COLUMN IF EXISTS apple_id,
          DROP COLUMN IF EXISTS google_id;
      `);
    },
    name: "tenant_users_social_phone_auth_foundation",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE tenant_users
          ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE;
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_google_id_uniq
          ON tenant_users (google_id)
          WHERE google_id IS NOT NULL;
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_apple_id_uniq
          ON tenant_users (apple_id)
          WHERE apple_id IS NOT NULL;
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_phone_e164_uniq
          ON tenant_users (phone)
          WHERE phone IS NOT NULL;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS auth_phone_otps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone VARCHAR(32) NOT NULL,
          code_hash VARCHAR(255) NOT NULL,
          purpose VARCHAR(50) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_auth_phone_otps_phone_purpose
          ON auth_phone_otps (phone, purpose);
      `);
    },
    version: 58,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`DROP TABLE IF EXISTS stripe_webhook_events CASCADE;`);
      await client.query(`DROP TABLE IF EXISTS tenant_rent_payment_allocations CASCADE;`);
      await client.query(`DROP TABLE IF EXISTS tenant_rent_payments CASCADE;`);
      await client.query(`DROP TABLE IF EXISTS property_stripe_accounts CASCADE;`);
      await client.query(`DROP TYPE IF EXISTS tenant_rent_payment_status CASCADE;`);
    },
    name: "tenant_stripe_rent_payments_foundation",
    up: async (client: TDBClient) => {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE tenant_rent_payment_status AS ENUM (
            'pending',
            'requires_action',
            'processing',
            'succeeded',
            'failed',
            'canceled',
            'refunded'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS property_stripe_accounts (
          property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
          stripe_account_id VARCHAR(255) NOT NULL,
          charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
          details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT property_stripe_accounts_stripe_account_id_uniq UNIQUE (stripe_account_id)
        );
      `);
      await client.query(`
        CREATE TRIGGER update_property_stripe_accounts_updated_at
          BEFORE UPDATE ON property_stripe_accounts
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_rent_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lease_id UUID NOT NULL REFERENCES property_long_stays(id) ON DELETE CASCADE,
          property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          tenant_user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
          status tenant_rent_payment_status NOT NULL DEFAULT 'pending',
          currency VARCHAR(3) NOT NULL DEFAULT 'usd',
          amount_cents INTEGER NOT NULL,
          stripe_checkout_session_id VARCHAR(255),
          stripe_payment_intent_id VARCHAR(255),
          idempotency_key VARCHAR(255) NOT NULL,
          connected_account_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT tenant_rent_payments_amount_cents_positive CHECK (amount_cents > 0),
          CONSTRAINT tenant_rent_payments_idempotency_key_uniq UNIQUE (idempotency_key),
          CONSTRAINT tenant_rent_payments_checkout_session_uniq UNIQUE (stripe_checkout_session_id),
          CONSTRAINT tenant_rent_payments_payment_intent_uniq UNIQUE (stripe_payment_intent_id)
        );
      `);
      await client.query(`
        CREATE TRIGGER update_tenant_rent_payments_updated_at
          BEFORE UPDATE ON tenant_rent_payments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tenant_rent_payments_lease_id
          ON tenant_rent_payments (lease_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tenant_rent_payments_tenant_user_id
          ON tenant_rent_payments (tenant_user_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tenant_rent_payments_property_status
          ON tenant_rent_payments (property_id, status);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_rent_payment_allocations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_id UUID NOT NULL REFERENCES tenant_rent_payments(id) ON DELETE CASCADE,
          period_month CHAR(7) NOT NULL,
          allocated_cents INTEGER NOT NULL,
          expected_cents_snapshot INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT tenant_rent_payment_allocations_allocated_positive
            CHECK (allocated_cents > 0),
          CONSTRAINT tenant_rent_payment_allocations_expected_nonneg
            CHECK (expected_cents_snapshot >= 0),
          CONSTRAINT tenant_rent_payment_allocations_period_month_fmt
            CHECK (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
          CONSTRAINT tenant_rent_payment_allocations_payment_month_uniq
            UNIQUE (payment_id, period_month)
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tenant_rent_payment_allocations_period
          ON tenant_rent_payment_allocations (period_month);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
          stripe_event_id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(255) NOT NULL,
          processed_at TIMESTAMP WITH TIME ZONE,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
          ON stripe_webhook_events (type);
      `);
    },
    version: 59,
  },
  {
    down: async (client) => {
      await client.query(`
        DROP INDEX IF EXISTS idx_property_income_lines_long_stay_rent_period_month;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN IF EXISTS rent_period_month;
      `);
    },
    name: "property_income_lines_rent_period_month",
    up: async (client) => {
      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN IF NOT EXISTS rent_period_month VARCHAR(7);
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP CONSTRAINT IF EXISTS property_income_lines_rent_period_month_fmt;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          ADD CONSTRAINT property_income_lines_rent_period_month_fmt
            CHECK (
              rent_period_month IS NULL
              OR rent_period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
            );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_property_income_lines_long_stay_rent_period_month
          ON property_income_lines (long_stay_id, rent_period_month)
          WHERE is_deleted = false AND long_stay_id IS NOT NULL;
      `);
    },
    version: 60,
  },
  {
    down: async (client) => {
      await client.query(`
        DROP INDEX IF EXISTS idx_property_income_lines_tenant_rent_payment_id;
      `);
      await client.query(`
        ALTER TABLE property_income_lines
          DROP COLUMN IF EXISTS tenant_rent_payment_id;
      `);
    },
    name: "property_income_lines_tenant_rent_payment_id",
    up: async (client) => {
      await client.query(`
        ALTER TABLE property_income_lines
          ADD COLUMN IF NOT EXISTS tenant_rent_payment_id UUID NULL
            REFERENCES tenant_rent_payments(id) ON DELETE SET NULL;
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_property_income_lines_tenant_rent_payment_id
          ON property_income_lines (tenant_rent_payment_id)
          WHERE is_deleted = false AND tenant_rent_payment_id IS NOT NULL;
      `);
    },
    version: 61,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE lease_tenant_memberships DROP COLUMN IF EXISTS contact_phone;
      `);
    },
    name: "secondary_tenant_membership_listed_and_contact_phone",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TYPE tenant_membership_status ADD VALUE IF NOT EXISTS 'listed';
      `);
      await client.query(`
        ALTER TABLE lease_tenant_memberships
          ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32);
      `);
    },
    version: 62,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_long_stays
          ADD COLUMN IF NOT EXISTS secondary_tenants JSONB NOT NULL DEFAULT '[]';
      `);
    },
    name: "drop_property_long_stays_secondary_tenants",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_long_stays DROP COLUMN IF EXISTS secondary_tenants;
      `);
    },
    version: 63,
  },
  {
    down: async () => {
      // Postgres cannot remove enum values safely.
    },
    name: "property_invite_status_lifecycle_enum",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TYPE property_invite_status ADD VALUE IF NOT EXISTS 'pending_invite';
      `);
      await client.query(`
        ALTER TYPE property_invite_status ADD VALUE IF NOT EXISTS 'pending_acceptance';
      `);
      await client.query(`
        ALTER TYPE property_invite_status ADD VALUE IF NOT EXISTS 'declined';
      `);
      await client.query(`
        ALTER TYPE property_invite_status ADD VALUE IF NOT EXISTS 'revoked';
      `);
      await client.query(`
        ALTER TYPE property_invite_status ADD VALUE IF NOT EXISTS 'expired';
      `);
    },
    version: 64,
  },
  {
    down: async (client: TDBClient) => {
      await client.query(`
        DROP TRIGGER IF EXISTS update_property_invites_updated_at ON property_invites;
      `);
      await client.query(`
        DROP INDEX IF EXISTS property_invites_non_terminal_uniq;
      `);
      await client.query(`
        ALTER TABLE property_invites
          DROP COLUMN IF EXISTS invite_token_hash,
          DROP COLUMN IF EXISTS invited_at,
          DROP COLUMN IF EXISTS accepted_at,
          DROP COLUMN IF EXISTS declined_at,
          DROP COLUMN IF EXISTS revoked_at,
          DROP COLUMN IF EXISTS updated_at;
      `);
      await client.query(`
        ALTER TABLE property_invites
          ADD CONSTRAINT property_invites_property_id_email_key UNIQUE (property_id, email);
      `);
    },
    name: "property_member_invite_lifecycle",
    up: async (client: TDBClient) => {
      await client.query(`
        ALTER TABLE property_invites
          ADD COLUMN IF NOT EXISTS invite_token_hash VARCHAR(64),
          ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);

      await client.query(`
        UPDATE property_invites
        SET invited_at = COALESCE(invited_at, created_at),
            updated_at = COALESCE(updated_at, created_at)
        WHERE invited_at IS NULL OR updated_at IS NULL;
      `);

      await client.query(`
        UPDATE property_invites pi
        SET status = CASE
          WHEN EXISTS (
            SELECT 1
            FROM users u
            WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(pi.email))
          ) THEN 'pending_acceptance'::property_invite_status
          ELSE 'pending_invite'::property_invite_status
        END
        WHERE pi.status = 'pending'::property_invite_status;
      `);

      await client.query(`
        UPDATE property_invites
        SET accepted_at = COALESCE(accepted_at, created_at)
        WHERE status = 'accepted'::property_invite_status
          AND accepted_at IS NULL;
      `);

      await client.query(`
        UPDATE property_invites
        SET status = 'expired'::property_invite_status,
            updated_at = NOW()
        WHERE status = ANY(
          ARRAY[
            'pending'::property_invite_status,
            'pending_invite'::property_invite_status,
            'pending_acceptance'::property_invite_status
          ]
        )
          AND expires_at <= NOW();
      `);

      await client.query(`
        ALTER TABLE property_invites
          DROP CONSTRAINT IF EXISTS property_invites_property_id_email_key;
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS property_invites_non_terminal_uniq
          ON property_invites (property_id, LOWER(TRIM(email)))
          WHERE status NOT IN ('accepted', 'declined', 'revoked', 'expired', 'email_failed');
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS update_property_invites_updated_at ON property_invites;
      `);
      await client.query(`
        CREATE TRIGGER update_property_invites_updated_at
          BEFORE UPDATE ON property_invites
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    },
    version: 65,
  },
  {
    down: async (client) => {
      await client.query(`
        DROP INDEX IF EXISTS lease_tenant_memberships_non_terminal_uniq;
      `);
      await client.query(`
        CREATE UNIQUE INDEX lease_tenant_memberships_non_terminal_uniq
          ON lease_tenant_memberships (lease_id, LOWER(TRIM(invite_email)), role)
          WHERE status NOT IN ('declined', 'revoked', 'ended', 'expired');
      `);
      await client.query(`
        UPDATE lease_tenant_memberships
        SET invite_email = display_name
        WHERE invite_email IS NULL;
      `);
      await client.query(`
        ALTER TABLE lease_tenant_memberships
          ALTER COLUMN invite_email SET NOT NULL;
      `);
    },
    name: "nullable_secondary_invite_email",
    up: async (client) => {
      await client.query(`
        ALTER TABLE lease_tenant_memberships
          ALTER COLUMN invite_email DROP NOT NULL;
      `);
      await client.query(`
        DROP INDEX IF EXISTS lease_tenant_memberships_non_terminal_uniq;
      `);
      await client.query(`
        CREATE UNIQUE INDEX lease_tenant_memberships_non_terminal_uniq
          ON lease_tenant_memberships (lease_id, LOWER(TRIM(invite_email)), role)
          WHERE status NOT IN ('declined', 'revoked', 'ended', 'expired')
            AND invite_email IS NOT NULL
            AND TRIM(invite_email) <> '';
      `);
    },
    version: 66,
  },
  {
    down: async (client) => {
      await client.query(`
        ALTER TABLE tenant_users
          DROP COLUMN IF EXISTS sms_consented_at,
          DROP COLUMN IF EXISTS sms_opted_out_at;
      `);
    },
    name: "tenant_users_sms_consent",
    up: async (client) => {
      await client.query(`
        ALTER TABLE tenant_users
          ADD COLUMN IF NOT EXISTS sms_consented_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMP WITH TIME ZONE;
      `);
    },
    version: 67,
  },
];
