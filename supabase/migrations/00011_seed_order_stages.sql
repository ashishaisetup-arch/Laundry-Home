-- Seed order_stage_definitions with the 18 lifecycle stages

insert into order_stage_definitions (stage, label, icon, sort_order) values
  ('placed',             'Order Placed',        'ClipboardCheck',  0),
  ('vendor_assigned',    'Vendor Assigned',     'Store',           1),
  ('vendor_accepted',    'Vendor Accepted',     'BadgeCheck',      2),
  ('pickup_scheduled',   'Pickup Scheduled',    'CalendarClock',   3),
  ('pickup_completed',   'Pickup Completed',    'PackageCheck',    4),
  ('laundry_received',   'Laundry Received',    'Boxes',           5),
  ('sorting',            'Sorting',             'ListTree',        6),
  ('tagging',            'Tagging',             'Tag',             7),
  ('washing',            'Washing',             'WashingMachine',  8),
  ('drying',             'Drying',              'Wind',            9),
  ('ironing',            'Ironing',             'Shirt',           10),
  ('dry_cleaning',       'Dry Cleaning',        'Sparkles',        11),
  ('quality_inspection', 'Quality Inspection',  'SearchCheck',     12),
  ('packing',            'Packing',             'Package',         13),
  ('ready_for_dispatch', 'Ready for Dispatch',  'Truck',           14),
  ('out_for_delivery',   'Out for Delivery',    'Bike',            15),
  ('delivered',          'Delivered',           'Home',            16),
  ('completed',          'Completed',           'CircleCheck',     17)
on conflict (stage) do nothing;
