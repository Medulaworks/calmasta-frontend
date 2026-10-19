import { redirect } from "next/navigation";

// The app has no public landing page yet: the dashboard is home.
export default function Home() {
  redirect("/dashboard");
}
