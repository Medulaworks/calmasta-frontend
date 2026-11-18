import { redirect } from "next/navigation";

/** Payment problems now live on the Payments page. This keeps old links working. */
export default function Page() {
  redirect("/admin/money");
}
