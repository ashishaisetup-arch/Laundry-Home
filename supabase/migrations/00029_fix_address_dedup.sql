-- Fix duplicated address parts caused by generic `sublocality` type matching
-- the same component as sublocality_level_4 (e.g. "Horamavu Agara, Horamavu, Horamavu Agara")
update addresses
set
  line = trim(array_to_string((string_to_array(line, ', '))[1:2], ', ')),
  area  = trim(array_to_string((string_to_array(area, ', '))[1:2], ', '))
where cardinality(string_to_array(line, ', ')) > 2
   or cardinality(string_to_array(area, ', ')) > 2;
