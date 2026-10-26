import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Heights sit on the 4px grid: 32 / 36 / 40.
const BASE = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
const SIZES: Record<Size, string> = {
  sm: "min-h-8 px-3 text-xs",
  md: "min-h-9 px-4 text-sm",
  lg: "min-h-10 px-5 text-sm",
};
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-solid text-on-accent hover:brightness-95 active:brightness-90",
  secondary: "border border-border bg-background hover:bg-surface active:bg-surface",
  ghost: "text-muted hover:bg-surface hover:text-foreground",
  danger: "bg-danger-solid text-white hover:brightness-95 active:brightness-90",
};

export const buttonClass = (variant: Variant = "secondary", extra = "", size: Size = "md") => `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${extra}`;

export function Button({ variant = "secondary", size = "md", className = "", type = "button", ...props }: React.ComponentPropsWithRef<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, className, size)} {...props} />;
}

export function ButtonLink({ href, variant = "secondary", size = "md", className = "", children }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, className, size)}>
      {children}
    </Link>
  );
}
