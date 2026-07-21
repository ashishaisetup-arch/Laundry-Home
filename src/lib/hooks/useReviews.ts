import type { Review } from "@/lib/types";
import { useFetch } from "./use-fetch";

export function useReviews() {
  return useFetch<Review[]>("/api/reviews");
}
