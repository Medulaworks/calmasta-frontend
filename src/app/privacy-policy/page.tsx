import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";

export const metadata: Metadata = {
  title: "Privacy policy · Jooba",
  description: "Placeholder for Jooba’s privacy policy.",
  robots: { index: false, follow: false },
};

const sections = [
  ["Information we collect", "The final policy will describe how account information, recordings, transcripts, documents and connected-calendar information are handled."],
  ["How information is used", "Details about processing conversations, providing account features and supporting the service will be added here."],
  ["Service providers and sharing", "Details about service providers, information sharing and international processing will be added here."],
  ["Storage and retention", "Storage locations, retention periods and deletion practices will be described in the final policy."],
  ["Your choices", "Information about access, corrections, deletion and privacy requests will be added here."],
  ["Contact", "Privacy contact details will be added when the final policy is published."],
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Brand size={32} />
          <Link href="/auth/login" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            Back to sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          Draft placeholder
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Privacy policy</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          This page is a placeholder for Jooba’s privacy policy. It is not the final policy and does not describe verified data-handling practices.
        </p>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {sections.map(([title, description]) => (
            <section key={title} className="py-7">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted">{description}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
