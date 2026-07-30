-- ============================================================================
-- Item Master — canonical item reference for the laundry catalog
-- Seeded from existing service_items (deduplicated by item_name + category)
-- ============================================================================

create table if not exists item_master (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  item_name text not null,
  emoji text,
  estimated_weight_kg numeric(4,2),     -- for weight estimation
  active boolean not null default true,
  unique(item_name, category)
);

-- RLS
alter table item_master enable row level security;
create policy "Item master public read"
  on item_master for select using (true);
create policy "Item master admin write"
  on item_master for all using (get_user_role() in ('admin','superadmin'));

-- Seed from existing service_items (deduplicated)
insert into item_master (category, item_name, emoji, estimated_weight_kg)
values
  -- Men
  ('Men', 'Shirt',           '👔', 0.20),
  ('Men', 'T-Shirt',         '👕', 0.15),
  ('Men', 'Jeans',           '👖', 0.50),
  ('Men', 'Trousers',        '👖', 0.35),
  ('Men', 'Shorts',          '🩳', 0.20),
  ('Men', 'Suit',            '🤵', 1.00),
  ('Men', 'Blazer',          '🧥', 0.80),
  ('Men', 'Sherwani',        '🪭', 1.20),
  ('Men', 'Ethnic Wear',     '🪷', 0.60),
  ('Men', 'Sweater',         '🧶', 0.40),
  ('Men', 'Jacket',          '🧥', 0.70),
  ('Men', 'Track Pants',     '🏃', 0.25),
  -- Women
  ('Women', 'Saree',         '🪭', 0.50),
  ('Women', 'Kurti',         '👚', 0.25),
  ('Women', 'Kurta',         '👚', 0.30),
  ('Women', 'Lehenga',       '👗', 1.00),
  ('Women', 'Dress',         '👗', 0.40),
  ('Women', 'Top',           '👚', 0.15),
  ('Women', 'Leggings',      '🩱', 0.15),
  ('Women', 'Dupatta',       '🧣', 0.15),
  ('Women', 'Skirt',         '👗', 0.20),
  ('Women', 'Night Gown',    '😴', 0.25),
  ('Women', 'Jeans',         '👖', 0.40),
  ('Women', 'Trousers',      '👖', 0.30),
  -- Kids
  ('Kids', 'School Uniform', '🎒', 0.25),
  ('Kids', 'Baby Clothes',   '👶', 0.10),
  ('Kids', 'T-Shirt',        '👕', 0.10),
  ('Kids', 'Shorts',         '🩳', 0.10),
  ('Kids', 'Frock',          '👗', 0.15),
  ('Kids', 'Jeans',          '👖', 0.25),
  -- Home Care
  ('Home Care', 'Bedsheet',       '🛏️', 0.80),
  ('Home Care', 'Pillow Cover',   '🛌', 0.15),
  ('Home Care', 'Blanket',        '🦺', 2.00),
  ('Home Care', 'Quilt',          '🛏️', 2.50),
  ('Home Care', 'Comforter',       '🛏️', 2.00),
  ('Home Care', 'Duvet',          '🛏️', 1.80),
  ('Home Care', 'Curtain',        '🪟', 1.00),
  ('Home Care', 'Sofa Cover',     '🛋️', 1.50),
  ('Home Care', 'Cushion Cover',  '🪑', 0.20),
  ('Home Care', 'Table Cloth',    '🍽️', 0.50),
  ('Home Care', 'Mattress Cover', '🛏️', 1.00),
  ('Home Care', 'Towel',          '🧴', 0.30),
  -- Accessories
  ('Accessories', 'Shoes',     '👟', 0.60),
  ('Accessories', 'Sneakers',  '👟', 0.50),
  ('Accessories', 'Leather Shoes', '👞', 0.70),
  ('Accessories', 'Handbag',   '👜', 0.50),
  ('Accessories', 'Tie',       '👔', 0.05),
  ('Accessories', 'Scarf',     '🧣', 0.10),
  ('Accessories', 'Cap',       '🧢', 0.05),
  ('Accessories', 'Belt',      '🪢', 0.10)
on conflict (item_name, category) do nothing;

-- Index for quick lookup
create index if not exists idx_item_master_category on item_master(category);
