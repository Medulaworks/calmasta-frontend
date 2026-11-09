import Link from "next/link";
import { Brand } from "@/components/ui/brand";

export const metadata = {
  title: "Account deleted · Jooba",
  robots: { index: false, follow: false },
};

export default function DeletedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-lg">
        <Brand size={40} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Your account has been deleted
      </h1>
      <p className="mt-3 text-sm text-muted">
        Your recordings, transcripts, documents, bookings and settings have been
        removed, and you&rsquo;ve been signed out.
      </p>
      <p className="mt-3 text-sm text-muted">
        If you ever want to come back, you&rsquo;re welcome to sign up again. It
        will be a fresh start.
      </p>
      <Link
        href="/auth/login"
        className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50 mt-6 w-fit">
        Back to sign in
      </Link>
    </main>
  );
}
