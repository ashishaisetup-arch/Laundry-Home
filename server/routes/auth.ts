import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" }),
    );
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { res.status(401).json({ error: error.message }); return; }
    res.json({ session: data.session, user: data.user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role } = req.body;
    const supabase = createAdminClient();

    // Create auth user WITHOUT phone (phone goes to user_profiles only, so duplicates are allowed)
    const { data, error } = await supabase.auth.admin.createUser({
      email, password,
      email_confirm: true,
      user_metadata: { name, role: role || "customer" },
    });

    if (error) {
      // If email already registered, look up the existing user by email
      if (error.message?.toLowerCase().includes("already registered")) {
        const { data: users } = await supabase.auth.admin.listUsers();
        const existing = (users?.users || []).find((u: any) => u.email === email);
        if (existing) {
          // Update user_profiles with name and phone if provided
          const profileUpdates: Record<string, any> = {};
          if (name) profileUpdates.name = name;
          if (phone) profileUpdates.phone = phone;
          if (role) profileUpdates.role = role;
          if (Object.keys(profileUpdates).length > 0) {
            try {
              await supabase.from("user_profiles").update(profileUpdates).eq("id", existing.id);
            } catch {}
          }
          res.json({ user: { id: existing.id } });
          return;
        }
      }
      res.status(400).json({ error: error.message });
      return;
    }

    // Store phone in user_profiles separately
    if (phone && data.user) {
      try {
        await supabase.from("user_profiles").update({ phone }).eq("id", data.user.id);
      } catch {}
    }

    res.status(201).json({ user: data.user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      undefined,
      (name) => res.clearCookie(name, { path: "/" }),
    );
    await supabase.auth.signOut();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/session", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" }),
    );
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) { res.status(401).json({ error: sessionError.message }); return; }
    if (!session) { res.json({ user: null, session: null }); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.json({ user: null, session: null }); return; }

    const admin = createAdminClient();
    let { data: profile } = await admin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Auto-create profile if DB trigger didn't fire (e.g. migrations not applied)
    if (!profile) {
      const meta = user.user_metadata || {};
      const name = meta.name || user.email?.split("@")[0] || "User";
      const { data: newProfile, error: insertErr } = await admin
        .from("user_profiles")
        .insert({
          id: user.id,
          role: meta.role || "customer",
          name,
          email: user.email || "",
          phone: user.phone || meta.phone || "",
          avatar: meta.avatar || "",
        })
        .select()
        .single();
      if (!insertErr) profile = newProfile;
    }

    res.json({ session, user, profile: profile || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/otp", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" }),
    );
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true, message: "OTP sent" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/profile", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" }),
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { name, phone, email } = req.body;
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;

    const admin = createAdminClient();
    const { error } = await admin.from("user_profiles").update(updates).eq("id", user.id);
    if (error) { res.status(400).json({ error: error.message }); return; }

    const { data: profile } = await admin.from("user_profiles").select("*").eq("id", user.id).single();
    res.json({ profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/callback", (req: Request, res: Response) => {
  const host = req.headers.host || "localhost:8080";
  const proto = req.headers["x-forwarded-proto"] || "http";
  const base = `${proto}://${host}`;
  res.redirect(`${base}/?${new URLSearchParams(req.query as any).toString()}`);
});

export default router;
