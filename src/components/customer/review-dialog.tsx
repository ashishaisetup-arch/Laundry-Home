import { useState, useEffect } from "react";
import { Star, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { Review, Order } from "@/lib/types";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

const RATING_LABELS = ["Poor", "Fair", "Good", "Very Good", "Excellent"];

function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium min-w-[80px]">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5 transition-transform hover:scale-110 active:scale-90"
          >
            <Star
              className={`h-5 w-5 ${
                star <= value
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-xs text-muted-foreground min-w-[60px] text-right">
          {RATING_LABELS[value - 1]}
        </span>
      )}
    </div>
  );
}

interface ReviewDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ReviewDialog({ order, open, onOpenChange, onSuccess }: ReviewDialogProps) {
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [overall, setOverall] = useState(0);
  const [vendorRating, setVendorRating] = useState(0);
  const [pickupRating, setPickupRating] = useState(0);
  const [laundryRating, setLaundryRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open || !order.id) return;
    setChecking(true);
    setExistingReview(null);
    setOverall(0);
    setVendorRating(0);
    setPickupRating(0);
    setLaundryRating(0);
    setDeliveryRating(0);
    setComment("");

    api.get<Review[]>(`/api/reviews?orderId=${order.id}`)
      .then((reviews) => {
        if (reviews && reviews.length > 0) {
          setExistingReview(reviews[0]);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [open, order.id]);

  const canSubmit = overall > 0 && vendorRating > 0 && pickupRating > 0 && laundryRating > 0 && deliveryRating > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.post("/api/reviews", {
        order_id: order.id,
        vendor_id: order.vendorId,
        customer_name: order.customerName,
        customer_avatar: order.customerAvatar,
        vendor_name: order.vendorName,
        overall,
        vendor_rating: vendorRating,
        pickup_rating: pickupRating,
        laundry_rating: laundryRating,
        delivery_rating: deliveryRating,
        comment: comment.trim() || null,
      });
      toast.success("Review submitted!", {
        description: "Thanks for sharing your experience.",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to submit review", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Write a Review
          </DialogTitle>
          <DialogDescription>
            Share your experience with {order.vendorName}
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : existingReview ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <Star className="h-8 w-8 mx-auto text-amber-400 fill-amber-400 mb-2" />
              <p className="font-semibold">You already reviewed this order</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your review was submitted on{" "}
                {new Date(existingReview.date).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {existingReview.comment && (
                <p className="text-sm mt-3 bg-background rounded-lg p-3 italic text-muted-foreground">
                  "{existingReview.comment}"
                </p>
              )}
              <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  Overall <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {existingReview.overall}/5
                </span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Vendor info */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback
                  className="text-white text-sm font-bold"
                  style={{ background: order.vendorLogoColor || "var(--primary)" }}
                >
                  {order.vendorLogoInitials || "V"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{order.vendorName}</p>
                <p className="text-xs text-muted-foreground">{order.code || `Order #${order.id.slice(0, 8)}`}</p>
              </div>
            </div>

            <Separator />

            {/* Star inputs */}
            <div className="space-y-3">
              <StarInput label="Overall" value={overall} onChange={setOverall} />
              <StarInput label="Vendor" value={vendorRating} onChange={setVendorRating} />
              <StarInput label="Pickup" value={pickupRating} onChange={setPickupRating} />
              <StarInput label="Laundry" value={laundryRating} onChange={setLaundryRating} />
              <StarInput label="Delivery" value={deliveryRating} onChange={setDeliveryRating} />
            </div>

            {/* Comment */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Comment <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Tell others about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>

            {/* AI prompt */}
            <div className="rounded-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 p-3 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">AI Suggestion</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Honest reviews help other customers make better choices. {order.vendorName} values your feedback!
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
                ) : null}
                Submit Review
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
