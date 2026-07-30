import { Router, Request, Response } from "express";
import { demandForecaster } from "../lib/demand-forecaster";

const router = Router();

// POST /api/cron/forecast — triggered by Vercel Cron (daily 3 AM)
router.post("/forecast", async (_req: Request, res: Response) => {
  // Verify cron secret
  const authHeader = _req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    res.status(500).json({ error: "CRON_SECRET not configured" });
    return;
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await demandForecaster.runForecast();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
