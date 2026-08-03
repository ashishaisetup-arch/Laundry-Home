import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

// GET — list all categories
router.get("/", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .order("display_order");
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST — create category
router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { name, slug, description, icon, display_order, is_active, grouping } = req.body;
    const { data, error } = await supabase
      .from("service_categories")
      .insert({ name, slug, description, icon, display_order, is_active, grouping })
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT — update category
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { name, slug, description, icon, display_order, is_active, grouping } = req.body;
    const { data, error } = await supabase
      .from("service_categories")
      .update({ name, slug, description, icon, display_order, is_active, grouping })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — delete category
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("service_categories")
      .delete()
      .eq("id", req.params.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
