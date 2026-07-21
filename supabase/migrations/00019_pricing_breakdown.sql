-- Add pricing breakdown columns to orders
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists coupon_discount integer not null default 0;
alter table orders add column if not exists subscription_discount integer not null default 0;
alter table orders add column if not exists reward_points_used integer not null default 0;
alter table orders add column if not exists wallet_used integer not null default 0;
alter table orders add column if not exists express_surcharge integer not null default 0;
alter table orders add column if not exists surge_charge integer not null default 0;
alter table orders add column if not exists pricing_breakdown jsonb;
