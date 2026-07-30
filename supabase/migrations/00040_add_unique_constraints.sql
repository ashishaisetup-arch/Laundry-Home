alter table pickup_slots add constraint pickup_slots_slot_key unique (slot);
alter table delivery_slots add constraint delivery_slots_slot_key unique (slot);
alter table delivery_live_locations add constraint delivery_live_locations_exec_id_key unique (exec_id);
