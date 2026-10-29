"use client";
import { useQuery } from "@tanstack/react-query";
import { capturePolicyQuery } from "@/lib/queries";
export function useCapturePolicy() {
  const { data, error, isLoading } = useQuery(capturePolicyQuery);
  return {
    policy: data ?? null,
    policyError: error instanceof Error ? error.message : error ? String(error) : null,
    isLoading,
  };
}
