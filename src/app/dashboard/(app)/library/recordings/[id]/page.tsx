import { Suspense } from "react";
import { SkeletonDetail } from "@/components/ui/skeleton";
import { LibraryRecording } from "@/components/library-recording";
export const metadata={title:"Transcript · Jooba"};
export default async function RecordingPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense fallback={<SkeletonDetail label="Loading recording" />}><LibraryRecording key={id} id={id}/></Suspense>;}
