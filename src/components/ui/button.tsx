import Link from "next/link";
import { dashboardPath } from "@/lib/app-routes";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Heights sit on the 4px grid: 32 / 36 / 44. Buttons press in slightly and lift on hover so they feel alive.
const BASE = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100";
const SIZES: Record<Size, string> = {
  sm: "min-h-8 px-3 text-sm",
  md: "min-h-9 px-4 text-sm",
  lg: "min-h-11 px-5 text-base",
};
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-solid text-on-accent shadow-sm hover:-translate-y-px hover:shadow-md hover:brightness-95 active:brightness-90",
  secondary: "border border-border bg-background shadow-sm hover:-translate-y-px hover:bg-surface hover:shadow-md active:bg-surface",
  ghost: "text-muted hover:bg-surface hover:text-foreground",
  danger: "bg-danger-solid text-white shadow-sm hover:-translate-y-px hover:shadow-md hover:brightness-95 active:brightness-90",
};

export const buttonClass = (variant: Variant = "secondary", extra = "", size: Size = "md") => `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${extra}`;

export function Button({ variant = "secondary", size = "md", className = "", type = "button", ...props }: React.ComponentPropsWithRef<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, className, size)} {...props} />;
}

export function ButtonLink({ href, variant = "secondary", size = "md", className = "", children }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode }) {
  return (
    <Link href={dashboardPath(href)} className={buttonClass(variant, className, size)}>
      {children}
    </Link>
  );
}
