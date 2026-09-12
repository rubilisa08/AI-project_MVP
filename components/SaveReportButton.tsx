"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Report } from "@/lib/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveReportButton({ report }: { report: Report }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const handleSave = async () => {
    setStatus("saving");
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus("error");
      setError("로그인이 필요합니다.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("reports")
      .insert({ user_id: user.id, headline: report.headline, report_json: report })
      .select("id")
      .single();

    if (insertError) {
      setStatus("error");
      setError(insertError.message);
      return;
    }

    setSavedId(data.id);
    setStatus("saved");
  };

  if (email === undefined) return null;

  if (!email) {
    return (
      <p className="text-sm text-zinc-500">
        <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          로그인
        </Link>
        하면 이 리포트를 저장하고 나중에 다시 볼 수 있습니다.
      </p>
    );
  }

  if (status === "saved" && savedId) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-300">
        저장했습니다.{" "}
        <Link href={`/reports/${savedId}`} className="font-medium hover:underline">
          내 리포트에서 보기 →
        </Link>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
      >
        {status === "saving" ? "저장 중..." : "리포트 저장"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
