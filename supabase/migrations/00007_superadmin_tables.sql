-- Super Admin features: system_config table + suspended flag on user_profiles

-- 1. System configuration (single-row config stored as JSONB)
create table if not exists system_config (
  id integer primary key default 1,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- Insert default config
insert into system_config (id, config)
values (1, '{
  "general": {
    "platformName": "Laundry Home",
    "supportEmail": "support@laundryhome.com",
    "supportPhone": "+91 80-4567-8900",
    "defaultCurrency": "inr",
    "defaultLanguage": "en",
    "timezone": "ist",
    "allowSignups": true,
    "allowVendorApps": true,
    "maintenanceMode": false,
    "multiCity": true
  },
  "payments": {
    "upi": true,
    "cards": true,
    "netBanking": true,
    "wallet": true,
    "cod": true,
    "internationalCards": false,
    "gstRate": 18,
    "platformFee": 25,
    "deliveryFee": 40,
    "minOrderValue": 150
  },
  "notifications": {
    "push": true,
    "sms": true,
    "email": true,
    "whatsapp": true,
    "events": {
      "bookingConfirmation": true,
      "vendorAcceptance": true,
      "pickupReminder": true,
      "orderStatusChanges": true,
      "paymentSuccess": true,
      "deliveryReminder": true,
      "promotionalOffers": true,
      "aiDelayAlerts": true
    }
  },
  "security": {
    "mfaAdmins": true,
    "mfaVendors": false,
    "sessionTimeout": true,
    "ipWhitelist": false,
    "deviceManagement": true,
    "jwtRotation": true,
    "rateLimiting": true,
    "suspiciousLoginAlerts": true
  },
  "limits": {
    "maxItemsPerOrder": 50,
    "maxWeightKg": 30,
    "expressSurcharge": 50,
    "expressMultiplier": 1.5,
    "freeDeliveryThreshold": 500,
    "maxServiceRadiusKm": 10,
    "defaultCommissionRate": 10,
    "vendorPayoutCycleDays": 7
  }
}'::jsonb)
on conflict (id) do nothing;

-- 2. Add suspended flag to user_profiles (for User Management)
alter table user_profiles add column if not exists suspended boolean not null default false;

-- 3. Create or replace the updated_at trigger function (if not exists)
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add updated_at trigger for system_config
do $$
begin
  drop trigger if exists set_system_config_updated_at on system_config;
  create trigger set_system_config_updated_at
    before update on system_config
    for each row execute function update_updated_at_column();
end $$;

-- RLS for system_config
alter table system_config enable row level security;

do $$
begin
  drop policy if exists "System config admin access" on system_config;
  create policy "System config admin access"
    on system_config for all
    using (get_user_role() in ('admin','superadmin'));
end $$;
