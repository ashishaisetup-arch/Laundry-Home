-- Auto-create a notification for the vendor when a new order is assigned to them

create or replace function notify_vendor_on_new_order()
returns trigger as $$
declare
  v_owner_id uuid;
begin
  -- Only act when a vendor has been assigned
  if NEW.vendor_id is not null then
    select owner_id into v_owner_id from vendors where id = NEW.vendor_id;
    if v_owner_id is not null then
      insert into notifications (user_id, type, title, body, channel)
      values (
        v_owner_id,
        'booking',
        'New Order Received',
        'New order #' || NEW.code || ' has been assigned to you.',
        'push'
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_order_insert_create_notification on orders;
create trigger on_order_insert_create_notification
  after insert on orders
  for each row
  execute function notify_vendor_on_new_order();
