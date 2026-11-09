import { Suspense } from "react";
import { SkeletonDetail } from "@/components/ui/skeleton";
import { LibraryRecording } from "@/components/library-recording";

export const metadata = { title: "Transcript · Jooba" };

async function Detail(props: PageProps<"/dashboard/library/recordings/[id]">) {
  const { id } = await props.params;
  return <LibraryRecording key={id} id={id} />;
}

export default function RecordingPage(props: PageProps<"/dashboard/library/recordings/[id]">) {
  return (
    <Suspense fallback={<SkeletonDetail label="Loading this recording" />}>
      <Detail {...props} />
    </Suspense>
  );
}
