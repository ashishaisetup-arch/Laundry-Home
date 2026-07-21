-- Make order_id nullable in reviews (reviews can be vendor-level, not order-specific)
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'reviews' and column_name = 'order_id' and is_nullable = 'NO') then
    alter table reviews alter column order_id drop not null;
  end if;
end $$;
