import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useReviews } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function CustomerReviews() {
  const { data: reviews, loading } = useReviews();
  const reviewsData = reviews || [];

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 shadow-soft">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-2 w-1/4 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-full bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (reviewsData.length === 0) {
    return (
      <div className="text-center py-16">
        <Star className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No reviews yet</h3>
        <p className="text-sm text-muted-foreground">
          Reviews you leave after orders will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviewsData.map((r) => (
        <Card key={r.id} className="p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary-surface text-primary-foreground text-xs font-semibold">
                  {r.customerAvatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{r.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  Reviewed {r.vendorName} · {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("h-3.5 w-3.5", i < r.overall ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Order #{r.orderId}</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-foreground/90">{r.comment}</p>

          {/* Rating breakdown */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60">
            {[
              { label: "Vendor", v: r.vendorRating },
              { label: "Pickup", v: r.pickupRating },
              { label: "Laundry", v: r.laundryRating },
              { label: "Delivery", v: r.deliveryRating },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold">{s.v}.0</p>
              </div>
            ))}
          </div>

          {r.vendorReply && (
            <div className="mt-3 rounded-lg bg-muted/40 p-3 border-l-2 border-primary">
              <p className="text-[10px] font-semibold text-primary mb-1">💬 Reply from {r.vendorName}</p>
              <p className="text-xs text-muted-foreground">{r.vendorReply}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
