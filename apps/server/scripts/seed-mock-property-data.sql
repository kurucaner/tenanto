-- Mock property accounting data for local/dev testing.
--
-- Prerequisites:
--   - Migrations applied (v17+)
--   - User with email user@propertyos.xyz exists
--
-- Creates (no property_members rows):
--   - 6 properties owned by user@propertyos.xyz (created_by)
--   - ~60 units (mix of short_term / long_term, varied layouts)
--   - Varied property_settings per property
--   - ~120 reservations (check-ins) over the last 18 months
--   - ~36 misc income lines
--   - ~72 expenses across all categories
--
-- Idempotent: deletes prior rows with the fixed seed UUIDs before re-inserting.
--
-- Usage:
--   psql "$DATABASE_URL" -f apps/server/scripts/seed-mock-property-data.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Resolve owner
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE LOWER(TRIM(email)) = 'user@propertyos.xyz'
  ) THEN
    RAISE EXCEPTION 'User user@propertyos.xyz not found. Create the account first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup previous seed data (fixed UUID namespace f0000000-0000-4000-8000-*)
-- ---------------------------------------------------------------------------
DELETE FROM property_income_lines
WHERE property_id IN (
  SELECT id FROM properties
  WHERE id >= 'f0000000-0000-4000-8000-000000000001'::uuid
    AND id <= 'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_reservations
WHERE property_id IN (
  SELECT id FROM properties
  WHERE id >= 'f0000000-0000-4000-8000-000000000001'::uuid
    AND id <= 'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_expenses
WHERE property_id IN (
  SELECT id FROM properties
  WHERE id >= 'f0000000-0000-4000-8000-000000000001'::uuid
    AND id <= 'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_units
WHERE property_id IN (
  SELECT id FROM properties
  WHERE id >= 'f0000000-0000-4000-8000-000000000001'::uuid
    AND id <= 'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM property_settings
WHERE property_id IN (
  SELECT id FROM properties
  WHERE id >= 'f0000000-0000-4000-8000-000000000001'::uuid
    AND id <= 'f0000000-0000-4000-8000-000000000006'::uuid
);

DELETE FROM properties
WHERE id >= 'f0000000-0000-4000-8000-000000000001'::uuid
  AND id <= 'f0000000-0000-4000-8000-000000000006'::uuid;

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
  p_room_rate NUMERIC,
  p_cleaning_fee NUMERIC,
  p_channel property_reservation_channel,
  p_rental_type property_unit_rental_type,
  p_sales_tax_rate NUMERIC,
  p_miami_dade_surtax_rate NUMERIC,
  p_cdt_rate NUMERIC,
  p_resort_tax_rate NUMERIC,
  p_airbnb_commission_rate NUMERIC,
  p_booking_commission_rate NUMERIC,
  p_expedia_commission_rate NUMERIC,
  p_direct_commission_rate NUMERIC
)
RETURNS TABLE (
  gross_income NUMERIC,
  sales_tax NUMERIC,
  miami_dade_surtax NUMERIC,
  convention_development_tax NUMERIC,
  resort_tax NUMERIC,
  channel_commission NUMERIC,
  net_income NUMERIC
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_taxable_base NUMERIC;
  v_sales_tax NUMERIC;
  v_miami_dade NUMERIC;
  v_cdt NUMERIC;
  v_resort NUMERIC;
  v_total_taxes NUMERIC;
  v_commission_rate NUMERIC;
  v_commission NUMERIC;
BEGIN
  IF p_rental_type = 'long_term'::property_unit_rental_type THEN
    gross_income := seed_round_money(p_room_rate);
    sales_tax := 0;
    miami_dade_surtax := 0;
    convention_development_tax := 0;
    resort_tax := 0;
    channel_commission := 0;
    net_income := seed_round_money(p_room_rate);
    RETURN NEXT;
    RETURN;
  END IF;

  v_taxable_base := p_room_rate + p_cleaning_fee;
  v_sales_tax := seed_round_money(v_taxable_base * p_sales_tax_rate);
  v_miami_dade := seed_round_money(v_taxable_base * p_miami_dade_surtax_rate);
  v_cdt := seed_round_money(v_taxable_base * p_cdt_rate);
  v_resort := seed_round_money(v_taxable_base * p_resort_tax_rate);
  v_total_taxes := v_sales_tax + v_miami_dade + v_cdt + v_resort;
  v_commission_rate := seed_channel_commission_rate(
    p_channel,
    p_airbnb_commission_rate,
    p_booking_commission_rate,
    p_expedia_commission_rate,
    p_direct_commission_rate
  );
  v_commission := seed_round_money(v_taxable_base * v_commission_rate);

  gross_income := seed_round_money(v_taxable_base + v_total_taxes);
  sales_tax := v_sales_tax;
  miami_dade_surtax := v_miami_dade;
  convention_development_tax := v_cdt;
  resort_tax := v_resort;
  channel_commission := v_commission;
  net_income := seed_round_money(v_taxable_base - v_total_taxes - v_commission);
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
WITH owner AS (
  SELECT id AS owner_id
  FROM users
  WHERE LOWER(TRIM(email)) = 'user@propertyos.xyz'
  LIMIT 1
)
INSERT INTO properties (id, name, address, phone_number, created_by, created_at)
SELECT
  p.id,
  p.name,
  p.address,
  p.phone_number,
  owner.owner_id,
  p.created_at
FROM owner
CROSS JOIN (
  VALUES
    (
      'f0000000-0000-4000-8000-000000000001'::uuid,
      'Oceanview Suites Miami Beach',
      '1200 Collins Ave, Miami Beach, FL 33139',
      '+1 (305) 555-0101',
      TIMESTAMPTZ '2024-01-15 10:00:00+00'
    ),
    (
      'f0000000-0000-4000-8000-000000000002'::uuid,
      'Brickell Tower Residences',
      '500 Brickell Ave, Miami, FL 33131',
      '+1 (305) 555-0102',
      TIMESTAMPTZ '2024-03-01 14:30:00+00'
    ),
    (
      'f0000000-0000-4000-8000-000000000003'::uuid,
      'Wynwood Art Lofts',
      '220 NW 27th St, Miami, FL 33127',
      '+1 (305) 555-0103',
      TIMESTAMPTZ '2024-05-10 09:15:00+00'
    ),
    (
      'f0000000-0000-4000-8000-000000000004'::uuid,
      'Coral Gables Long-Term Homes',
      '450 Alhambra Cir, Coral Gables, FL 33134',
      '+1 (305) 555-0104',
      TIMESTAMPTZ '2024-07-20 11:45:00+00'
    ),
    (
      'f0000000-0000-4000-8000-000000000005'::uuid,
      'South Beach Condos',
      '800 Ocean Dr, Miami Beach, FL 33139',
      '+1 (305) 555-0105',
      TIMESTAMPTZ '2024-09-05 16:00:00+00'
    ),
    (
      'f0000000-0000-4000-8000-000000000006'::uuid,
      'Edgewater Bay Apartments',
      '1800 North Bayshore Dr, Miami, FL 33132',
      '+1 (305) 555-0106',
      TIMESTAMPTZ '2025-01-08 08:20:00+00'
    )
) AS p(id, name, address, phone_number, created_at);

-- ---------------------------------------------------------------------------
-- Property settings (varied rates)
-- ---------------------------------------------------------------------------
INSERT INTO property_settings (
  property_id,
  sales_tax_rate,
  miami_dade_surtax_rate,
  convention_development_tax_rate,
  resort_tax_rate,
  airbnb_commission_rate,
  booking_commission_rate,
  expedia_commission_rate,
  direct_commission_rate
)
VALUES
  -- defaults (14% total tax)
  (
    'f0000000-0000-4000-8000-000000000001',
    0.06, 0.01, 0.03, 0.04,
    0.155, 0.15, 0.15, 0.035
  ),
  -- higher Airbnb commission
  (
    'f0000000-0000-4000-8000-000000000002',
    0.06, 0.01, 0.03, 0.04,
    0.17, 0.15, 0.16, 0.04
  ),
  -- reduced resort tax
  (
    'f0000000-0000-4000-8000-000000000003',
    0.06, 0.01, 0.03, 0.02,
    0.155, 0.14, 0.15, 0.03
  ),
  -- long-term focused: lower direct commission
  (
    'f0000000-0000-4000-8000-000000000004',
    0.06, 0.01, 0.03, 0.04,
    0.155, 0.15, 0.15, 0.025
  ),
  -- premium short-term: higher taxes
  (
    'f0000000-0000-4000-8000-000000000005',
    0.065, 0.01, 0.03, 0.045,
    0.16, 0.155, 0.155, 0.035
  ),
  -- balanced / newer property
  (
    'f0000000-0000-4000-8000-000000000006',
    0.06, 0.01, 0.03, 0.04,
    0.15, 0.145, 0.145, 0.03
  );

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
-- Reservations (~20 per property, spread over 18 months)
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
  sales_tax,
  miami_dade_surtax,
  convention_development_tax,
  resort_tax,
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
  calc.sales_tax,
  calc.miami_dade_surtax,
  calc.convention_development_tax,
  calc.resort_tax,
  calc.channel_commission,
  calc.net_income
FROM (
  SELECT
    u.property_id,
    u.id AS unit_id,
    u.rental_type,
    ps.sales_tax_rate,
    ps.miami_dade_surtax_rate,
    ps.convention_development_tax_rate,
    ps.resort_tax_rate,
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
    (DATE '2024-07-01' + ((prop_idx * 17 + stay_idx * 11) % 540))::date AS check_in,
    ((DATE '2024-07-01' + ((prop_idx * 17 + stay_idx * 11) % 540))::date
      + (2 + ((prop_idx + stay_idx) % 6)))::date AS check_out,
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
  r.room_rate,
  r.cleaning_fee,
  r.channel::property_reservation_channel,
  r.rental_type,
  r.sales_tax_rate,
  r.miami_dade_surtax_rate,
  r.convention_development_tax_rate,
  r.resort_tax_rate,
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
  sales_tax,
  miami_dade_surtax,
  convention_development_tax,
  resort_tax,
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
  (DATE '2024-08-01' + ((prop_idx * 13 + line_idx * 9) % 500))::date,
  description,
  guest_name,
  seed_round_money(amount),
  0,
  0,
  0,
  0,
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
    (DATE '2024-07-01' + ((prop_idx * 19 + expense_idx * 23) % 540))::date AS expense_date,
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
  (DATE '2025-06-01' + (prop_idx * 3))::date,
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
  NUMERIC, NUMERIC, property_reservation_channel, property_unit_rental_type,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);
DROP FUNCTION IF EXISTS seed_channel_commission_rate(
  property_reservation_channel, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);
DROP FUNCTION IF EXISTS seed_round_money(NUMERIC);

COMMIT;

-- Summary
SELECT
  (SELECT COUNT(*) FROM properties p
   WHERE p.created_by = (SELECT id FROM users WHERE LOWER(TRIM(email)) = 'user@propertyos.xyz')
     AND p.id >= 'f0000000-0000-4000-8000-000000000001'::uuid
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
