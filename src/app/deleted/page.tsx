import Link from "next/link";

export const metadata = { title: "Account deleted · CalMasta", robots: { index: false, follow: false } };

export default function DeletedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <span aria-hidden className="mb-6 grid h-9 w-9 place-items-center rounded-lg bg-accent-solid text-base font-bold text-white">C</span>
      <h1 className="text-2xl font-semibold tracking-tight">Your account has been deleted</h1>
      <p className="mt-3 text-sm text-muted">Your recordings, transcripts, documents, bookings and settings have been removed, and you&rsquo;ve been signed out.</p>
      <p className="mt-3 text-sm text-muted">If you ever want to come back, you&rsquo;re welcome to sign up again. It will be a fresh start.</p>
      <Link href="/login" className="mt-6 inline-flex w-fit items-center rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90">
        Back to sign in
      </Link>
    </main>
  );
}
