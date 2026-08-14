-- ============================================================================
-- Migration 00048: Backfill canonical slugs for all services
--
-- Assigns stable machine identifiers (legacy-key-compatible) to every service
-- that still has a NULL slug. The three time-based add-ons already have slugs
-- (same_day_delivery / 24_hour_delivery / express_pickup) and are untouched.
-- Never overwrites an existing slug, never touches display names.
-- ============================================================================

update public.services set slug = 'wash_fold'            where name = 'Wash & Fold'            and slug is null;
update public.services set slug = 'wash_iron'            where name = 'Wash & Iron'            and slug is null;
update public.services set slug = 'premium_wash'         where name = 'Premium Wash'           and slug is null;
update public.services set slug = 'express_wash'         where name = 'Express Wash'           and slug is null;
update public.services set slug = 'eco_wash'             where name = 'Eco Wash'               and slug is null;
update public.services set slug = 'dry_clean'            where name = 'Dry Clean'              and slug is null;
update public.services set slug = 'steam_iron'           where name = 'Steam Iron'             and slug is null;
update public.services set slug = 'premium_iron'         where name = 'Premium Iron'           and slug is null;
update public.services set slug = 'fold_only'            where name = 'Fold Only'              and slug is null;
update public.services set slug = 'stain_removal'        where name = 'Stain Removal'          and slug is null;
update public.services set slug = 'whitening'            where name = 'Whitening'              and slug is null;
update public.services set slug = 'fabric_softener'      where name = 'Fabric Softener'        and slug is null;
update public.services set slug = 'perfume_finish'       where name = 'Perfume Finish'         and slug is null;
update public.services set slug = 'sanitization'         where name = 'Sanitization'           and slug is null;
update public.services set slug = 'anti_bacterial_wash'  where name = 'Anti-Bacterial Wash'    and slug is null;
update public.services set slug = 'steam_sanitization'   where name = 'Steam Sanitization'     and slug is null;
update public.services set slug = 'pet_hair_removal'     where name = 'Pet Hair Removal'       and slug is null;
update public.services set slug = 'doorstep_ironing'     where name = 'Doorstep Ironing'       and slug is null;
update public.services set slug = 'premium_packaging'    where name = 'Premium Packaging'      and slug is null;
update public.services set slug = 'gift_packaging'       where name = 'Gift Packaging'         and slug is null;
update public.services set slug = 'bedroom'              where name = 'Bedroom'                and slug is null;
update public.services set slug = 'laundry_bag'          where name = 'Laundry Bag'            and slug is null;
update public.services set slug = 'premium_laundry_bag'  where name = 'Premium Laundry Bag'    and slug is null;