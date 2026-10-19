import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-solid text-white hover:opacity-90",
  secondary: "border border-border bg-background hover:bg-surface",
  ghost: "text-muted hover:bg-surface hover:text-foreground",
  danger: "bg-danger-solid text-white hover:opacity-90",
};

export const buttonClass = (variant: Variant = "secondary", extra = "") => `${BASE} ${VARIANTS[variant]} ${extra}`;

export function Button({ variant = "secondary", className = "", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ href, variant = "secondary", className = "", children }: { href: string; variant?: Variant; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
