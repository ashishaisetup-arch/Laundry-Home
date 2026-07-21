-- Add orders and notifications to realtime publication for live updates
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table notifications;
