import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlaceResult {
  placeId: string;
  description: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  pincode: string;
  area: string;
  building: string;
  streetAddress: string;
  formattedAddress: string;
}

interface Props {
  value: string;
  onChange: (place: PlaceResult | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

function extractPlace(place: google.maps.places.PlaceResult): PlaceResult | null {
  if (!place.place_id) return null;
  const components = place.address_components || [];
  const extract = (types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name || "";

  let lat = 0;
  let lng = 0;
  if (place.geometry?.location) {
    lat = place.geometry.location.lat();
    lng = place.geometry.location.lng();
  }

  const formattedAddress = place.formatted_address || "";

  const streetParts = [
    extract(["street_number"]),
    extract(["route"]),
    extract(["premise"]),
    extract(["subpremise"]),
    extract(["neighborhood"]),
    extract(["sublocality_level_5"]),
    extract(["sublocality_level_4"]),
    extract(["sublocality_level_3"]),
    extract(["sublocality_level_2"]),
    extract(["sublocality_level_1"]),
  ].filter(Boolean);
  let streetAddress = streetParts.join(", ");

  const areaParts = [
    extract(["sublocality_level_2"]),
    extract(["sublocality_level_1"]),
  ].filter(Boolean);
  let area = areaParts.join(", ");

  const city = extract(["locality", "administrative_area_level_3", "administrative_area_level_2", "administrative_area_level_1"]);

  const state = extract(["administrative_area_level_1"]);

  let pincode = extract(["postal_code"]);
  if (!pincode) {
    const match = formattedAddress.match(/\b(\d{6})\b/);
    if (match) pincode = match[1];
  }

  const placeTypes = place.types || [];
  let building = "";
  if (placeTypes.some((t) => t === "establishment" || t === "point_of_interest" || t === "premise")) {
    building = place.name || extract(["premise"]);
  }
  if (!building) {
    building = extract(["premise"]);
  }
  if (building && (building === streetAddress || building === area || building === city || (area && building.includes(area)))) {
    building = "";
  }

  if (!streetAddress && formattedAddress) {
    const addrParts = formattedAddress.split(",").map(s => s.trim()).filter(Boolean);
    if (addrParts.length > 0) {
      streetAddress = addrParts[0];
    }
  }

  if (!area && formattedAddress) {
    const addrParts = formattedAddress.split(",").map(s => s.trim()).filter(Boolean);
    if (addrParts.length > 1) {
      const second = addrParts[1];
      if (second !== city && pincode && !second.includes(pincode)) {
        area = second;
      }
    }
  }

  return {
    placeId: place.place_id,
    description: formattedAddress,
    latitude: lat,
    longitude: lng,
    city: city || "Bengaluru",
    state,
    pincode: pincode || "",
    area: area || city,
    building,
    streetAddress,
    formattedAddress,
  };
}

export function AddressAutocomplete({ value, onChange, placeholder, className, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const places = useMapsLibrary("places");
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const autocompleteService = useMemo(() => {
    if (!places) return null;
    return new places.AutocompleteService();
  }, [places]);

  const placesService = useMemo(() => {
    if (!places) return null;
    return new places.PlacesService(document.createElement("div"));
  }, [places]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!autocompleteService || !query || query.length < 2) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      autocompleteService.getPlacePredictions(
        {
          input: query,
          types: ["geocode", "establishment"],
          componentRestrictions: { country: "in" },
        },
        (results, status) => {
          setLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(
              results.map((p) => ({
                placeId: p.place_id,
                description: p.description,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || "",
              }))
            );
          } else {
            setPredictions([]);
          }
        }
      );
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [autocompleteService, query]);

  const selectPlace = useCallback(
    (placeId: string) => {
      if (!placesService) return;
      setPredictions([]);

      placesService.getDetails(
        {
          placeId,
          fields: ["place_id", "formatted_address", "geometry", "address_components", "name", "types"],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const result = extractPlace(place);
            if (result) {
              setQuery(result.streetAddress || result.formattedAddress);
              onChange(result);
            }
          }
        }
      );
    },
    [placesService, onChange]
  );

  const shouldShow = focused && predictions.length > 0;

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setQuery(""); setFocused(true); }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || "Search your area or address..."}
        disabled={disabled}
        className="pl-8"
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      )}
      {shouldShow && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-border rounded-lg bg-background shadow-lg max-h-48 overflow-y-auto z-[9999]">
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
              onMouseDown={(e) => {
                e.preventDefault();
                selectPlace(p.placeId);
                setFocused(false);
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium truncate">{p.mainText}</p>
                {p.secondaryText && (
                  <p className="text-[11px] text-muted-foreground truncate">{p.secondaryText}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
