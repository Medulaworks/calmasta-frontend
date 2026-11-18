import { isValidElement, type ReactElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (value: unknown) => [value, vi.fn()] }));
vi.mock("@/components/ui/toast", () => ({ useToasts: () => ({ items: [], dismiss: vi.fn() }), ToastStack: () => null }));
vi.mock("./ui", async original => ({ ...await original<typeof import("./ui")>(), useResource: () => ({ reload: vi.fn() }) }));
import { OverviewView } from "./overview-view";
import { Metric } from "./ui";
import { PeriodPicker } from "./period-picker";
import { formatMinutes } from "@/lib/status";
type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
it("shows the API meeting total and explains environment versus shared totals", () => {
  const boundary = OverviewView() as ReactElement<{ children: (data: unknown) => ReactNode }>;
  const tree = elements(boundary.props.children({ users: 1, workspaces: 2, activeCaptures: 1, activeUsers: 1,
    environment: "staging", jobs: [], meetings: { total: 5, failed: 2 }, minutes: 120,
    cost: { settledMicros: "2500000", reservedMicros: "1000000" } }));
  const metric = (label: string) => tree.find(e => e.type === Metric && e.props.label === label)?.props;
  expect(metric("Meetings")?.value).toBe("5");
  expect(metric("Meetings")?.hint).toBe("2 didn’t finish");
  expect(metric("Hours processed")?.value).toBe(formatMinutes(120));
  expect(metric("Processing cost")?.value).toBe("$2.50");
  expect(metric("Paid subscribers")?.value).toBe("–");
  expect(metric("Recordings")?.value).toBe("–");
  const content = JSON.stringify(tree);
  expect(content).toContain("staging");
  expect(content).toContain("Accounts, usage and spend cover this whole database");
  expect(content).toContain("All time");
  expect(tree.some(e => e.type === PeriodPicker)).toBe(false);
});
