import type { DocumentTemplate } from "./types";

export const TEMPLATE_VERSION = "1";

export interface TemplateDefinition {
  id: DocumentTemplate;
  label: string;
  description: string;
  /** Section headings, in order. A real LLM adapter builds its prompt from these. */
  sections: string[];
}

// Missing information is never filled in: sections say "Not specified" or list open questions (blueprint §6.3).
export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "clean_notes",
    label: "Clean notes",
    description: "Organised notes that keep the original meaning.",
    sections: ["Notes"],
  },
  {
    id: "summary_and_actions",
    label: "Summary and action items",
    description: "Overview, decisions, owners, due dates and open questions.",
    sections: ["Summary", "Decisions", "Action items", "Open questions"],
  },
  {
    id: "consultant_brief",
    label: "Consultant / client brief",
    description: "Context, objective, findings, risks and recommendations.",
    sections: ["Context", "Objective", "Constraints", "Findings", "Risks", "Recommendations", "Assumptions", "Questions to confirm"],
  },
  {
    id: "project_brief",
    label: "Project / product brief",
    description: "Problem, target user, outcome, scope and next steps.",
    sections: ["Problem", "Target user", "Intended outcome", "Proposed scope", "Dependencies", "Risks", "Next steps"],
  },
  {
    id: "meeting_minutes",
    label: "Meeting minutes",
    description: "Topics, decisions, action register and next meeting.",
    sections: ["Attendees", "Topics discussed", "Decisions", "Action register", "Next meeting"],
  },
  {
    id: "follow_up_email",
    label: "Follow-up email (draft)",
    description: "A draft only. You review it before sending anything.",
    sections: ["Subject", "Message"],
  },
  {
    id: "content_draft",
    label: "Content draft",
    description: "An article outline, post or script from spoken ideas.",
    sections: ["Working title", "Outline", "Draft"],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? null;
