import { Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VendorCard } from "@/components/shared/vendor-card";
import { useFavoriteVendors } from "@/lib/hooks";

export function CustomerFavorites({ onBook }: { onBook: () => void }) {
  const { vendorList, loading, toggleFavorite, isFavorited } = useFavoriteVendors();

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 shadow-soft">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-3" />
            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (vendorList.length === 0) {
    return (
      <div className="text-center py-16">
        <Heart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No favorites yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tap the heart icon on any vendor to save them here
        </p>
        <Button variant="outline" onClick={() => {}}>
          <MapPin className="h-4 w-4 mr-1.5" />
          Find Vendors
        </Button>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {vendorList.map((v) => (
        <VendorCard
          key={v.id}
          vendor={v}
          onBook={onBook}
          isFavorited={isFavorited(v.id)}
          onToggleFavorite={() => toggleFavorite(v.id)}
        />
      ))}
    </div>
  );
}
