import { isValidElement, type ReactElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { ApiError } from "@/lib/upload-client";
import { ResourceBoundary, type Resource } from "./ui";

type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const childMarker = "stale-cards-marker";
function resource(overrides: Partial<Resource<string>>): Resource<string> {
  return { data: null, loading: false, fetching: false, error: null, reload: vi.fn(), ...overrides };
}
function render(res: Resource<string>) {
  return elements(ResourceBoundary({ resource: res, children: (d) => <p>{`${childMarker}:${d}`}</p> }));
}

it("keeps the last good screen quietly while refreshing after activation", () => {
  const tree = render(resource({ data: "profiles", fetching: true }));
  const text = JSON.stringify(tree);
  expect(text).toContain(childMarker);
  expect(text).not.toContain("Couldn’t load this");
  expect(tree.some((e) => e.props.role === "status")).toBe(false);
});

it("keeps stale data with an inline retry when a refresh fails mid-restart", () => {
  const reload = vi.fn();
  const tree = render(resource({ data: "profiles", error: new ApiError(503, "We could not check your sign-in. Please try again."), reload }));
  const text = JSON.stringify(tree);
  expect(text).toContain(childMarker);
  expect(text).not.toContain("Couldn’t load this");
  expect(text).toContain("last saved status");
  const retry = tree.find((e) => e.props.children === "Try again");
  expect(retry).toBeDefined();
  (retry!.props.onClick as () => void)();
  expect(reload).toHaveBeenCalledOnce();
});

it("still shows the full-page error when there is nothing to keep", () => {
  const tree = render(resource({ error: new ApiError(503, "We could not check your sign-in. Please try again.") }));
  const text = JSON.stringify(tree);
  expect(text).not.toContain(childMarker);
  expect(text).toContain("Couldn’t load this");
});

it("still replaces stale data when access is revoked", () => {
  const tree = render(resource({ data: "profiles", error: new ApiError(403, "Forbidden") }));
  const text = JSON.stringify(tree);
  expect(text).not.toContain(childMarker);
  expect(text).toContain("You don’t have access to this.");
});

it("keeps one stable wrapper while refreshing so open dialogs are never remounted", () => {
  const kids = (d: string) => <p>{`${childMarker}:${d}`}</p>;
  for (const res of [resource({ data: "profiles" }), resource({ data: "profiles", fetching: true }), resource({ data: "profiles", error: new ApiError(503, "Boom") })]) {
    const out = ResourceBoundary({ resource: res, children: kids });
    expect(isValidElement(out) && out.type).toBe("div");
  }
});
