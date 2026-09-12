import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components / Route Handlers. Create a new one
 * per request — never share across requests. Cookie writes from a Server
 * Component are a no-op (Next.js forbids it there); `proxy.ts` is what keeps
 * the session refreshed in that case.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
