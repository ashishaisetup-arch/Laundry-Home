import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { DeliveryTask } from "@/lib/types";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export function OtpDialog({ task, open, onOpenChange }: { task: DeliveryTask; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [inputOtp, setInputOtp] = useState("");
  const [verified, setVerified] = useState(task.otpVerified || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setOtp(null);
      setInputOtp("");
      setVerified(task.otpVerified || false);
    }
  }, [open, task.otpVerified]);

  const generateOtp = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ otp: string; masked: string }>(`/api/delivery-tasks/${task.id}/otp`);
      setOtp(data.masked);
      toast.success("OTP generated");
    } catch (e: any) {
      toast.error("Failed to generate OTP", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!inputOtp) { toast.error("Enter the OTP"); return; }
    setLoading(true);
    try {
      const data = await api.post<{ verified: boolean }>(`/api/delivery-tasks/${task.id}/verify-otp`, { otp: inputOtp });
      if (data.verified) {
        setVerified(true);
        toast.success("OTP verified");
      }
    } catch (e: any) {
      toast.error("Invalid OTP", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Customer OTP</DialogTitle>
          <DialogDescription>Verify identity before completing delivery</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {verified ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">OTP Verified</span>
            </div>
          ) : otp ? (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Generated OTP</p>
                <p className="text-3xl font-bold tracking-widest">{otp}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Enter OTP from customer</p>
                <Input
                  placeholder="Enter 4-digit OTP"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="text-center text-lg tracking-widest"
                />
                <Button className="w-full" onClick={verifyOtp} disabled={loading || inputOtp.length !== 4}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Generate a one-time password for the customer to provide at delivery.</p>
              <Button className="w-full" onClick={generateOtp} disabled={loading}>
                {loading ? "Generating..." : "Generate OTP"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
