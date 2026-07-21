import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import express from "express";
import app from "./app";
import { ensureSystemTables, createAdminClient } from "./supabase";

// Serve static frontend (self-hosted only)
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("/", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
app.get("/{*any}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = parseInt(process.env.PORT || "8080");

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  ensureSystemTables().catch((err) => console.warn("System tables init:", err.message));

  // Fix stuck orders: when delivery task is "delivered" but order isn't "completed"
  (async () => {
    try {
      const supabase = createAdminClient();
      const { data: tasks } = await supabase
        .from("delivery_tasks")
        .select("order_id")
        .eq("status", "delivered");
      if (!tasks || tasks.length === 0) return;
      const orderIds = [...new Set(tasks.map((t: any) => t.order_id).filter(Boolean))];
      for (const oid of orderIds) {
        const { data: order } = await supabase
          .from("orders")
          .select("status, current_stage_index")
          .eq("id", oid)
          .single();
        if (order && order.status !== "completed") {
          const { data: stages } = await supabase
            .from("order_stage_events")
            .select("*")
            .eq("order_id", oid)
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
            .eq("id", oid);
          console.log(`Fixed stuck order ${oid}: delivered -> completed`);
        }
      }
    } catch (err: any) {
      console.warn("Startup order fix:", err.message);
    }
  })();
});
