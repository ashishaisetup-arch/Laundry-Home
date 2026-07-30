-- Backfill existing orders with customer_name from user_profiles
-- Run this in the Supabase Dashboard SQL Editor

update orders o
set
  customer_name = coalesce(up.name, 'Customer'),
  customer_avatar = coalesce(up.avatar, '')
from user_profiles up
where o.customer_id = up.id
  and o.customer_name = 'Customer';

-- Check results
select count(*) as updated_orders from orders where customer_name != 'Customer' and customer_name != 'User';
