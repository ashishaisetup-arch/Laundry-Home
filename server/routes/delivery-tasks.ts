import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const TASK_TO_ORDER_STAGE: Record<string, { status: string; index: number }> = {
  heading_to_pickup:   { status: "pickup_scheduled",  index: 3 },
  picked_up:           { status: "pickup_completed",   index: 4 },
  ready_for_delivery:  { status: "ready_for_dispatch", index: 14 },
  out_for_delivery:    { status: "out_for_delivery",   index: 15 },
  delivered:           { status: "delivered",          index: 16 },
};

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function completeOrder(supabase: ReturnType<typeof createAdminClient>, orderId: string) {
  const { data: stages } = await supabase
    .from("order_stage_events")
    .select("*")
    .eq("order_id", orderId)
    .order("stage");

  if (stages && stages[17]) {
    await supabase
      .from("order_stage_events")
      .update({ done: true, timestamp: new Date().toISOString() })
      .eq("id", stages[17].id);
  }

  await supabase
    .from("orders")
    .update({ status: "completed", current_stage_index: 17 })
    .eq("id", orderId);
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const execId = req.query.execId as string;
    const status = req.query.status as string;

    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();

    const admin = createAdminClient();
    let query = admin
      .from("delivery_tasks")
      .select("*, order:order_id(pickup_lat, pickup_lng, delivery_lat, delivery_lng)")
      .order("created_at", { ascending: false });

    if (execId) query = query.eq("exec_id", execId);
    else if (user) query = query.eq("exec_id", user.id);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    const tasks = (data || []).map((t: any) => {
      const { order, ...rest } = t;
      return {
        ...rest,
        pickup_lat: order?.pickup_lat ?? null,
        pickup_lng: order?.pickup_lng ?? null,
        delivery_lat: order?.delivery_lat ?? null,
        delivery_lng: order?.delivery_lng ?? null,
      };
    });
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();

    const newStatus = req.body.status as string | undefined;

    // Fetch the current task before updating
    const { data: task, error: fetchErr } = await supabase
      .from("delivery_tasks")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) { res.status(404).json({ error: "Task not found" }); return; }

    // Update the task
    const { data, error } = await supabase.from("delivery_tasks").update(req.body).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }

    // Cascade task status to order stage
    if (newStatus && TASK_TO_ORDER_STAGE[newStatus]) {
      const mapping = TASK_TO_ORDER_STAGE[newStatus];
      const orderId = task.order_id;

      // Find the order_stage_event for the target stage index
      const { data: stages } = await supabase
        .from("order_stage_events")
        .select("*")
        .eq("order_id", orderId)
        .order("stage");

      if (stages && stages[mapping.index]) {
        await supabase
          .from("order_stage_events")
          .update({ done: true, timestamp: new Date().toISOString() })
          .eq("id", stages[mapping.index].id);
      }

      // Update the order status and current_stage_index
      const orderUpdate: Record<string, any> = {
        status: mapping.status,
        current_stage_index: mapping.index,
      };

      // Set delivery executive info — only if order doesn't have one yet
      if (newStatus === "heading_to_pickup" || newStatus === "out_for_delivery") {
        let execId = task.exec_id;
        if (!execId) {
          const cookieClient = createServerClientWithCookies((name: string) => req.cookies?.[name]);
          const { data: { user } } = await cookieClient.auth.getUser();
          execId = user?.id;
        }
        // Only auto-populate if the order has NO exec assigned yet
        if (execId) {
          const { data: existingOrder } = await supabase
            .from("orders")
            .select("delivery_executive_id")
            .eq("id", orderId)
            .single();
          if (existingOrder && !existingOrder.delivery_executive_id) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("name")
              .eq("id", execId)
              .single();
            if (profile) {
              orderUpdate.delivery_executive_id = execId;
              orderUpdate.delivery_executive_name = profile.name;
            }
          }
        }
      }

      await supabase
        .from("orders")
        .update(orderUpdate)
        .eq("id", orderId);
    }

    // Auto-complete when delivered
    if (newStatus === "delivered") {
      await completeOrder(supabase, task.order_id);
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/otp", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = createAdminClient();

    const { data: task } = await admin.from("delivery_tasks").select("*").eq("id", id).single();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    let otp = task.delivery_otp;
    if (!otp) {
      otp = generateOTP();
      await admin.from("delivery_tasks").update({ delivery_otp: otp }).eq("id", id);
    }

    res.json({ otp, masked: otp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/verify-otp", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    if (!otp) { res.status(400).json({ error: "OTP is required" }); return; }

    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("*").eq("id", id).single();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    if (task.delivery_otp !== otp) {
      res.status(400).json({ error: "Invalid OTP", verified: false });
      return;
    }

    await admin.from("delivery_tasks").update({
      otp_verified: true,
      delivery_otp: null,
    }).eq("id", id);

    // Auto-complete if the task was already delivered
    if (task.status === "delivered") {
      await completeOrder(admin, task.order_id);
    }

    res.json({ verified: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/photo", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { photo_url, photo_data } = req.body;
    if (!photo_url && !photo_data) { res.status(400).json({ error: "photo_url or photo_data is required" }); return; }

    // If base64 data provided, store it as the URL
    if (photo_data && !photo_url) {
      photo_url = photo_data;
    }

    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("photos").eq("id", id).single();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const existingPhotos = (task.photos || []) as string[];
    await admin.from("delivery_tasks").update({
      photos: [...existingPhotos, photo_url],
    }).eq("id", id);

    res.json({ photos: [...existingPhotos, photo_url] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/signature", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { signature_data } = req.body;
    if (!signature_data) { res.status(400).json({ error: "signature_data is required" }); return; }

    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("signature").eq("id", id).single();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    await admin.from("delivery_tasks").update({
      signature: signature_data,
    }).eq("id", id);

    res.json({ signature: signature_data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
