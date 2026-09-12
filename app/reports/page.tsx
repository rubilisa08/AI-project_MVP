import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, headline, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">내 리포트</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}로 저장된 브리핑 목록입니다.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          리포트를 불러오지 못했습니다: {error.message}
        </p>
      )}

      {reports && reports.length === 0 && (
        <p className="text-sm text-zinc-500">
          아직 저장된 리포트가 없습니다.{" "}
          <Link href="/" className="text-indigo-600 hover:underline dark:text-indigo-400">
            브리핑 생성하러 가기
          </Link>
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {reports?.map((r) => (
          <li key={r.id}>
            <Link
              href={`/reports/${r.id}`}
              className="block rounded-xl border border-zinc-200 p-4 transition-colors hover:border-indigo-400 dark:border-zinc-800"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.headline}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date(r.created_at).toLocaleString("ko-KR")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
