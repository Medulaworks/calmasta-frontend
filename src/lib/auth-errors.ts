export type AuthErrorCode = "login_expired" | "access_denied" | "idp_error" | "invalid_response" | "no_email" | "email_unverified" | "not_configured";

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  login_expired: "Your sign-in took too long or was started in a different browser. Please try again.",
  access_denied: "Sign-in was cancelled.",
  idp_error: "The sign-in service reported a problem. Please try again.",
  invalid_response: "We couldn't verify your sign-in. Please try again.",
  no_email: "Your account has no email address, so we can't sign you in.",
  email_unverified: "Please verify your email address with your sign-in provider, then try again.",
  not_configured: "Sign-in isn't set up yet.",
};

export const authErrorMessage = (code: string | null | undefined): string | null =>
  code ? (AUTH_ERROR_MESSAGES as Record<string, string>)[code] ?? "Something went wrong signing you in. Please try again." : null;
