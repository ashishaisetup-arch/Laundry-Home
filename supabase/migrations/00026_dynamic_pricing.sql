-- Dynamic pricing coefficients table
-- Stores demand/supply multipliers by area, day-of-week, and hour bucket

CREATE TABLE IF NOT EXISTS pricing_coefficients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_name       text NOT NULL,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun
  hour_bucket     smallint NOT NULL CHECK (hour_bucket BETWEEN 0 AND 23),
  demand_multiplier numeric(5,2) NOT NULL DEFAULT 1.00,
  supply_multiplier numeric(5,2) NOT NULL DEFAULT 1.00,
  base_multiplier   numeric(5,2) NOT NULL DEFAULT 1.00,
  is_active         boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_name, day_of_week, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_pricing_coefficients_area ON pricing_coefficients(area_name);
CREATE INDEX IF NOT EXISTS idx_pricing_coefficients_active ON pricing_coefficients(is_active);

-- Seed default coefficients (1.0 = no surge) for common areas
INSERT INTO pricing_coefficients (area_name, day_of_week, hour_bucket, demand_multiplier, supply_multiplier, base_multiplier)
SELECT area_name, dow, hour, 1.0, 1.0, 1.0
FROM (
  SELECT DISTINCT area_name FROM service_areas WHERE is_active AND area_name IS NOT NULL
) areas
CROSS JOIN (
  SELECT generate_series(0, 6) AS dow
) days
CROSS JOIN (
  SELECT generate_series(0, 23) AS hour
) hours
ON CONFLICT DO NOTHING;
