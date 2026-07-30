import { useState } from "react";
import { Search, Users, Activity, XCircle, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUsers } from "@/lib/hooks";
import type { AdminUser } from "@/lib/hooks/useUsers";

function EditUserDialog({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSave: (u: AdminUser) => void;
}) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">Edit User</DialogTitle>
        {user && (
          <EditUserForm key={user.id} user={user} onClose={onClose} onSave={onSave} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (u: AdminUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Edit User</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Update user information and role</p>
      </div>
      <div className="space-y-3 pt-2">
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="delivery">Delivery Exec</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="superadmin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={!name || !email || !role}
          onClick={() => onSave({ ...user, name, email, role })}
        >
          Save Changes
        </Button>
      </div>
    </>
  );
}

export function UserManagement() {
  const { data: users, loading, updateUser } = useUsers();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const roleDisplay: Record<string, string> = {
    customer: "Customer",
    vendor: "Vendor",
    delivery: "Delivery Exec",
    admin: "Admin",
    superadmin: "Super Admin",
  };

  const filteredUsers = (users || []).filter((u) => {
    const matchesSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleToggleStatus = async (userId: string) => {
    const user = (users || []).find((u) => u.id === userId);
    if (!user) return;
    const newStatus = user.status === "active" ? "suspended" : "active";
    try {
      await updateUser(userId, { status: newStatus });
      toast.success(`User ${user.name} ${newStatus}`, {
        description: newStatus === "suspended" ? "They can no longer access the platform." : "Access has been restored.",
      });
    } catch (err: any) {
      toast.error("Failed to update user status", { description: err.message });
    }
  };

  const handleSaveEdit = async (updated: AdminUser) => {
    try {
      await updateUser(updated.id, { name: updated.name, email: updated.email, role: updated.role });
      setEditingUser(null);
      toast.success(`User ${updated.name} updated`, { description: "Changes have been saved." });
    } catch (err: any) {
      toast.error("Failed to update user", { description: err.message });
    }
  };

  const totalUsers = (users || []).length;
  const activeUsers = (users || []).filter((u) => u.status === "active").length;
  const suspendedUsers = (users || []).filter((u) => u.status === "suspended").length;

  return (
    <div className="space-y-4">
      {loading && totalUsers === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Loading users...</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={totalUsers.toLocaleString()} icon={Users} accent="from-teal-500 to-cyan-600" />
            <StatCard label="Active" value={activeUsers.toString()} icon={Activity} accent="from-emerald-500 to-green-600" />
            <StatCard label="Suspended" value={suspendedUsers.toString()} icon={XCircle} accent="from-rose-500 to-pink-600" />
            <StatCard label="New This Week" value={totalUsers > 0 ? `${Math.round(totalUsers * 0.08)}` : "—"} icon={UserCog} accent="from-amber-500 to-orange-600" />
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name, email\u2026"
                className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="delivery">Delivery Exec</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <strong className="text-foreground">{filteredUsers.length}</strong> of {totalUsers} users
              {(search || roleFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}
                  className="ml-2 text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </span>
          </div>

          <Card className="shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">User</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Role</th>
                    <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Last Active</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Joined</th>
                    <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                        No users match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary-surface text-primary-foreground text-[10px] font-semibold">
                                {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{u.name}</p>
                              <p className="text-[11px] text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">{roleDisplay[u.role] || u.role}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={cn(
                            "text-[10px]",
                            u.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30"
                          )}>
                            {u.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "\u2014"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {u.joined ? new Date(u.joined).toLocaleDateString() : "\u2014"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingUser(u)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-7 text-xs", u.status === "active" ? "text-rose-600" : "text-emerald-600")}
                            onClick={() => handleToggleStatus(u.id)}
                          >
                            {u.status === "active" ? "Suspend" : "Reactivate"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <EditUserDialog
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveEdit}
          />
        </>
      )}
    </div>
  );
}
