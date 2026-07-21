import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const supabase = createAdminClient();
    let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_tickets").insert({
      ...req.body,
      user_id: req.body.user_id || user?.id,
      status: "open",
    }).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = createAdminClient();
    const update: Record<string, any> = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await admin.from("support_tickets").update(update).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/assign", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    if (!assigned_to) { res.status(400).json({ error: "assigned_to is required" }); return; }
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_tickets").update({
      assigned_to, status: "in_progress", updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/respond", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    if (!response) { res.status(400).json({ error: "response is required" }); return; }
    const admin = createAdminClient();
    const { data: ticket } = await admin.from("support_tickets").select("*").eq("id", id).single();
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
    const existing = (ticket.responses || []) as any[];
    const { data, error } = await admin.from("support_tickets").update({
      responses: [...existing, { by: req.body.by || "admin", message: response, at: new Date().toISOString() }],
      status: "waiting_on_customer",
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/close", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_tickets").update({
      status: "closed", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
