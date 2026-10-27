import { Suspense } from "react";
import { LibraryRecording } from "@/components/library-recording";
export const metadata={title:"Transcript · CalMasta"};
export default async function RecordingPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense fallback={<p>Loading recording…</p>}><LibraryRecording key={id} id={id}/></Suspense>;}
