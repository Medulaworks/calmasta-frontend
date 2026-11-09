// The product is called Jooba. The server's capture settings may still name the meeting assistant after the old name
// ("CalMasta Notetaker"), so the app shows, and sends, the Jooba spelling of that default.

/** "CalMasta Notetaker" -> "Jooba Notetaker". Leaves any other name alone. */
export const brandText = (text: string): string => text.replace(/calmasta/gi, "Jooba");

/** The assistant name to show and to send when the person leaves the field empty. Null means "let the server choose". */
export function defaultBotName(serverDefault: string | null | undefined): string | null {
  const name = serverDefault?.trim();
  return name && /calmasta/i.test(name) ? brandText(name) : null;
}
