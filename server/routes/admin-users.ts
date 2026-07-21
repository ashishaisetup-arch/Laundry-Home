import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

// GET /api/admin/users — list all users with profile data
router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data: profiles, error } = await admin
      .from("user_profiles")
      .select("id, name, email, phone, role, avatar, suspended, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }

    const users = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.name || "User",
      email: p.email || "",
      role: p.role || "customer",
      phone: p.phone || "",
      avatar: p.avatar || "",
      status: p.suspended ? "suspended" : "active",
      lastActive: p.updated_at || p.created_at,
      joined: p.created_at,
    }));

    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id — update user name, email, role, suspend/reactivate
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const admin = createAdminClient();

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;

    // Map status to suspended boolean
    if (status !== undefined) {
      updates.suspended = status === "suspended";
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("user_profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }

    res.json({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone || "",
      avatar: data.avatar || "",
      status: data.suspended ? "suspended" : "active",
      lastActive: data.updated_at,
      joined: data.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
