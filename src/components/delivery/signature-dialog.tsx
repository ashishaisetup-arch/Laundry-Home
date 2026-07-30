import { useState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { DeliveryTask } from "@/lib/types";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export function SignatureDialog({ task, open, onOpenChange }: { task: DeliveryTask; open: boolean; onOpenChange: (open: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saved, setSaved] = useState(!!task.signature);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSaved(!!task.signature);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
        }
      }
    }
  }, [open, task.signature]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setLoading(true);
    try {
      await api.post(`/api/delivery-tasks/${task.id}/signature`, { signature_data: dataUrl });
      setSaved(true);
      toast.success("Signature saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed to save signature", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proof of Delivery — Signature</DialogTitle>
          <DialogDescription>Ask the customer to sign below</DialogDescription>
        </DialogHeader>
        {saved ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Signature captured</span>
          </div>
        ) : (
          <div className="space-y-3">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="w-full border border-border rounded-lg cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={clearCanvas}>Clear</Button>
              <Button className="flex-1" onClick={saveSignature} disabled={loading}>
                {loading ? "Saving..." : "Accept Signature"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
