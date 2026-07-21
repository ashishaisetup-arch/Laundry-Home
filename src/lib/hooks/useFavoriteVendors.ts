import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { Vendor } from "@/lib/types";

export interface FavoriteEntry {
  vendorId: string;
  createdAt: string;
  vendors: Vendor;
}

export function useFavoriteVendors() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<FavoriteEntry[]>("/api/favorites");
      setFavorites(data || []);
    } catch (err: any) {
      if (err.message?.includes("does not exist")) {
        setFavorites([]);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const addFavorite = async (vendorId: string) => {
    await api.post("/api/favorites", { vendor_id: vendorId });
    await fetchFavorites();
  };

  const removeFavorite = async (vendorId: string) => {
    await api.delete(`/api/favorites/${vendorId}`);
    await fetchFavorites();
  };

  const isFavorited = (vendorId: string) =>
    favorites.some((f) => f.vendorId === vendorId);

  const toggleFavorite = async (vendorId: string) => {
    if (isFavorited(vendorId)) {
      await removeFavorite(vendorId);
    } else {
      await addFavorite(vendorId);
    }
  };

  const vendorList: Vendor[] = favorites.map((f) => f.vendors);

  return { favorites, vendorList, loading, error, addFavorite, removeFavorite, toggleFavorite, isFavorited, refetch: fetchFavorites };
}
