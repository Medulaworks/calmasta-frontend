import { useSyncExternalStore } from "react";
import { SIDEBAR_KEY } from "./theme-boot";

// Whether the side navigation is the full panel or a narrow icon rail. A personal choice kept in this browser. The
// layout itself follows the data-sidebar attribute on <html> (set before first paint by the boot script), so there is
// no flash; this hook only lets a button show which way it will go.

const EVENT = "mojooba:sidebar-changed";
const read = () => (document.documentElement.dataset.sidebar === "collapsed" ? "collapsed" : "expanded");

export function setSidebarCollapsed(collapsed: boolean) {
  document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    /* private window: it lasts until the page is closed */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, () => read() === "collapsed", () => false);
}
