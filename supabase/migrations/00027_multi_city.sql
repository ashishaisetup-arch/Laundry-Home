-- Multi-city dispatch support
-- Adds city_id FK to vendors + cross-city flag

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_accepting_cross_city boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vendors_city_id ON vendors(city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_cross_city ON vendors(is_accepting_cross_city) WHERE is_accepting_cross_city;

-- Backfill city_id for existing vendors from their denormalized `city` text column
UPDATE vendors v
SET city_id = c.id
FROM cities c
WHERE v.city_id IS NULL
  AND LOWER(v.city) = LOWER(c.name);
