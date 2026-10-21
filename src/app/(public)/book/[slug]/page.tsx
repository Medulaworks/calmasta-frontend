import { Suspense } from "react";
import { PublicBooking } from "@/components/booking/public-booking";

export const metadata = { title: "Book a time · CalMasta" };

async function Booking(props: PageProps<"/book/[slug]">) {
  const { slug } = await props.params;
  return <PublicBooking slug={slug} />;
}

export default function BookPage(props: PageProps<"/book/[slug]">) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-muted">Loading…</p>}>
      <Booking {...props} />
    </Suspense>
  );
}
