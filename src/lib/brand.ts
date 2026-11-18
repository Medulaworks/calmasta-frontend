// The product is called Joobah. The server's capture settings may still name the meeting assistant after an older name
// ("CalMasta Notetaker", "MyJooba Notetaker" or "Jooba Notetaker"), so the app shows, and sends, the Joobah spelling of that default.

const OLD_NAME = /calmasta|myjooba|jooba(?!h)/gi;

/** "CalMasta Notetaker" -> "Joobah Notetaker". Leaves any other name alone. */
export const brandText = (text: string): string => text.replace(OLD_NAME, "Joobah");

/** The assistant name to show and to send when the person leaves the field empty. Null means "let the server choose". */
export function defaultBotName(serverDefault: string | null | undefined): string | null {
  const name = serverDefault?.trim();
  return name && /calmasta|myjooba|jooba(?!h)/i.test(name) ? brandText(name) : null;
}
