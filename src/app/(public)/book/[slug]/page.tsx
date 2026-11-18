import { Suspense } from "react";
import { SkeletonGuest } from "@/components/ui/skeleton";
import { PublicBooking } from "@/components/booking/public-booking";

export const metadata = { title: "Book a time · Joobah" };

async function Booking(props: PageProps<"/book/[slug]">) {
  const { slug } = await props.params;
  return <PublicBooking slug={slug} />;
}

export default function BookPage(props: PageProps<"/book/[slug]">) {
  return (
    <Suspense
      fallback={
        <SkeletonGuest label="Loading" />
      }>
      <Booking {...props} />
    </Suspense>
  );
}
