-- Add OTP and photo support to delivery_tasks
alter table delivery_tasks
  add column if not exists delivery_otp text,
  add column if not exists otp_verified boolean not null default false,
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- Add responses and resolution tracking to support_tickets
alter table support_tickets
  add column if not exists responses jsonb not null default '[]'::jsonb,
  add column if not exists resolved_at timestamptz,
  add column if not exists rejection_reason text;

-- Add status values to support_tickets check constraint
alter table support_tickets
  drop constraint if exists support_tickets_status_check;
alter table support_tickets
  add constraint support_tickets_status_check
    check (status in ('open', 'in_progress', 'waiting_on_customer', 'closed'));
