-- Make order_id nullable in reviews (reviews can be vendor-level, not order-specific)
alter table reviews alter column order_id drop not null;
