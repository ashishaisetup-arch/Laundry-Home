"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Package,
  Shield,
  Store,
  Upload,
  User,
  Zap,
  Star,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VendorOnboardingProps {
  open: boolean;
  onClose: () => void;
}

type Step = "business" | "kyc" | "services" | "review" | "submitted";

const SERVICES_OPTIONS = [
  { key: "wash_fold", name: "Wash & Fold", basePrice: 60, unit: "kg" },
  { key: "wash_iron", name: "Wash & Iron", basePrice: 15, unit: "piece" },
  { key: "dry_cleaning", name: "Dry Cleaning", basePrice: 120, unit: "piece" },
  { key: "steam_ironing", name: "Steam Ironing", basePrice: 18, unit: "piece" },
  { key: "premium_care", name: "Premium Garment Care", basePrice: 250, unit: "piece" },
  { key: "delicate_care", name: "Delicate Fabric Care", basePrice: 180, unit: "piece" },
  { key: "shoe_cleaning", name: "Shoe Cleaning", basePrice: 149, unit: "piece" },
  { key: "blanket", name: "Blanket Cleaning", basePrice: 199, unit: "piece" },
  { key: "bulk", name: "Bulk Laundry", basePrice: 45, unit: "kg" },
];

const KYC_DOCS = [
  { id: "gst", label: "GST Certificate", required: true, desc: "Business tax registration" },
  { id: "pan", label: "PAN Card", required: true, desc: "Business or proprietor PAN" },
  { id: "aadhaar", label: "Aadhaar Card", required: true, desc: "Proprietor identity proof" },
  { id: "license", label: "Shop & Establishment License", required: true, desc: "Local business license" },
  { id: "photo", label: "Shop Front Photo", required: true, desc: "Clear photo of storefront" },
  { id: "bank", label: "Bank Account Details", required: true, desc: "Cancelled cheque or bank statement" },
  { id: "insurance", label: "Liability Insurance", required: false, desc: "Optional but recommended" },
];

export function VendorOnboarding({ open, onClose }: VendorOnboardingProps) {
  const [step, setStep] = useState<Step>("business");

  // Business info
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [description, setDescription] = useState("");

  // KYC
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [kycStatus, setKycStatus] = useState<"pending" | "verified">("pending");

  // Services
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [serviceRadius, setServiceRadius] = useState("5");
  const [commissionRate, setCommissionRate] = useState("10");
  const [minOrderValue, setMinOrderValue] = useState("150");

  const steps: { id: Step; label: string; icon: typeof Building2 }[] = [
    { id: "business", label: "Business Info", icon: Building2 },
    { id: "kyc", label: "KYC Documents", icon: Shield },
    { id: "services", label: "Services", icon: Package },
    { id: "review", label: "Review", icon: Check },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  const reset = () => {
    setStep("business");
    setBusinessName("");
    setOwnerName("");
    setEmail("");
    setPhone("");
    setCity("");
    setArea("");
    setAddress("");
    setPincode("");
    setDescription("");
    setUploadedDocs({});
    setKycStatus("pending");
    setSelectedServices({});
    setServiceRadius("5");
    setCommissionRate("10");
    setMinOrderValue("150");
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const requiredDocsUploaded = KYC_DOCS.filter((d) => d.required).every((d) => uploadedDocs[d.id]);
  const selectedServiceCount = Object.values(selectedServices).filter(Boolean).length;

  const canProceed = () => {
    if (step === "business") {
      return businessName && ownerName && email && phone.length === 10 && city && area && address && pincode.length === 6;
    }
    if (step === "kyc") return requiredDocsUploaded;
    if (step === "services") return selectedServiceCount > 0;
    return true;
  };

  const handleNext = () => {
    if (step === "business") setStep("kyc");
    else if (step === "kyc") {
      setKycStatus("verified");
      setStep("services");
    } else if (step === "services") setStep("review");
    else if (step === "review") {
      setStep("submitted");
      toast.success("Vendor onboarded successfully!", {
        description: `${businessName} has been added and is now live on the platform.`,
      });
    }
  };

  const handleBack = () => {
    if (step === "kyc") setStep("business");
    else if (step === "services") setStep("kyc");
    else if (step === "review") setStep("services");
  };

  const toggleDoc = (docId: string) => {
    setUploadedDocs((prev) => ({ ...prev, [docId]: !prev[docId] }));
    if (!uploadedDocs[docId]) {
      toast.success("Document uploaded", { description: `${KYC_DOCS.find((d) => d.id === docId)?.label} verified.` });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Onboard New Vendor</DialogTitle>
        <AnimatePresence mode="wait">
          {step === "submitted" ? (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lift mb-4"
              >
                <CheckCircle2 className="h-9 w-9 text-primary-foreground" />
              </motion.div>
              <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Vendor Onboarded!
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{businessName}</span> is now live on Laundry Home.
              </p>

              <Card className="mt-5 p-4 text-left shadow-soft">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendor ID</span>
                    <span className="font-mono font-semibold">VND-2026-0128</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="font-medium">{ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">{area}, {city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Services</span>
                    <span className="font-medium">{selectedServiceCount} services</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission rate</span>
                    <span className="font-medium">{commissionRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">KYC status</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                      Verified
                    </Badge>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Welcome bonus</span>
                    <span className="text-primary">₹2,000 credit</span>
                  </div>
                </div>
              </Card>

              <p className="text-xs text-muted-foreground mt-4">
                A welcome email with login credentials has been sent to {email}.
              </p>

              <div className="flex gap-2 mt-5">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Close</Button>
                <Button className="flex-1" onClick={reset}>
                  Onboard Another
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="p-5 bg-tonal-accent">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-surface">
                    <Store className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Onboard New Vendor</p>
                    <p className="text-xs text-muted-foreground">Add a verified laundry vendor to the platform</p>
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-2">
                  {steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 flex-1">
                      <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all",
                        i < stepIndex && "bg-primary text-primary-foreground",
                        i === stepIndex && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                        i > stepIndex && "bg-background text-muted-foreground border border-border"
                      )}>
                        {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className={cn(
                        "text-xs font-medium hidden sm:inline",
                        i === stepIndex ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {s.label}
                      </span>
                      {i < steps.length - 1 && (
                        <div className={cn("flex-1 h-0.5 mx-1 rounded", i < stepIndex ? "bg-primary" : "bg-border")} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-4 min-h-[400px]">
                {/* === STEP 1: BUSINESS INFO === */}
                {step === "business" && (
                  <>
                    <div>
                      <h3 className="font-semibold">Business Information</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Tell us about the laundry business</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Business Name *</Label>
                        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. FreshFold Laundry Co." className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Owner Name *</Label>
                        <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Full name" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Phone *</Label>
                        <div className="flex gap-2 mt-1">
                          <div className="flex h-9 items-center rounded-lg border border-input bg-tonal px-3 text-sm">+91</div>
                          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98765 43210" className="flex-1" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Email *</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.com" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">City *</Label>
                        <Select value={city} onValueChange={setCity}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select city" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bengaluru">Bengaluru</SelectItem>
                            <SelectItem value="Mumbai">Mumbai</SelectItem>
                            <SelectItem value="Delhi">Delhi</SelectItem>
                            <SelectItem value="Hyderabad">Hyderabad</SelectItem>
                            <SelectItem value="Chennai">Chennai</SelectItem>
                            <SelectItem value="Pune">Pune</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Area / Locality *</Label>
                        <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Indiranagar" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Pincode *</Label>
                        <Input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="560038" className="mt-1" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Full Address *</Label>
                        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop number, street, landmark" className="mt-1 resize-none" rows={2} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Business Description (optional)</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the laundry services offered" className="mt-1 resize-none" rows={2} />
                      </div>
                    </div>
                  </>
                )}

                {/* === STEP 2: KYC DOCUMENTS === */}
                {step === "kyc" && (
                  <>
                    <div>
                      <h3 className="font-semibold">KYC Verification</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Upload required documents to verify the vendor</p>
                    </div>

                    <div className="rounded-lg bg-tonal-accent p-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-xs text-foreground/80">
                        All required documents must be uploaded and verified before the vendor can go live.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {KYC_DOCS.map((doc) => (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 transition-all",
                            uploadedDocs[doc.id] ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                            uploadedDocs[doc.id] ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40" : "bg-tonal text-muted-foreground"
                          )}>
                            {uploadedDocs[doc.id] ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium">{doc.label}</p>
                              {doc.required && <Badge variant="outline" className="text-[9px] py-0 h-4">Required</Badge>}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{doc.desc}</p>
                          </div>
                          <Button
                            variant={uploadedDocs[doc.id] ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleDoc(doc.id)}
                          >
                            {uploadedDocs[doc.id] ? (
                              <><Check className="h-3.5 w-3.5 mr-1" /> Uploaded</>
                            ) : (
                              <><Upload className="h-3.5 w-3.5 mr-1" /> Upload</>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full",
                          requiredDocsUploaded ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40" : "bg-amber-100 text-amber-600 dark:bg-amber-950/40"
                        )}>
                          {requiredDocsUploaded ? <Check className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-medium">
                            {requiredDocsUploaded ? "All required documents verified" : `${KYC_DOCS.filter((d) => d.required && !uploadedDocs[d.id]).length} required documents pending`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Click upload to simulate document verification</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        requiredDocsUploaded ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                      )}>
                        {requiredDocsUploaded ? "Ready" : "Pending"}
                      </Badge>
                    </div>
                  </>
                )}

                {/* === STEP 3: SERVICES === */}
                {step === "services" && (
                  <>
                    <div>
                      <h3 className="font-semibold">Service Configuration</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Select services offered and set operating parameters</p>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Offered Services</Label>
                      <p className="text-[11px] text-muted-foreground mb-2">Toggle the services this vendor will offer</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {SERVICES_OPTIONS.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => setSelectedServices((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all",
                              selectedServices[s.key] ? "border-primary bg-tonal-accent ring-1 ring-primary" : "border-border hover:bg-tonal"
                            )}
                          >
                            <div className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all",
                              selectedServices[s.key] ? "border-primary bg-primary" : "border-input"
                            )}>
                              {selectedServices[s.key] && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">₹{s.basePrice}/{s.unit}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Service Radius (km)</Label>
                        <Input type="number" value={serviceRadius} onChange={(e) => setServiceRadius(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Commission Rate (%)</Label>
                        <Input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Min Order Value (₹)</Label>
                        <Input type="number" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                  </>
                )}

                {/* === STEP 4: REVIEW === */}
                {step === "review" && (
                  <>
                    <div>
                      <h3 className="font-semibold">Review & Approve</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Confirm the vendor details before onboarding</p>
                    </div>

                    <div className="space-y-3">
                      <Card className="p-4 shadow-soft">
                        <div className="flex items-center gap-2 mb-3">
                          <Building2 className="h-4 w-4 text-primary" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business</p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted-foreground text-xs">Name:</span> <span className="font-medium">{businessName}</span></div>
                          <div><span className="text-muted-foreground text-xs">Owner:</span> <span className="font-medium">{ownerName}</span></div>
                          <div><span className="text-muted-foreground text-xs">Email:</span> <span className="font-medium">{email}</span></div>
                          <div><span className="text-muted-foreground text-xs">Phone:</span> <span className="font-medium">+91 {phone}</span></div>
                          <div className="sm:col-span-2"><span className="text-muted-foreground text-xs">Address:</span> <span className="font-medium">{address}, {area}, {city} - {pincode}</span></div>
                        </div>
                      </Card>

                      <Card className="p-4 shadow-soft">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="h-4 w-4 text-emerald-500" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">KYC</p>
                          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 ml-auto">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" />
                            Verified
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {KYC_DOCS.filter((d) => uploadedDocs[d.id]).length} of {KYC_DOCS.length} documents uploaded and verified
                        </p>
                      </Card>

                      <Card className="p-4 shadow-soft">
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4 text-primary" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {SERVICES_OPTIONS.filter((s) => selectedServices[s.key]).map((s) => (
                            <Badge key={s.key} variant="secondary" className="text-[10px]">{s.name}</Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Radius:</span> <span className="font-medium">{serviceRadius} km</span></div>
                          <div><span className="text-muted-foreground">Commission:</span> <span className="font-medium">{commissionRate}%</span></div>
                          <div><span className="text-muted-foreground">Min order:</span> <span className="font-medium">₹{minOrderValue}</span></div>
                        </div>
                      </Card>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 flex items-center justify-between bg-tonal/30">
                <p className="text-xs text-muted-foreground">
                  {step === "business" && "All fields marked * are required"}
                  {step === "kyc" && `${KYC_DOCS.filter((d) => d.required && !uploadedDocs[d.id]).length} required docs pending`}
                  {step === "services" && `${selectedServiceCount} services selected`}
                  {step === "review" && "Ready to onboard"}
                </p>
                <div className="flex gap-2">
                  {step !== "business" && (
                    <Button variant="outline" onClick={handleBack}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" />
                      Back
                    </Button>
                  )}
                  <Button
                    disabled={!canProceed()}
                    onClick={handleNext}
                  >
                    {step === "review" ? "Approve & Onboard" : "Continue"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
