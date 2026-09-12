import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import type { Report } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function ReportDetailPage(props: PageProps<"/reports/[id]">) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("reports")
    .select("report_json")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const report = data.report_json as Report;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <Link href="/reports" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← 내 리포트 목록
      </Link>
      <ReportView report={report} />
    </div>
  );
}
