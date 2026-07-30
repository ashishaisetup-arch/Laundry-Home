import { getRouteProvider } from "./map-provider";

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  type: "pickup" | "delivery" | "vendor";
}

interface OptimizedRoute {
  stops: RouteStop[];
  totalDistanceKm: number;
  totalDurationMins: number;
  legDetails: { from: string; to: string; distanceKm: number; durationMins: number }[];
}

export class RouteOptimizer {
  /**
   * Optimize the order of stops for minimum travel time using
   * nearest-neighbor heuristic + 2-opt refinement.
   */
  async optimize(stops: RouteStop[]): Promise<OptimizedRoute> {
    if (stops.length <= 2) {
      const total = await this.getRouteMetrics(stops);
      return {
        stops,
        totalDistanceKm: total.distanceKm,
        totalDurationMins: total.durationMins,
        legDetails: [],
      };
    }

    const provider = getRouteProvider();

    // Build distance matrix
    const matrix = await provider.getDistanceMatrix({
      origins: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      destinations: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
    });

    if (!matrix || !matrix.rows) {
      // Fallback: return original order
      const total = await this.getRouteMetrics(stops);
      return {
        stops,
        totalDistanceKm: total.distanceKm,
        totalDurationMins: total.durationMins,
        legDetails: [],
      };
    }

    // Extract duration matrix (use duration in minutes)
    const n = stops.length;
    const durationMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const distanceMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const element = matrix.rows?.[i]?.elements?.[j];
        durationMatrix[i][j] = element?.durationMins ?? Infinity;
        distanceMatrix[i][j] = element?.distanceKm ?? Infinity;
      }
    }

    // Greedy nearest-neighbor starting from first stop
    const visited = new Set<number>([0]);
    const order = [0];
    let current = 0;

    while (visited.size < n) {
      let bestNext = -1;
      let bestDuration = Infinity;
      for (let i = 0; i < n; i++) {
        if (!visited.has(i) && durationMatrix[current][i] < bestDuration) {
          bestDuration = durationMatrix[current][i];
          bestNext = i;
        }
      }
      if (bestNext === -1) break;
      visited.add(bestNext);
      order.push(bestNext);
      current = bestNext;
    }

    // 2-opt refinement: swap pairs to reduce total duration
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 1; i < order.length - 2; i++) {
        for (let j = i + 1; j < order.length - 1; j++) {
          const currentDuration = this.pathDuration(order, durationMatrix);
          const newOrder = this.twoOptSwap(order, i, j);
          const newDuration = this.pathDuration(newOrder, durationMatrix);
          if (newDuration < currentDuration) {
            order.length = 0;
            order.push(...newOrder);
            improved = true;
          }
        }
      }
    }

    const optimizedStops = order.map((i) => stops[i]);

    // Calculate total metrics for the optimized route
    let totalDistanceKm = 0;
    let totalDurationMins = 0;
    const legDetails: OptimizedRoute["legDetails"] = [];

    for (let i = 0; i < optimizedStops.length - 1; i++) {
      const fromIdx = order[i];
      const toIdx = order[i + 1];
      const d = distanceMatrix[fromIdx][toIdx] || 0;
      const dur = durationMatrix[fromIdx][toIdx] || 0;
      totalDistanceKm += d;
      totalDurationMins += dur;
      legDetails.push({
        from: optimizedStops[i].label || optimizedStops[i].id,
        to: optimizedStops[i + 1].label || optimizedStops[i + 1].id,
        distanceKm: Math.round(d * 10) / 10,
        durationMins: Math.round(dur),
      });
    }

    return {
      stops: optimizedStops,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMins: Math.round(totalDurationMins),
      legDetails,
    };
  }

  private pathDuration(order: number[], matrix: number[][]): number {
    let total = 0;
    for (let i = 0; i < order.length - 1; i++) {
      total += matrix[order[i]][order[i + 1]] || 0;
    }
    return total;
  }

  private twoOptSwap(order: number[], i: number, j: number): number[] {
    const newOrder = order.slice(0, i);
    const reversed = order.slice(i, j + 1).reverse();
    newOrder.push(...reversed);
    newOrder.push(...order.slice(j + 1));
    return newOrder;
  }

  private async getRouteMetrics(stops: RouteStop[]): Promise<{ distanceKm: number; durationMins: number }> {
    if (stops.length < 2) return { distanceKm: 0, durationMins: 0 };
    const provider = getRouteProvider();
    let totalDistanceKm = 0;
    let totalDurationMins = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const result = await provider.getRoute({
        origin: { lat: stops[i].lat, lng: stops[i].lng },
        destination: { lat: stops[i + 1].lat, lng: stops[i + 1].lng },
      });
      if (result) {
        totalDistanceKm += result.distanceKm;
        totalDurationMins += result.durationMins;
      }
    }
    return { distanceKm: Math.round(totalDistanceKm * 10) / 10, durationMins: Math.round(totalDurationMins) };
  }
}

export const routeOptimizer = new RouteOptimizer();
