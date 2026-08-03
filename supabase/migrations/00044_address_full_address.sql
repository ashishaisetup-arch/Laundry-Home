-- Add full_address to addresses for Google Places formatted addresses
alter table addresses add column if not exists full_address text;
