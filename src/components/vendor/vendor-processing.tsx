import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Camera, AlertCircle, X, ImagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useOrders } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ServiceIcon } from "@/components/shared/service-icon";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import type { Order } from "@/lib/types";
import { useMyVendorId } from "./vendor-helpers";

const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
const MAX_ORDER_PHOTOS = 5;
const ACCEPTED = "image/jpeg,image/png,image/webp";

const ISSUE_TYPES = ["Damage", "Stain not removed", "Missing item", "Wrong item", "Other"] as const;

function readPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function VendorProcessing() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);
  const allVendorOrders = orders || [];
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const processingOrders = allVendorOrders.filter(o =>
    ["pickup_completed", "laundry_received", "sorting", "tagging", "washing", "drying", "ironing", "dry_cleaning", "quality_inspection", "packing", "ready_for_dispatch"].includes(o.status)
  );
  const selectedOrder = processingOrders.find(o => o.id === selectedOrderId) || processingOrders[0];

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [issueFor, setIssueFor] = useState<Order | null>(null);
  const [issueType, setIssueType] = useState<(typeof ISSUE_TYPES)[number]>("Damage");
  const [issueNote, setIssueNote] = useState("");
  const [issuePhoto, setIssuePhoto] = useState<string | null>(null);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const issuePhotoRef = useRef<HTMLInputElement>(null);

  const uploadOrderPhoto = async (file: File) => {
    if (!selectedOrder) return;
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo too large", { description: "Keep it under 2.5 MB (JPEG, PNG or WebP)" });
      return;
    }
    if ((selectedOrder.photos || []).length >= MAX_ORDER_PHOTOS) {
      toast.error(`Photo limit reached`, { description: `Max ${MAX_ORDER_PHOTOS} photos per order` });
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await readPhotoFile(file);
      await api.post(`/api/orders/${selectedOrder.id}/photo`, { photo_data: dataUrl });
      toast.success("Photo uploaded");
      refetchOrders();
    } catch (err: any) {
      toast.error("Failed to upload photo", { description: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleOrderPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadOrderPhoto(file);
  };

  const submitIssue = async () => {
    if (!issueFor) return;
    setSubmittingIssue(true);
    try {
      const stageLabel = ORDER_STAGE_FLOW[issueFor.currentStageIndex]?.label || issueFor.status;
      const description = [
        `Order ${issueFor.code}`,
        `Stage: ${stageLabel}`,
        issueNote.trim(),
      ].filter(Boolean).join("\n");
      await api.post("/api/support/tickets", {
        subject: `Order ${issueFor.code} — ${issueType}`,
        description,
        priority: "medium",
        photos: issuePhoto ? [issuePhoto] : [],
      });
      toast.success("Issue reported to support");
      setIssueFor(null);
      setIssueType("Damage");
      setIssueNote("");
      setIssuePhoto(null);
    } catch (err: any) {
      toast.error("Failed to report issue", { description: err.message });
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleIssuePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo too large", { description: "Keep it under 2.5 MB (JPEG, PNG or WebP)" });
      return;
    }
    try {
      setIssuePhoto(await readPhotoFile(file));
    } catch {
      toast.error("Could not read the photo");
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="p-4 shadow-soft">
        <h3 className="font-semibold mb-3">In Processing</h3>
        <ScrollArea className="h-[600px] -mx-2 px-2">
          <div className="space-y-2">
            {processingOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-all",
                  selectedOrder?.id === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{o.code}</p>
                  {o.express && <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600">Express</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground">{o.customerName}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground">Stage {o.currentStageIndex + 1}/18:</span>
                  <span className="text-[10px] font-medium text-primary">{ORDER_STAGE_FLOW[o.currentStageIndex]?.label}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${((o.currentStageIndex + 1) / 18) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <div className="lg:col-span-2">
        {selectedOrder && (
          <Card className="p-5 shadow-soft">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedOrder.code}</h3>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerName} · {selectedOrder.garmentCount} items</p>
              </div>
              <Badge variant="secondary">{ORDER_STAGE_FLOW[selectedOrder.currentStageIndex]?.label}</Badge>
            </div>

            <OrderTimeline order={selectedOrder} />

            <Separator className="my-5" />

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={async () => {
                  const idx = ORDER_STAGE_FLOW.findIndex(s => s.stage === selectedOrder.status);
                  const nextStage = ORDER_STAGE_FLOW[idx + 1];
                  if (!nextStage) return;
                  try {
                    await api.patch(`/api/orders/${selectedOrder.id}`, { status: nextStage.stage, currentStageIndex: idx + 1 });
                    toast.success(`Stage updated to ${nextStage.label}`, { description: "Customer notified." });
                  } catch (e: any) { toast.error("Update failed", { description: e.message }); }
                }}
              >
                <ArrowUpRight className="h-4 w-4 mr-1.5" />
                Advance to next stage
              </Button>
              <input
                ref={photoInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={handleOrderPhotoChange}
              />
              <Button variant="outline" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1.5" />
                {uploadingPhoto ? "Uploading…" : "Upload photo"}
              </Button>
              <Button variant="outline" onClick={() => setIssueFor(selectedOrder)}>
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Report issue
              </Button>
            </div>

            {(selectedOrder.photos || []).length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Photos ({(selectedOrder.photos || []).length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {(selectedOrder.photos || []).map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => window.open(photo, "_blank")}
                      className="h-16 w-16 overflow-hidden rounded-lg border hover:ring-2 ring-primary transition-all"
                      title="Open photo"
                    >
                      <img src={photo} alt={`Order photo ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
              <div className="space-y-1.5">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded-lg bg-muted/40 p-2">
                    <ServiceIcon serviceKey={item.serviceKey} className="h-4 w-4 text-primary" />
                    <span className="flex-1">{item.serviceName}</span>
                    <span className="text-muted-foreground">{item.qty} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Report issue dialog */}
      <Dialog open={!!issueFor} onOpenChange={(open) => { if (!open) { setIssueFor(null); setIssuePhoto(null); setIssueNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Issue — {issueFor?.code}</DialogTitle>
            <DialogDescription>
              This creates a support ticket for the admin team{issueFor ? ` (current stage: ${ORDER_STAGE_FLOW[issueFor.currentStageIndex]?.label})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Issue type</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ISSUE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setIssueType(t)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-all",
                      issueType === t ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Details</Label>
              <Textarea
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                rows={3}
                className="mt-1.5 text-sm"
                placeholder="Describe the issue…"
              />
            </div>
            <div>
              <Label className="text-xs">Photo (optional)</Label>
              <input
                ref={issuePhotoRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={handleIssuePhotoChange}
              />
              {issuePhoto ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <img src={issuePhoto} alt="Attached" className="h-14 w-14 rounded-lg border object-cover" />
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIssuePhoto(null)}>
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs mt-1.5" onClick={() => issuePhotoRef.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                  Attach photo
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueFor(null)}>Cancel</Button>
            <Button onClick={submitIssue} disabled={submittingIssue || !issueType}>
              {submittingIssue ? "Submitting…" : "Report issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}