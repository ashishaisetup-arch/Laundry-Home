"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { AuthLanding } from "@/components/auth/landing";
import { CustomerApp } from "@/components/customer/customer-app";
import { VendorApp } from "@/components/vendor/vendor-app";
import { DeliveryApp } from "@/components/delivery/delivery-app";
import { AdminApp } from "@/components/admin/admin-app";

export default function Home() {
  const { role, isAuthenticated, switchRole } = useAppStore();

  // Auto-sign in as customer on first load (so the demo starts somewhere)
  // Actually — keep the landing page as the entry. User picks role via auth modal.

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AuthLanding />
        </motion.div>
      ) : (
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {role === "customer" && <CustomerApp />}
          {role === "vendor" && <VendorApp />}
          {role === "delivery" && <DeliveryApp />}
          {(role === "admin" || role === "superadmin") && <AdminApp />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
