-- Add orders and notifications to realtime publication for live updates
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null;
end $$;
