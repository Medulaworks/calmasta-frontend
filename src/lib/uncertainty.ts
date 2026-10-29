/**
 * Phrases the document writer uses when something was not said in the conversation. They are shown highlighted
 * so a reader can tell "unknown" from "nothing to report": MyJooba leaves a gap rather than guessing.
 */
export const UNCERTAIN =
  /\b(not specified|not stated|not mentioned|to be confirmed|tbc|questions? to confirm)\b/gi;

export const countUncertain = (text: string) =>
  (text.match(UNCERTAIN) ?? []).length;
