import type { Pool, PoolClient } from "pg";

export const runMigrations = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();

  try {
    const migrationsTableMigration = migrations.find((m) => m.name === "create_migrations_table");
    if (migrationsTableMigration) {
      await migrationsTableMigration.up(client);
    }

    await client.query("BEGIN");

    const result = await client.query("SELECT version FROM migrations ORDER BY version FOR UPDATE");
    const appliedVersions = new Set(result.rows.map((row) => row.version));

    for (const migration of migrations) {
      if (migration.name === "create_migrations_table") continue;

      if (!appliedVersions.has(migration.version)) {
        await migration.up(client);

        await client.query("INSERT INTO migrations (version, name) VALUES ($1, $2)", [
          migration.version,
          migration.name,
        ]);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[DB] Migration failed. All changes rolled back:", error);
    throw error;
  } finally {
    client.release();
  }
};

type TDBClient = Pool | PoolClient;

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
      await client.query(
        `CREATE INDEX idx_property_members_user_id ON property_members(user_id);`
      );
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
];
