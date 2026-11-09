import { SkeletonPage } from "@/components/ui/skeleton";

// Shown the instant you move between screens, before the next one is ready: the shape of a page, never a spinner.
export default function Loading() {
  return <SkeletonPage label="Loading" />;
}
