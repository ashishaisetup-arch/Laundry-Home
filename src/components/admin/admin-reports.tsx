import { motion } from "framer-motion";
import { FileText, FileSpreadsheet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useReports } from "@/lib/hooks";
import { toast } from "sonner";

export function AdminReports() {
  const { data: reportData } = useReports();
  const r = reportData || { reports: [], scheduled: [] };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {r.reports.map((rep) => (
          <motion.div key={rep.id} whileHover={{ y: -2 }}>
            <Card className="p-5 shadow-soft hover:shadow-lift transition-shadow cursor-pointer">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br bg-primary text-white mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm">{rep.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rep.type}</p>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-border/60">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => toast.success(`${rep.name} exported`, { description: "Downloaded as PDF." })}>
                  <FileText className="h-3 w-3 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => toast.success(`${rep.name} exported`, { description: "Downloaded as Excel." })}>
                  <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => toast.success(`${rep.name} exported`, { description: "Downloaded as CSV." })}>
                  CSV
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Scheduled Reports</h3>
        <div className="space-y-2">
          {r.scheduled.map((sr) => (
            <div key={sr.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{sr.report?.name || "Scheduled Report"}</p>
                <p className="text-[11px] text-muted-foreground">{sr.schedule} · {(sr.recipients || []).length} recipients</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info("Editing scheduled report")}>Edit</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
