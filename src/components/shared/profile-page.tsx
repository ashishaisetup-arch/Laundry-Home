import { motion } from "framer-motion";
import { User, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";

export function ProfilePage() {
  const { userName, userEmail, role } = useAppStore();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <Card className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary-surface text-primary-foreground text-xl font-semibold">
              {userName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="text-center md:text-left">
            <h2 className="text-xl font-semibold">{userName}</h2>
            <Badge variant="secondary" className="mt-1 capitalize">{role}</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Account Details</h3>
        <div className="space-y-4">
          {[
            { icon: Mail, label: "Email", value: userEmail || "—" },
            { icon: User, label: "Role", value: role ? role.charAt(0).toUpperCase() + role.slice(1) : "—" },
            { icon: Calendar, label: "Member since", value: "2024" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tonal shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
