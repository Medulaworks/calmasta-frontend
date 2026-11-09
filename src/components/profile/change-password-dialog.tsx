"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const field = "mt-1 w-full min-h-10 rounded-xl border border-border bg-background px-4 py-2 text-sm";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password !== confirm) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(
          res.status === 401
            ? "Please sign in again."
            : data.error === "use_password_recovery"
              ? "Use Forgot password on the sign-in page to set a password."
              : data.error === "invalid_current_password"
                ? "Your current password is incorrect."
                : "This request could not be completed. Please try again.",
        );
      } else {
        setDone(true);
        setCurrent("");
        setPassword("");
        setConfirm("");
        setMessage("Your password was updated. Please sign in again.");
      }
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Change password" onClose={onClose}>
      {done ? (
        <div className="space-y-4 text-sm" role="status">
          <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-success">{message}</p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium">Current password</span>
            <input
              className={field}
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">New password</span>
            <input
              className={field}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Confirm new password</span>
            <input
              className={field}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          {message && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {message}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Please wait…" : "Update password"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
