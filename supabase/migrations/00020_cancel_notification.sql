-- Auto-create notifications for all stakeholders when an order is cancelled

create or replace function notify_stakeholders_on_cancel()
returns trigger as $$
declare
  v_owner_id uuid;
begin
  if NEW.status = 'cancelled' and OLD.status != 'cancelled' then
    -- Notify customer
    insert into notifications (user_id, type, title, body, channel)
    values (
      NEW.customer_id,
      'payment',
      'Order Cancelled',
      'Order #' || NEW.code || ' has been cancelled. Refund of ₹' || NEW.total || ' will be processed in 3-5 business days.',
      'push'
    );

    -- Notify vendor owner
    if NEW.vendor_id is not null then
      select owner_id into v_owner_id from vendors where id = NEW.vendor_id;
      if v_owner_id is not null then
        insert into notifications (user_id, type, title, body, channel)
        values (
          v_owner_id,
          'booking',
          'Order Cancelled',
          'Order #' || NEW.code || ' was cancelled by the customer.',
          'push'
        );
      end if;
    end if;

    -- Notify delivery executive
    if NEW.delivery_executive_id is not null then
      insert into notifications (user_id, type, title, body, channel)
      values (
        NEW.delivery_executive_id,
        'delivery',
        'Delivery Cancelled',
        'Order #' || NEW.code || ' has been cancelled. No delivery needed.',
        'push'
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_order_cancel_notify on orders;
create trigger on_order_cancel_notify
  after update on orders
  for each row
  when (NEW.status = 'cancelled' and OLD.status != 'cancelled')
  execute function notify_stakeholders_on_cancel();
