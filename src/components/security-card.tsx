"use client";

import { KeyRound, Laptop, LogOut } from "lucide-react";
import { useState } from "react";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/auth-client";

/** Sign-in and security: change the password and sign out. It lives in Settings; the profile page is for reading. */
export function SecurityCard() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  return (
    <Card>
      <CardHeader title="Sign-in and security" />
      <ul className="divide-y divide-border text-sm">
        <li className="flex flex-wrap items-center gap-4 px-5 py-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><KeyRound className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Password</p>
            <p className="mt-1 text-muted">Changing it signs out your other sessions. If you signed in with Google, use Forgot password on the sign-in page to set one.</p>
          </div>
          <Button variant="secondary" onClick={() => setShowChangePassword(true)}>Change password</Button>
        </li>
        <li className="flex flex-wrap items-center gap-4 px-5 py-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><Laptop className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">This device</p>
            <p className="mt-1 text-muted">Signing out of all devices is temporarily unavailable. You can still sign out here.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" disabled title="Temporarily unavailable">Sign out everywhere</Button>
            <Button onClick={() => void signOut()}><LogOut aria-hidden className="size-4" /> Sign out</Button>
          </div>
        </li>
      </ul>
      {showChangePassword && <ChangePasswordDialog onClose={() => setShowChangePassword(false)} />}
    </Card>
  );
}
