import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderCard } from "@/components/shared/order-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Order } from "@/lib/types";

export function CustomerOrders({
  activeOrders,
  completedOrders,
  onTrack,
  onCancel,
}: {
  activeOrders: Order[];
  completedOrders: Order[];
  onTrack: (id: string) => void;
  onCancel?: (orderId: string) => void;
}) {
  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">
          Active <Badge variant="secondary" className="ml-1.5 text-[10px]">{activeOrders.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="completed">
          Completed <Badge variant="secondary" className="ml-1.5 text-[10px]">{completedOrders.length}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-4">
        {activeOrders.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {activeOrders.map((o) => (
              <OrderCard key={o.id} order={o} onClick={() => onTrack(o.id)} onCancel={onCancel} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Package} title="No active orders" description="Your in-progress orders will appear here" />
        )}
      </TabsContent>
      <TabsContent value="completed" className="mt-4">
        {completedOrders.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {completedOrders.map((o) => (
              <OrderCard key={o.id} order={o} onClick={() => onTrack(o.id)} onCancel={onCancel} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Package} title="No completed orders" description="Completed orders will appear here" />
        )}
      </TabsContent>
    </Tabs>
  );
}
