-- Vendor settlements: immutable financial records for payout reporting
-- Each settlement covers one period (e.g. one week or one month) for one vendor.
-- commission_rate_bps is snapped at settlement creation so future rule changes
-- never alter the historical interpretation.

CREATE TABLE IF NOT EXISTS vendor_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  gross_order_value integer NOT NULL DEFAULT 0,
  commission_rate_bps integer NOT NULL DEFAULT 1000,
  commission_amount integer NOT NULL DEFAULT 0,
  tax_amount integer NOT NULL DEFAULT 0,
  refunds_amount integer NOT NULL DEFAULT 0,
  adjustments_amount integer NOT NULL DEFAULT 0,
  net_payout integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'settled', 'failed')),
  payout_reference text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_settlements_vendor ON vendor_settlements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON vendor_settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON vendor_settlements(status);

-- Per-order audit trail for each settlement
CREATE TABLE IF NOT EXISTS vendor_settlement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES vendor_settlements(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id),
  gross_amount integer NOT NULL DEFAULT 0,
  commission_rate_bps integer NOT NULL DEFAULT 1000,
  commission_amount integer NOT NULL DEFAULT 0,
  refund_amount integer NOT NULL DEFAULT 0,
  adjustment_amount integer NOT NULL DEFAULT 0,
  net_amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON vendor_settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_order ON vendor_settlement_items(order_id);
