export const KNOWN_AREAS: Record<string, { lat: number; lng: number }> = {
  Indiranagar:     { lat: 12.9719, lng: 77.6413 },
  Koramangala:     { lat: 12.9352, lng: 77.6245 },
  "HSR Layout":    { lat: 12.9116, lng: 77.6389 },
  Jayanagar:       { lat: 12.9250, lng: 77.5938 },
  "BTM Layout":    { lat: 12.9166, lng: 77.6101 },
  Whitefield:      { lat: 12.9698, lng: 77.7500 },
  "MG Road":       { lat: 12.9750, lng: 77.6067 },
  Marathahalli:    { lat: 12.9591, lng: 77.6974 },
  "Electronic City": { lat: 12.8399, lng: 77.6770 },
  "JP Nagar":      { lat: 12.9063, lng: 77.5857 },
  Horamavu:        { lat: 13.0208, lng: 77.6583 },
  Hebbal:          { lat: 13.0358, lng: 77.5970 },
  Banashankari:    { lat: 12.9250, lng: 77.5468 },
  Rajajinagar:     { lat: 12.9900, lng: 77.5527 },
  Malleshwaram:    { lat: 13.0031, lng: 77.5710 },
  Basavanagudi:    { lat: 12.9400, lng: 77.5700 },
  Yeshwanthpur:    { lat: 13.0200, lng: 77.5450 },
  "Vijay Nagar":   { lat: 12.9700, lng: 77.5300 },
  "RT Nagar":      { lat: 13.0200, lng: 77.5950 },
  Kengeri:         { lat: 12.9100, lng: 77.4800 },
};

export function lookupAreaCoords(area: string): { lat: number; lng: number } | null {
  const entry = KNOWN_AREAS[area];
  if (entry) return entry;
  const key = Object.keys(KNOWN_AREAS).find(
    (k) => k.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(k.toLowerCase())
  );
  return key ? KNOWN_AREAS[key] : null;
}
