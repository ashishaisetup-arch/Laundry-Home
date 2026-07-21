-- Add vendor service configuration columns
alter table vendors add column if not exists business_hours jsonb default '{"monday":{"open":"08:00","close":"21:00","active":true},"tuesday":{"open":"08:00","close":"21:00","active":true},"wednesday":{"open":"08:00","close":"21:00","active":true},"thursday":{"open":"08:00","close":"21:00","active":true},"friday":{"open":"08:00","close":"21:00","active":true},"saturday":{"open":"08:00","close":"21:00","active":true},"sunday":{"open":"08:00","close":"21:00","active":false}}';
alter table vendors add column if not exists service_radius_km integer not null default 5;
alter table vendors add column if not exists min_order_value integer not null default 150;
alter table vendors add column if not exists express_enabled boolean not null default true;
