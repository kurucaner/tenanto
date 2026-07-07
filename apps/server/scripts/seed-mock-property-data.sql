-- Mock property accounting data for local/dev testing.
--
-- Prerequisites:
--   - Migrations applied (v17+)
--   - User with email user@tenanto.xyz exists (or update seed_config below)
--
-- Creates:
--   - 6 properties owned by the configured seed owner (created_by + owner member row)
--   - ~60 units (mix of short_term / long_term, varied layouts)
--   - Varied property_settings per property
--   - ~120 reservations (check-ins) over the last ~6 months (relative to run date)
--   - ~36 misc income lines in the same window
--   - ~72 expenses across all categories in the same window
--
-- Idempotent: deletes prior rows with the fixed seed UUIDs before re-inserting.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/server/scripts/seed-mock-property-data.sql
--
-- psql override (optional):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ...
--   (edit seed_config INSERT above, or use sed to replace the email)
--
-- If a previous run failed with "current transaction is aborted", run ROLLBACK; first,
-- or re-run this file — it starts with ROLLBACK to clear a stale failed transaction.
-- Run the entire file in one go (do not execute sections in isolation).
--
-- To use a different owner email, edit the INSERT INTO seed_config line below.

ROLLBACK;

BEGIN;

-- ---------------------------------------------------------------------------
-- Seed owner config — edit owner_email here for SQL GUI clients
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE seed_config (owner_email TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO seed_config (owner_email) VALUES ('user@tenanto.xyz');

-- ---------------------------------------------------------------------------
-- Resolve owner (pre-flight)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_email TEXT;
  v_owner_id UUID;
BEGIN
  SELECT owner_email INTO v_owner_email FROM seed_config LIMIT 1;

  SELECT id INTO v_owner_id
  FROM users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_owner_email))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Seed owner not found: % — sign up in the app first or update seed_config.',
      v_owner_email;
  END IF;

  RAISE NOTICE 'Seed owner: % (id %)', v_owner_email, v_owner_id;
END $$;

-- Pre-flight diagnostic (visible in query results)
SELECT u.id AS seed_owner_id, u.email AS seed_owner_email
FROM users u
WHERE LOWER(TRIM(u.email)) = LOWER(TRIM((SELECT owner_email FROM seed_config LIMIT 1)));

-- ---------------------------------------------------------------------------
-- Cleanup previous seed data (fixed UUID namespace f0000000-0000-4000-8000-*)
-- ---------------------------------------------------------------------------
DELETE FROM property_income_lines
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_reservations
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_expenses
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_units
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_settings
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_invites
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_members
WHERE property_id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM properties
WHERE id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

-- ---------------------------------------------------------------------------
-- Helper: round money like property-income-calculator.ts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_round_money(value NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(value, 2);
$$;

CREATE OR REPLACE FUNCTION seed_channel_commission_rate(
  channel property_reservation_channel,
  airbnb_rate NUMERIC,
  booking_rate NUMERIC,
  expedia_rate NUMERIC,
  direct_rate NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE channel
    WHEN 'airbnb'::property_reservation_channel THEN airbnb_rate
    WHEN 'booking'::property_reservation_channel THEN booking_rate
    WHEN 'expedia'::property_reservation_channel THEN expedia_rate
    WHEN 'direct'::property_reservation_channel THEN direct_rate
  END;
$$;

CREATE OR REPLACE FUNCTION seed_calc_stay_income(
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
  v_room_total := seed_round_money(p_room_rate * p_nights);

  IF p_rental_type = 'long_term'::property_unit_rental_type THEN
    gross_income := v_room_total;
    tax_breakdown := '[]'::jsonb;
    channel_commission := 0;
    net_income := v_room_total;
    RETURN NEXT;
    RETURN;
  END IF;

  v_taxable_base := seed_round_money(v_room_total + p_cleaning_fee);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'taxRateId', ptr.id::text,
        'name', ptr.name,
        'rate', ptr.rate,
        'amount', seed_round_money(v_taxable_base * ptr.rate)
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

  v_commission_rate := seed_channel_commission_rate(
    p_channel,
    p_airbnb_commission_rate,
    p_booking_commission_rate,
    p_expedia_commission_rate,
    p_direct_commission_rate
  );
  v_commission := seed_round_money(v_taxable_base * v_commission_rate);

  gross_income := seed_round_money(v_taxable_base + v_total_taxes);
  channel_commission := v_commission;
  net_income := seed_round_money(v_taxable_base - v_total_taxes - v_commission);
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_email TEXT;
  v_owner_id UUID;
  v_count INTEGER;
BEGIN
  SELECT owner_email INTO v_owner_email FROM seed_config LIMIT 1;

  SELECT id INTO v_owner_id
  FROM users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_owner_email))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Seed owner not found: % — sign up in the app first or update seed_config.',
      v_owner_email;
  END IF;

  INSERT INTO properties (id, name, address, phone_number, created_by, created_at)
  SELECT
    p.id,
    p.name,
    p.address,
    p.phone_number,
    v_owner_id,
    p.created_at
  FROM (
    VALUES
      (
        'f0000000-0000-4000-8000-000000000001'::uuid,
        'Oceanview Suites Miami Beach',
        '1200 Collins Ave, Miami Beach, FL 33139',
        '+13055550101',
        TIMESTAMPTZ '2024-01-15 10:00:00+00'
      ),
      (
        'f0000000-0000-4000-8000-000000000002'::uuid,
        'Brickell Tower Residences',
        '500 Brickell Ave, Miami, FL 33131',
        '+13055550102',
        TIMESTAMPTZ '2024-03-01 14:30:00+00'
      ),
      (
        'f0000000-0000-4000-8000-000000000003'::uuid,
        'Wynwood Art Lofts',
        '220 NW 27th St, Miami, FL 33127',
        '+13055550103',
        TIMESTAMPTZ '2024-05-10 09:15:00+00'
      ),
      (
        'f0000000-0000-4000-8000-000000000004'::uuid,
        'Coral Gables Long-Term Homes',
        '450 Alhambra Cir, Coral Gables, FL 33134',
        '+13055550104',
        TIMESTAMPTZ '2024-07-20 11:45:00+00'
      ),
      (
        'f0000000-0000-4000-8000-000000000005'::uuid,
        'South Beach Condos',
        '800 Ocean Dr, Miami Beach, FL 33139',
        '+13055550105',
        TIMESTAMPTZ '2024-09-05 16:00:00+00'
      ),
      (
        'f0000000-0000-4000-8000-000000000006'::uuid,
        'Edgewater Bay Apartments',
        '1800 North Bayshore Dr, Miami, FL 33132',
        '+13055550106',
        TIMESTAMPTZ '2025-01-08 08:20:00+00'
      )
  ) AS p(id, name, address, phone_number, created_at);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 6 THEN
    RAISE EXCEPTION
      'Seed properties insert failed: expected 6 rows, inserted %.',
      v_count;
  END IF;

  RAISE NOTICE 'Inserted % seed properties for owner %', v_count, v_owner_email;
END $$;

SELECT COUNT(*) AS inserted_property_count
FROM properties
WHERE id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
);

INSERT INTO property_members (property_id, user_id, role, added_by)
SELECT p.id, p.created_by, 'owner'::property_role, p.created_by
FROM properties p
WHERE p.id IN (
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'f0000000-0000-4000-8000-000000000004'::uuid,
  'f0000000-0000-4000-8000-000000000005'::uuid,
  'f0000000-0000-4000-8000-000000000006'::uuid
)
ON CONFLICT (property_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Property settings (varied rates)
-- ---------------------------------------------------------------------------
INSERT INTO property_settings (
  property_id,
  airbnb_commission_rate,
  booking_commission_rate,
  expedia_commission_rate,
  direct_commission_rate
)
SELECT
  seed.property_id,
  seed.airbnb_commission_rate,
  seed.booking_commission_rate,
  seed.expedia_commission_rate,
  seed.direct_commission_rate
FROM (
  VALUES
    (
      'f0000000-0000-4000-8000-000000000001'::uuid,
      0.155::numeric, 0.15::numeric, 0.15::numeric, 0.035::numeric
    ),
    (
      'f0000000-0000-4000-8000-000000000002'::uuid,
      0.17::numeric, 0.15::numeric, 0.16::numeric, 0.04::numeric
    ),
    (
      'f0000000-0000-4000-8000-000000000003'::uuid,
      0.155::numeric, 0.14::numeric, 0.15::numeric, 0.03::numeric
    ),
    (
      'f0000000-0000-4000-8000-000000000004'::uuid,
      0.155::numeric, 0.15::numeric, 0.15::numeric, 0.025::numeric
    ),
    (
      'f0000000-0000-4000-8000-000000000005'::uuid,
      0.16::numeric, 0.155::numeric, 0.155::numeric, 0.035::numeric
    ),
    (
      'f0000000-0000-4000-8000-000000000006'::uuid,
      0.15::numeric, 0.145::numeric, 0.145::numeric, 0.03::numeric
    )
) AS seed(
  property_id,
  airbnb_commission_rate,
  booking_commission_rate,
  expedia_commission_rate,
  direct_commission_rate
)
INNER JOIN properties p ON p.id = seed.property_id;

INSERT INTO property_tax_rates (property_id, name, rate, sort_order)
SELECT
  seed.property_id,
  seed.name,
  seed.rate,
  seed.sort_order
FROM (
  VALUES
    ('f0000000-0000-4000-8000-000000000001'::uuid, 'Sales tax', 0.06::numeric, 0),
    ('f0000000-0000-4000-8000-000000000001'::uuid, 'Miami-Dade surtax', 0.01::numeric, 1),
    ('f0000000-0000-4000-8000-000000000001'::uuid, 'Convention development tax (CDT)', 0.03::numeric, 2),
    ('f0000000-0000-4000-8000-000000000001'::uuid, 'Resort tax', 0.04::numeric, 3),
    ('f0000000-0000-4000-8000-000000000002'::uuid, 'Sales tax', 0.06::numeric, 0),
    ('f0000000-0000-4000-8000-000000000002'::uuid, 'Miami-Dade surtax', 0.01::numeric, 1),
    ('f0000000-0000-4000-8000-000000000002'::uuid, 'Convention development tax (CDT)', 0.03::numeric, 2),
    ('f0000000-0000-4000-8000-000000000002'::uuid, 'Resort tax', 0.04::numeric, 3),
    ('f0000000-0000-4000-8000-000000000003'::uuid, 'Sales tax', 0.06::numeric, 0),
    ('f0000000-0000-4000-8000-000000000003'::uuid, 'Miami-Dade surtax', 0.01::numeric, 1),
    ('f0000000-0000-4000-8000-000000000003'::uuid, 'Convention development tax (CDT)', 0.03::numeric, 2),
    ('f0000000-0000-4000-8000-000000000003'::uuid, 'Resort tax', 0.02::numeric, 3),
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'Sales tax', 0.06::numeric, 0),
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'Miami-Dade surtax', 0.01::numeric, 1),
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'Convention development tax (CDT)', 0.03::numeric, 2),
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'Resort tax', 0.04::numeric, 3),
    ('f0000000-0000-4000-8000-000000000005'::uuid, 'Sales tax', 0.065::numeric, 0),
    ('f0000000-0000-4000-8000-000000000005'::uuid, 'Miami-Dade surtax', 0.01::numeric, 1),
    ('f0000000-0000-4000-8000-000000000005'::uuid, 'Convention development tax (CDT)', 0.03::numeric, 2),
    ('f0000000-0000-4000-8000-000000000005'::uuid, 'Resort tax', 0.045::numeric, 3),
    ('f0000000-0000-4000-8000-000000000006'::uuid, 'Sales tax', 0.06::numeric, 0),
    ('f0000000-0000-4000-8000-000000000006'::uuid, 'Miami-Dade surtax', 0.01::numeric, 1),
    ('f0000000-0000-4000-8000-000000000006'::uuid, 'Convention development tax (CDT)', 0.03::numeric, 2),
    ('f0000000-0000-4000-8000-000000000006'::uuid, 'Resort tax', 0.04::numeric, 3)
) AS seed(property_id, name, rate, sort_order)
INNER JOIN properties p ON p.id = seed.property_id;

DO $$
DECLARE
  settings_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO settings_count
  FROM property_settings
  WHERE property_id IN (
    'f0000000-0000-4000-8000-000000000001'::uuid,
    'f0000000-0000-4000-8000-000000000002'::uuid,
    'f0000000-0000-4000-8000-000000000003'::uuid,
    'f0000000-0000-4000-8000-000000000004'::uuid,
    'f0000000-0000-4000-8000-000000000005'::uuid,
    'f0000000-0000-4000-8000-000000000006'::uuid
  );

  IF settings_count <> 6 THEN
    RAISE EXCEPTION
      'Seed property_settings insert failed: expected 6 rows, found %.',
      settings_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Units (10 per property)
-- ---------------------------------------------------------------------------
INSERT INTO property_units (id, property_id, unit_number, rental_type, layout)
SELECT
  ('f0000001-0000-4000-8000-' || LPAD((prop_idx * 100 + unit_idx)::text, 12, '0'))::uuid,
  ('f0000000-0000-4000-8000-' || LPAD(prop_idx::text, 12, '0'))::uuid,
  unit_number,
  rental_type::property_unit_rental_type,
  layout
FROM (
  SELECT
    prop_idx,
    unit_idx,
    CASE
      WHEN unit_idx <= 6 THEN (100 + unit_idx)::text
      ELSE (200 + (unit_idx - 6))::text
    END AS unit_number,
    CASE
      WHEN prop_idx = 4 THEN 'long_term'
      WHEN prop_idx = 2 AND unit_idx IN (9, 10) THEN 'long_term'
      WHEN prop_idx = 6 AND unit_idx IN (1, 2) THEN 'long_term'
      ELSE 'short_term'
    END AS rental_type,
    (ARRAY['1+0', '1+1', '2+1', '2+2', '3+2'])[1 + ((prop_idx + unit_idx - 2) % 5)] AS layout
  FROM generate_series(1, 6) AS prop_idx
  CROSS JOIN generate_series(1, 10) AS unit_idx
) AS units;

-- ---------------------------------------------------------------------------
-- Reservations (~20 per property, spread over the last ~6 months)
-- ---------------------------------------------------------------------------
INSERT INTO property_reservations (
  id,
  property_id,
  unit_id,
  guest_name,
  reservation_number,
  check_in,
  check_out,
  nights,
  status,
  channel,
  room_rate,
  cleaning_fee,
  gross_income,
  tax_breakdown,
  channel_commission,
  net_income
)
SELECT
  ('f0000002-0000-4000-8000-' || LPAD(row_number() OVER ()::text, 12, '0'))::uuid,
  r.property_id,
  r.unit_id,
  r.guest_name,
  r.reservation_number,
  r.check_in,
  r.check_out,
  r.nights,
  r.status::property_reservation_status,
  r.channel::property_reservation_channel,
  r.room_rate,
  r.cleaning_fee,
  calc.gross_income,
  calc.tax_breakdown,
  calc.channel_commission,
  calc.net_income
FROM (
  SELECT
    u.property_id,
    u.id AS unit_id,
    u.rental_type,
    ps.airbnb_commission_rate,
    ps.booking_commission_rate,
    ps.expedia_commission_rate,
    ps.direct_commission_rate,
    (ARRAY[
      'Emma Johnson', 'Liam Martinez', 'Olivia Chen', 'Noah Williams',
      'Ava Thompson', 'Ethan Garcia', 'Sophia Lee', 'Mason Brown',
      'Isabella Davis', 'Lucas Wilson', 'Mia Anderson', 'James Taylor'
    ])[1 + ((prop_idx + stay_idx) % 12)] AS guest_name,
    'RES-' || LPAD((prop_idx * 100 + stay_idx)::text, 6, '0') AS reservation_number,
    (
      date_trunc('month', CURRENT_DATE)::date
      - INTERVAL '5 months'
      + ((prop_idx * 17 + stay_idx * 11) % 180) * INTERVAL '1 day'
    )::date AS check_in,
    (
      date_trunc('month', CURRENT_DATE)::date
      - INTERVAL '5 months'
      + ((prop_idx * 17 + stay_idx * 11) % 180) * INTERVAL '1 day'
      + (2 + ((prop_idx + stay_idx) % 6)) * INTERVAL '1 day'
    )::date AS check_out,
    (2 + ((prop_idx + stay_idx) % 6)) AS nights,
    (ARRAY['stayed', 'stayed', 'stayed', 'stayed', 'active', 'canceled', 'no_show'])[
      1 + ((prop_idx + stay_idx) % 7)
    ] AS status,
    (ARRAY['airbnb', 'booking', 'expedia', 'direct'])[1 + ((prop_idx + stay_idx) % 4)] AS channel,
    CASE
      WHEN u.rental_type = 'long_term'::property_unit_rental_type
        THEN seed_round_money(1800 + (prop_idx * 120) + (stay_idx * 35))
      ELSE seed_round_money(120 + (prop_idx * 15) + (stay_idx * 8) + ((prop_idx + stay_idx) % 5) * 20)
    END AS room_rate,
    CASE
      WHEN u.rental_type = 'long_term'::property_unit_rental_type THEN 0
      ELSE seed_round_money(65 + ((prop_idx + stay_idx) % 4) * 15)
    END AS cleaning_fee
  FROM generate_series(1, 6) AS prop_idx
  CROSS JOIN generate_series(1, 20) AS stay_idx
  INNER JOIN property_units u
    ON u.property_id = ('f0000000-0000-4000-8000-' || LPAD(prop_idx::text, 12, '0'))::uuid
   AND u.unit_number = (
     CASE
       WHEN ((stay_idx - 1) % 10) < 6
         THEN (100 + (((stay_idx - 1) % 10) + 1))::text
       ELSE (200 + (((stay_idx - 1) % 10) - 5))::text
     END
   )
  INNER JOIN property_settings ps ON ps.property_id = u.property_id
) AS r
CROSS JOIN LATERAL seed_calc_stay_income(
  r.nights,
  r.room_rate,
  r.cleaning_fee,
  r.channel::property_reservation_channel,
  r.rental_type,
  r.property_id,
  r.airbnb_commission_rate,
  r.booking_commission_rate,
  r.expedia_commission_rate,
  r.direct_commission_rate
) AS calc;

-- ---------------------------------------------------------------------------
-- Misc income lines (~6 per property)
-- ---------------------------------------------------------------------------
INSERT INTO property_income_lines (
  id,
  property_id,
  unit_id,
  reservation_id,
  line_type,
  amount,
  transaction_date,
  description,
  guest_name,
  gross_income,
  tax_breakdown,
  channel_commission,
  net_income
)
SELECT
  ('f0000003-0000-4000-8000-' || LPAD(row_number() OVER ()::text, 12, '0'))::uuid,
  u.property_id,
  u.id,
  CASE
    WHEN line_idx % 3 = 0 THEN (
      SELECT pr.id
      FROM property_reservations pr
      WHERE pr.property_id = u.property_id
      ORDER BY pr.check_in
      LIMIT 1 OFFSET (line_idx % 5)
    )
    ELSE NULL
  END,
  line_type::property_income_line_type,
  amount,
  (
    date_trunc('month', CURRENT_DATE)::date
    - INTERVAL '5 months'
    + ((prop_idx * 13 + line_idx * 9) % 180) * INTERVAL '1 day'
  )::date,
  description,
  guest_name,
  seed_round_money(amount),
  '[]'::jsonb,
  0,
  seed_round_money(amount)
FROM generate_series(1, 6) AS prop_idx
CROSS JOIN generate_series(1, 6) AS line_idx
INNER JOIN property_units u
  ON u.property_id = ('f0000000-0000-4000-8000-' || LPAD(prop_idx::text, 12, '0'))::uuid
 AND u.unit_number = (
   CASE
     WHEN line_idx <= 6 THEN (100 + line_idx)::text
     ELSE (200 + (line_idx - 6))::text
   END
 )
CROSS JOIN LATERAL (
  SELECT
    (ARRAY['cleaning_only', 'extra_cleaning', 'extra_service', 'beach_equipment_rental'])[
      1 + (line_idx % 4)
    ] AS line_type,
    seed_round_money(
      CASE (line_idx % 4)
        WHEN 0 THEN 85
        WHEN 1 THEN 120 + (line_idx * 5)
        WHEN 2 THEN 45 + (prop_idx * 10)
        ELSE 30 + (line_idx * 7)
      END
    ) AS amount,
    CASE (line_idx % 4)
      WHEN 0 THEN 'Standalone turnover cleaning'
      WHEN 1 THEN 'Deep clean after extended stay'
      WHEN 2 THEN 'Late checkout / luggage storage'
      ELSE 'Beach chairs and umbrella rental'
    END AS description,
    (ARRAY['Guest A', 'Guest B', 'Walk-in', NULL])[1 + (line_idx % 4)] AS guest_name
) AS meta;

-- ---------------------------------------------------------------------------
-- Expenses (~12 per property, varied categories)
-- ---------------------------------------------------------------------------
INSERT INTO property_expenses (
  id,
  property_id,
  category,
  amount,
  expense_date,
  person_name,
  description
)
SELECT
  ('f0000004-0000-4000-8000-' || LPAD(row_number() OVER ()::text, 12, '0'))::uuid,
  ('f0000000-0000-4000-8000-' || LPAD(prop_idx::text, 12, '0'))::uuid,
  category::property_expense_category,
  amount,
  expense_date,
  person_name,
  description
FROM (
  SELECT
    prop_idx,
    expense_idx,
    category,
    amount,
    (
      date_trunc('month', CURRENT_DATE)::date
      - INTERVAL '5 months'
      + ((prop_idx * 19 + expense_idx * 23) % 180) * INTERVAL '1 day'
    )::date AS expense_date,
    person_name,
    description
  FROM generate_series(1, 6) AS prop_idx
  CROSS JOIN generate_series(1, 12) AS expense_idx
  CROSS JOIN LATERAL (
    SELECT
      (ARRAY[
        'electricity', 'water', 'internet', 'gas',
        'cleaning', 'salary', 'maintenance', 'material',
        'insurance', 'property_tax', 'waste_management', 'other'
      ])[expense_idx] AS category,
      seed_round_money(
        CASE expense_idx
          WHEN 1 THEN 180 + (prop_idx * 12)
          WHEN 2 THEN 95 + (prop_idx * 8)
          WHEN 3 THEN 79.99
          WHEN 4 THEN 55 + (prop_idx * 5)
          WHEN 5 THEN 150 + (expense_idx * 10)
          WHEN 6 THEN 2200
          WHEN 7 THEN 320 + (prop_idx * 25)
          WHEN 8 THEN 140 + (expense_idx * 15)
          WHEN 9 THEN 4800
          WHEN 10 THEN 9600
          WHEN 11 THEN 110 + (prop_idx * 6)
          ELSE 75 + (expense_idx * 8)
        END
      ) AS amount,
      CASE expense_idx
        WHEN 5 THEN 'Maria Clean Co'
        WHEN 6 THEN 'Building Manager'
        ELSE NULL
      END AS person_name,
      CASE expense_idx
        WHEN 7 THEN 'HVAC filter replacement'
        WHEN 8 THEN 'Paint and hardware supplies'
        WHEN 12 THEN 'Miscellaneous operating cost'
        ELSE NULL
      END AS description
  ) AS meta
) AS expenses;

-- Extra commission expenses (manual entries that overlap stay deductions)
INSERT INTO property_expenses (id, property_id, category, amount, expense_date, description)
SELECT
  ('f0000005-0000-4000-8000-' || LPAD(row_number() OVER ()::text, 12, '0'))::uuid,
  ('f0000000-0000-4000-8000-' || LPAD(prop_idx::text, 12, '0'))::uuid,
  category::property_expense_category,
  seed_round_money(250 + prop_idx * 40),
  (CURRENT_DATE - (prop_idx * 3))::date,
  'Manual channel commission reconciliation'
FROM generate_series(1, 6) AS prop_idx
CROSS JOIN (
  VALUES
    ('airbnb_commission'),
    ('booking_commission')
) AS c(category);

-- ---------------------------------------------------------------------------
-- Drop temporary helper functions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS seed_calc_stay_income(
  INTEGER, NUMERIC, NUMERIC, property_reservation_channel, property_unit_rental_type,
  UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);
DROP FUNCTION IF EXISTS seed_channel_commission_rate(
  property_reservation_channel, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);
DROP FUNCTION IF EXISTS seed_round_money(NUMERIC);

COMMIT;

-- Summary
SELECT
  (SELECT COUNT(*) FROM properties p
   WHERE p.id >= 'f0000000-0000-4000-8000-000000000001'::uuid
     AND p.id <= 'f0000000-0000-4000-8000-000000000006'::uuid) AS seed_properties,
  (SELECT COUNT(*) FROM property_units u
   WHERE u.property_id >= 'f0000000-0000-4000-8000-000000000001'::uuid
     AND u.property_id <= 'f0000000-0000-4000-8000-000000000006'::uuid) AS seed_units,
  (SELECT COUNT(*) FROM property_reservations pr
   WHERE pr.property_id >= 'f0000000-0000-4000-8000-000000000001'::uuid
     AND pr.property_id <= 'f0000000-0000-4000-8000-000000000006'::uuid) AS seed_reservations,
  (SELECT COUNT(*) FROM property_income_lines il
   WHERE il.property_id >= 'f0000000-0000-4000-8000-000000000001'::uuid
     AND il.property_id <= 'f0000000-0000-4000-8000-000000000006'::uuid) AS seed_income_lines,
  (SELECT COUNT(*) FROM property_expenses e
   WHERE e.property_id >= 'f0000000-0000-4000-8000-000000000001'::uuid
     AND e.property_id <= 'f0000000-0000-4000-8000-000000000006'::uuid) AS seed_expenses,
  (SELECT COUNT(*) FROM property_members pm
   WHERE pm.property_id >= 'f0000000-0000-4000-8000-000000000001'::uuid
     AND pm.property_id <= 'f0000000-0000-4000-8000-000000000006'::uuid) AS seed_members;

-- ---------------------------------------------------------------------------
-- Last 6 months financial overview (matches GET /home/financial-overview)
-- Scoped to fixed seed property IDs
-- ---------------------------------------------------------------------------
WITH params AS (
  SELECT
    (date_trunc('month', (now() AT TIME ZONE 'UTC')::date) - INTERVAL '5 months')::date AS period_from,
    (
      date_trunc('month', (now() AT TIME ZONE 'UTC')::date)
      + INTERVAL '1 month'
      - INTERVAL '1 day'
    )::date AS period_to
),

months AS (
  SELECT
    to_char(d, 'YYYY-MM') AS month_key,
    d::date AS month_start
  FROM params,
  generate_series(
    date_trunc('month', period_from),
    date_trunc('month', period_to),
    INTERVAL '1 month'
  ) AS d
),

seed_properties AS (
  SELECT id
  FROM properties
  WHERE id IN (
    'f0000000-0000-4000-8000-000000000001'::uuid,
    'f0000000-0000-4000-8000-000000000002'::uuid,
    'f0000000-0000-4000-8000-000000000003'::uuid,
    'f0000000-0000-4000-8000-000000000004'::uuid,
    'f0000000-0000-4000-8000-000000000005'::uuid,
    'f0000000-0000-4000-8000-000000000006'::uuid
  )
),

reservation_income AS (
  SELECT
    to_char(pr.check_in, 'YYYY-MM') AS month_key,
    SUM(pr.gross_income) AS gross_income,
    SUM(pr.net_income) AS net_income
  FROM property_reservations pr
  CROSS JOIN params
  WHERE pr.property_id IN (SELECT id FROM seed_properties)
    AND pr.check_in >= params.period_from
    AND pr.check_in <= params.period_to
  GROUP BY 1
),

line_income AS (
  SELECT
    to_char(pil.transaction_date, 'YYYY-MM') AS month_key,
    SUM(pil.gross_income) AS gross_income,
    SUM(pil.net_income) AS net_income
  FROM property_income_lines pil
  CROSS JOIN params
  WHERE pil.property_id IN (SELECT id FROM seed_properties)
    AND pil.transaction_date >= params.period_from
    AND pil.transaction_date <= params.period_to
  GROUP BY 1
),

dated_expenses AS (
  SELECT
    to_char(pe.expense_date, 'YYYY-MM') AS month_key,
    SUM(pe.amount) AS expenses
  FROM property_expenses pe
  CROSS JOIN params
  WHERE pe.property_id IN (SELECT id FROM seed_properties)
    AND pe.category NOT IN ('property_tax', 'insurance')
    AND pe.expense_date IS NOT NULL
    AND pe.expense_date >= params.period_from
    AND pe.expense_date <= params.period_to
  GROUP BY 1
),

annual_expense_total AS (
  SELECT COALESCE(SUM(pe.amount), 0) AS total_annual
  FROM property_expenses pe
  CROSS JOIN params
  WHERE pe.property_id IN (SELECT id FROM seed_properties)
    AND pe.category IN ('property_tax', 'insurance')
    AND (
      pe.expense_date IS NULL
      OR (pe.expense_date >= params.period_from AND pe.expense_date <= params.period_to)
    )
),

monthly_annual AS (
  SELECT
    m.month_key,
    ROUND(a.total_annual / 12.0, 2) AS expenses
  FROM months m
  CROSS JOIN annual_expense_total a
),

income_by_month AS (
  SELECT
    month_key,
    SUM(gross_income) AS gross_income,
    SUM(net_income) AS net_income
  FROM (
    SELECT month_key, gross_income, net_income FROM reservation_income
    UNION ALL
    SELECT month_key, gross_income, net_income FROM line_income
  ) x
  GROUP BY 1
),

expenses_by_month AS (
  SELECT month_key, SUM(expenses) AS expenses
  FROM (
    SELECT month_key, expenses FROM dated_expenses
    UNION ALL
    SELECT month_key, expenses FROM monthly_annual
  ) x
  GROUP BY 1
)

SELECT
  m.month_key AS month,
  COALESCE(i.gross_income, 0) AS gross_income,
  COALESCE(i.net_income, 0) AS net_income,
  COALESCE(e.expenses, 0) AS expenses,
  
  ROUND(COALESCE(i.net_income, 0) - COALESCE(e.expenses, 0), 2) AS operational_net
FROM months m
LEFT JOIN income_by_month i USING (month_key)
LEFT JOIN expenses_by_month e USING (month_key)
ORDER BY m.month_key;
