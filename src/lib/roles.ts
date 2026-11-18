// Who Joobah is for at launch (blueprint §2.1). Regulated fields such as healthcare and legal are
// deliberately not offered yet: they need consent, retention and access controls we haven't built.

export const ROLES = [
  {
    id: "consultant",
    label: "Consultant / adviser",
    template: "consultant_brief",
  },
  { id: "founder", label: "Founder / operator", template: "project_brief" },
  {
    id: "sales",
    label: "Sales / customer success",
    template: "summary_and_actions",
  },
  { id: "coach", label: "Coach / trainer", template: "summary_and_actions" },
  { id: "student", label: "Student / researcher", template: "clean_notes" },
  { id: "other", label: "Something else", template: "clean_notes" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const isRole = (v: unknown): v is RoleId =>
  ROLES.some((r) => r.id === v);

/** The template a user of this role most likely wants; used only to pre-select the picker. */
export const defaultTemplateFor = (role: string | null | undefined): string =>
  ROLES.find((r) => r.id === role)?.template ?? "summary_and_actions";
