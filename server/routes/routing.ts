import { Router, Request, Response } from "express";

const ORS_BASE = "https://api.openrouteservice.org/v2";

const router = Router();

router.get("/directions", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "OPENROUTESERVICE_API_KEY not configured" }); return; }

    const { start_lat, start_lng, end_lat, end_lng, profile } = req.query;
    if (!start_lat || !start_lng || !end_lat || !end_lng) {
      res.status(400).json({ error: "start_lat, start_lng, end_lat, end_lng are required" });
      return;
    }

    const orsProfile = profile || "driving-car";
    const coords = `${start_lng},${start_lat}|${end_lng},${end_lat}`;

    const response = await fetch(
      `${ORS_BASE}/directions/${orsProfile}/json?coordinates=${coords}`,
      {
        headers: {
          Authorization: apiKey,
          Accept: "application/json, application/geo+json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: "OpenRouteService error", detail: text });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/geocode/search", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "OPENROUTESERVICE_API_KEY not configured" }); return; }

    const { text } = req.query;
    if (!text) { res.status(400).json({ error: "text query param is required" }); return; }

    const response = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(text as string)}&boundary.country=IND&size=5`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      const text2 = await response.text();
      res.status(response.status).json({ error: "Geocode error", detail: text2 });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
