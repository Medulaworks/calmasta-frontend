// Remembers, on this device, that the person has opened their first result, so the "your first result is ready" prompt
// goes away and the checklist can tick "See what came back".

const KEY = "jooba:result-seen";

export function resultSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markResultSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private window: the prompt may show again, which is harmless */
  }
}
