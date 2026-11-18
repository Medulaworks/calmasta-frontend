import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";

export const metadata: Metadata = {
  title: "Privacy policy · Joobah",
  description: "How Joobah handles information associated with Joobah accounts, recordings, transcripts and connected services.",
  robots: { index: false, follow: false },
};

const sections = [
  {
    id: "about", title: "Who we are and what this policy covers",
    paragraphs: [
      "Joobah is a service from Joobah that helps people capture conversations, work with transcripts and prepare documents and follow-ups. This policy describes information associated with our website, accounts, recording tools, calendar connections and booking features.",
      "If your employer or another organisation provides your workspace, that organisation may decide how meeting content is used and who can access it. Questions about a recording arranged by someone else should also be directed to the meeting organiser or workspace administrator.",
    ],
  },
  {
    id: "information", title: "Information we collect",
    paragraphs: ["The information involved depends on the features you use. It can include:"],
    bullets: [
      "Account and profile details, such as your name, email address, profession, time zone and appearance preferences. Password-based accounts use a password hash rather than storing your readable password.",
      "Account identifiers and authentication information received when you choose to sign in with Google or Microsoft. Connecting a calendar is a separate choice from signing in.",
      "Content you provide or ask Joobah to process, including audio, enabled video recordings, meeting links and titles, transcripts, speaker labels, corrections, notes, action items and generated documents.",
      "Calendar and booking information for enabled connections and scheduling features, such as event times, meeting links, availability and the contact details or notes entered by a booking guest.",
      "Technical and account activity information needed to operate the service, including session records, request times, IP addresses, browser information, usage records and diagnostic events.",
      "Information you include when you contact Joobah for support or make a privacy request.",
    ],
  },
  {
    id: "purposes", title: "How we use information",
    paragraphs: ["Information is processed to provide the features you request and support the operation of your account. This includes:"],
    bullets: [
      "Creating and authenticating accounts, verifying email addresses, recovering access and protecting sessions.",
      "Processing requested recordings, transcribing conversations and preparing the documents or action-item suggestions you choose to generate.",
      "Displaying and organising your library, saving edits and retrieving content you are permitted to access.",
      "Providing connected-calendar and booking features when you enable or use them.",
      "Sending account verification, recovery, security and service-related messages.",
      "Applying usage limits, investigating errors, preventing misuse and handling support requests.",
    ],
  },
  {
    id: "recordings", title: "Meeting recordings and participant information",
    paragraphs: [
      "A recording can contain personal information about everyone who speaks or appears in it, including people who do not have a Joobah account. Before requesting a recording, make sure you have the authority and any permissions required to record and process that conversation.",
      "The meeting assistant joins as a visible participant and remains subject to waiting rooms and host admission controls. A request to capture a meeting does not mean recording has started. Recording availability, media processing and transcript readiness are separate stages shown in the product.",
      "If you are a participant who has questions about a recording, contact the organiser who requested it. You can also contact Joobah to raise a privacy concern. We may need enough information to locate the relevant account or meeting without asking you to send the recording itself by email.",
    ],
  },
  {
    id: "ai", title: "Transcription and AI-assisted features",
    paragraphs: [
      "When you request transcription or an AI-assisted document, relevant audio, transcript text or instructions may be processed by service providers that perform that task. The information needed depends on the feature you request; connecting an account does not itself request a recording or document.",
      "Transcripts, speaker labels and generated text can contain mistakes. Review outputs before relying on them or sharing them, particularly where a conversation includes personal, confidential or professional information.",
      "Provider-specific retention and any use of content for model improvement must be confirmed in the final policy. This draft does not make a blanket promise that every provider has the same training or retention terms.",
    ],
  },
  {
    id: "sharing", title: "Service providers and other disclosures",
    paragraphs: [
      "Operating Joobah involves providers for application hosting, database and file storage, meeting capture, transcription, AI processing and email delivery. A provider may receive the information needed to perform the relevant service. Google and Microsoft also process information under their own policies when you choose to use their sign-in or connected services.",
      "Information may also be disclosed where necessary to respond to a valid legal request, protect people or the service, investigate misuse, or support a business transfer subject to applicable requirements. Workspace access and anything you independently export or share can also affect who receives your content.",
      "The final policy must confirm the production provider list, contractual arrangements and any advertising, sale or secondary-use practices. No such practices should be inferred from this draft.",
    ],
  },
  {
    id: "cookies", title: "Cookies and browser storage",
    paragraphs: [
      "Joobah uses cookies for application sessions and sign-in transactions. Browser storage is also used for interface preferences such as theme and sidebar appearance, recent searches and temporary sign-in state.",
      "Blocking essential cookies can prevent sign-in or cause a session to end. Clearing browser storage can reset saved interface preferences. You can manage cookies and site storage through your browser settings.",
      "Any optional analytics or marketing technologies, their providers and available consent choices must be confirmed before they are described as part of the final policy.",
    ],
  },
  {
    id: "security", title: "How information is protected",
    paragraphs: [
      "Joobah uses server-managed authentication, access checks and private media access to help restrict information to authorised requests. Sensitive authentication credentials are handled by the server rather than being exposed as persistent browser access-token stores.",
      "No online service can guarantee complete security. Protect your sign-in details, use trusted devices and tell Joobah if you suspect unauthorised account access. Do not include passwords, verification codes or recovery tokens in a support email.",
    ],
  },
  {
    id: "retention", title: "Retention and deletion",
    paragraphs: [
      "How long information is needed depends on its purpose, the features in use, account activity, privacy requests and applicable security or legal requirements. Active content, security records, backups and third-party processing records may have different retention arrangements.",
      "You can ask Joobah about deleting or correcting information associated with your account. Availability of an in-app control does not establish that all copies, backups or provider records are removed immediately. We may need to verify your identity and explain any information that cannot be removed at the same time.",
      "Exact retention periods, backup expiry and provider deletion timelines are still being confirmed for the final policy. This draft does not promise immediate deletion or a specific retention period.",
    ],
  },
  {
    id: "international", title: "Where information is processed",
    paragraphs: [
      "Hosting and processing providers may operate in countries other than the country where you live. The location of processing can vary by provider and feature.",
      "Joobah’s jurisdiction, production processing locations and any required international-transfer safeguards must be confirmed before this draft is published as the final policy.",
    ],
  },
  {
    id: "rights", title: "Your choices and privacy requests",
    paragraphs: [
      "You can choose whether to connect supported services, request a recording or submit content for processing. You can also review available account settings and permissions granted through your Google or Microsoft account. Disconnecting a service does not necessarily remove information already processed or stored.",
      "Depending on the law that applies to you, your rights may include access to your personal information, correction, deletion, a portable copy, restriction of processing, an objection to certain uses or withdrawal of consent where processing relies on consent. Some requests are subject to conditions or exceptions.",
      "Send privacy requests to info@myjooba.com. Describe what you would like us to review and include the email address associated with your account. We may ask for proportionate information to verify your identity. Where applicable, you may also raise a concern with the relevant data-protection authority.",
    ],
  },
  {
    id: "updates", title: "Changes to this policy",
    paragraphs: [
      "The policy may be updated as Joobah’s features, providers and operating arrangements change. The published version will show a revision date, and material changes will be communicated where required. A date on this draft is a drafting date, not confirmation that it is an approved or effective legal notice.",
    ],
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-6">
          <Brand size={32} />
          <Link href="/auth/login" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">Back to sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">Draft for review</span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Privacy policy</h1>
        <p className="mt-4 text-base leading-7 text-muted">How Joobah handles information when you use Joobah to capture conversations and turn them into useful work.</p>
        <p className="mt-3 text-sm text-muted">Draft updated <time dateTime="2026-10-31">31 October 2026</time></p>
        <aside aria-label="Draft policy notice" className="mt-6 rounded-xl border border-border bg-surface px-6 py-4 text-sm leading-6 text-muted">
          This is a working draft, not the final published policy. Business jurisdiction, production providers, retention schedules and international-transfer arrangements still need confirmation.
        </aside>
        <nav aria-label="Privacy policy contents" className="mt-8 border-y border-border py-6">
          <p className="text-sm font-semibold">In this policy</p>
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {sections.map(({ id, title }) => <li key={id}><a href={`#${id}`} className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">{title}</a></li>)}
            <li><a href="#contact" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">Contact Joobah</a></li>
          </ul>
        </nav>
        <div className="mt-4 divide-y divide-border">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8 py-7">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-7 text-muted">{paragraph}</p>)}
              {"bullets" in section && <ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-7 text-muted">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
          <section id="contact" className="scroll-mt-8 py-7">
            <h2 className="text-xl font-semibold tracking-tight">Contact Joobah</h2>
            <p className="mt-3 text-sm leading-7 text-muted">For privacy questions, account-information requests or concerns about a recording, email <a href="mailto:info@myjooba.com" className="font-medium text-foreground underline underline-offset-4">info@myjooba.com</a>. Please include enough context to identify your request without attaching confidential recordings or authentication details.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
