-- Fix area field where it duplicates the line field (e.g. area = "Horamavu Agara, Horamavu" when line = "Horamavu Agara, Horamavu")
-- Keep only the last (broader) part of the area
update addresses
set area = trim(split_part(area, ', ', cardinality(string_to_array(area, ', '))))
where cardinality(string_to_array(area, ', ')) > 1
  and split_part(area, ', ', 1) = split_part(line, ', ', 1);
