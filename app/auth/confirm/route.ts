import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing route. Supabase's default (non-custom-SMTP) email
 * templates use `{{ .ConfirmationURL }}`, which verifies the OTP at Supabase's
 * own GoTrue server and redirects back here with a PKCE `?code=` — handled by
 * `exchangeCodeForSession`. `token_hash`/`type` are also supported in case the
 * email template is ever customized (requires custom SMTP) to link here directly.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=링크가 유효하지 않거나 만료되었습니다.", origin),
  );
}
