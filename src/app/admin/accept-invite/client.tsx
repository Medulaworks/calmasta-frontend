"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminPost } from "@/lib/admin-client";

export default function AcceptInviteClient({ initialToken }: { initialToken: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Remove token from URL without logging it
    if (initialToken) window.history.replaceState(null, "", "/admin/accept-invite");
  }, [initialToken]);

  async function accept() {
    if (!/^[a-f0-9]{64}$/.test(initialToken)) { setStatus("error"); setMessage("Invalid invitation link."); return; }
    setStatus("loading");
    try {
      const res = await adminPost<{ state: string; role: string }>("/api/admin/staff/invites/accept", { token: initialToken });
      setStatus("success");
      setMessage(`Accepted as ${res.role}.`);
      setTimeout(() => router.replace("/admin"), 1200);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Invalid or expired invite.");
    }
  }

  if (!initialToken) return <Card><div className="p-5 text-sm">No invitation token.</div></Card>;
  return (
    <Card>
      <div className="space-y-4 p-5 text-sm">
        <h1 className="text-lg font-semibold">Accept staff invitation</h1>
        <p className="text-muted">Sign in with the invited verified email, then accept.</p>
        {status === "success" ? <p className="text-success">{message}</p> : status === "error" ? <p role="alert" className="text-danger">{message}</p> : null}
        <Button onClick={accept} disabled={status === "loading"}>{status === "loading" ? "Accepting…" : "Accept invite"}</Button>
      </div>
    </Card>
  );
}
