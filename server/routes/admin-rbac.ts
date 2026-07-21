import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

// GET /api/admin/rbac — return all roles with their permissions
router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();

    const { data: roles, error: rolesErr } = await admin
      .from("roles")
      .select("*")
      .order("name");

    if (rolesErr) { res.status(500).json({ error: rolesErr.message }); return; }

    const { data: permissions, error: permErr } = await admin
      .from("role_permissions")
      .select("*")
      .order("resource");

    if (permErr) { res.status(500).json({ error: permErr.message }); return; }

    // Group permissions by role for easier frontend consumption
    const permissionByRole: Record<string, any[]> = {};
    for (const p of permissions || []) {
      if (!permissionByRole[p.role]) permissionByRole[p.role] = [];
      permissionByRole[p.role].push(p);
    }

    res.json({ roles: roles || [], permissions: permissions || [], permissionByRole });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/rbac/:id — toggle a single permission
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { allowed } = req.body;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("role_permissions")
      .update({ allowed: !!allowed })
      .eq("id", id)
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
