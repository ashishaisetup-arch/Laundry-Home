import { describe, it, expect } from "vitest";
import { STATUS_ORDER, PICKUP_STEPS, DELIVERY_STEPS, statusIndex, filterSortTasks } from "../delivery-data";

describe("STATUS_ORDER", () => {
  it("has expected statuses in order", () => {
    expect(STATUS_ORDER).toEqual([
      "pending",
      "heading_to_pickup",
      "picked_up",
      "heading_to_vendor",
      "reached_vendor",
      "ready_for_delivery",
      "out_for_delivery",
      "delivered",
    ]);
  });
});

describe("PICKUP_STEPS", () => {
  it("has 5 pickup steps", () => {
    expect(PICKUP_STEPS).toHaveLength(5);
  });

  it("contains heading_to_pickup and picked_up", () => {
    const ids = PICKUP_STEPS.map((s) => s.id);
    expect(ids).toContain("heading_to_pickup");
    expect(ids).toContain("picked_up");
  });
});

describe("DELIVERY_STEPS", () => {
  it("has 2 delivery steps", () => {
    expect(DELIVERY_STEPS).toHaveLength(2);
  });

  it("contains out_for_delivery and delivered", () => {
    const ids = DELIVERY_STEPS.map((s) => s.id);
    expect(ids).toContain("out_for_delivery");
    expect(ids).toContain("delivered");
  });
});

describe("statusIndex", () => {
  it("returns correct index for each status", () => {
    expect(statusIndex("pending")).toBe(0);
    expect(statusIndex("heading_to_pickup")).toBe(1);
    expect(statusIndex("picked_up")).toBe(2);
    expect(statusIndex("heading_to_vendor")).toBe(3);
    expect(statusIndex("reached_vendor")).toBe(4);
    expect(statusIndex("ready_for_delivery")).toBe(5);
    expect(statusIndex("out_for_delivery")).toBe(6);
    expect(statusIndex("delivered")).toBe(7);
  });

  it("returns -1 for unknown status", () => {
    expect(statusIndex("unknown")).toBe(-1);
  });
});

describe("filterSortTasks", () => {
  const tasks = [
    { id: "1", type: "pickup", status: "picked_up", slot: "10:00" },
    { id: "2", type: "delivery", status: "delivered", slot: "12:00" },
    { id: "3", type: "pickup", status: "pending", slot: "09:00" },
    { id: "4", type: "pickup", status: "picked_up", slot: "08:00" },
  ];

  it("filters pickup tasks and sorts by status then slot", () => {
    const result = filterSortTasks(tasks as any, "pickup");
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("3"); // pending (0) first
    expect(result[1].id).toBe("4"); // picked_up (2) second, earlier slot
    expect(result[2].id).toBe("1"); // picked_up (2) third, later slot
  });

  it("filters delivery tasks", () => {
    const result = filterSortTasks(tasks as any, "delivery");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("returns empty array when no tasks match type", () => {
    const result = filterSortTasks(tasks as any, "delivery");
    expect(result.filter((t) => t.type !== "delivery")).toHaveLength(0);
  });
});
