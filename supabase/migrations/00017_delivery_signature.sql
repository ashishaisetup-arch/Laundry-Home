-- Add signature column to delivery_tasks for proof of delivery
alter table delivery_tasks add column if not exists signature text;
