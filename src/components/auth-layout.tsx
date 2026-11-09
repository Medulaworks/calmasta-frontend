import type { ReactNode } from "react";
import { AuthShowcase } from "@/components/auth-showcase";
import { Brand } from "@/components/ui/brand";

/** Shared presentation for the sign-in and email verification screens: the form on the left, a product story on the right. */
export function AuthLayout({ children, aside, header }: { children: ReactNode; aside?: ReactNode; header?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-2">
      <main className="relative flex flex-col overflow-x-hidden px-6 py-[clamp(1rem,3vh,2.5rem)] sm:px-14 lg:overflow-y-auto lg:px-16 xl:px-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-accent-solid/10 blur-3xl" />
        <div className="relative mx-auto my-auto w-full max-w-[28rem]">
          <div className="mb-[clamp(1rem,3.5vh,2rem)] text-2xl"><Brand size={40} /></div>
          {header}
          {children}
        </div>
      </main>
      {aside ?? <AuthShowcase />}
    </div>
  );
}
