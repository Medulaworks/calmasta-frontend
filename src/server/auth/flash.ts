import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "../../lib/auth-errors";
import { cookie, readCookie } from "./security";

const errorCookie = "calmasta_auth_error";

export function authErrorRedirect(error: AuthErrorCode, secure: boolean) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/auth/login",
      "Cache-Control": "no-store",
      "Set-Cookie": cookie(errorCookie, error, secure, 60),
    },
  });
}

export function consumeAuthError(request: Request, secure: boolean) {
  const value = readCookie(request, errorCookie);
  const error = value && Object.hasOwn(AUTH_ERROR_MESSAGES, value) ? value : null;
  return Response.json({ error }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": cookie(errorCookie, "", secure, 0),
    },
  });
}
