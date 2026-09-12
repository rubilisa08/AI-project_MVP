"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }
    setStatus("sent");
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-24">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">로그인</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          이메일로 받은 링크를 클릭하면 로그인됩니다. 비밀번호는 필요 없습니다.
        </p>
      </div>

      {status === "sent" ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {email}로 로그인 링크를 보냈습니다. 메일함을 확인해주세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            {status === "sending" ? "전송 중..." : "로그인 링크 보내기"}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
