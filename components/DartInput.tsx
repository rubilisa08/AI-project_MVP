"use client";

export interface DartForm {
  company: string;
  year: number;
  report: "q1" | "half" | "q3" | "annual";
  fsDiv: "CFS" | "OFS";
}

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

const REPORT_OPTIONS: { value: DartForm["report"]; label: string }[] = [
  { value: "annual", label: "사업보고서(연간)" },
  { value: "half", label: "반기보고서" },
  { value: "q3", label: "3분기보고서" },
  { value: "q1", label: "1분기보고서" },
];

const fieldClass =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900";

export function DartInput({ value, onChange }: { value: DartForm; onChange: (next: DartForm) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={value.company}
        onChange={(e) => onChange({ ...value, company: e.target.value })}
        placeholder="회사명 또는 종목코드 (예: 삼성전자, 005930)"
        className={`w-full ${fieldClass}`}
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className={fieldClass}
          aria-label="사업연도"
        >
          {YEARS.map((year) => (
            <option key={year} value={year}>
              {year}년
            </option>
          ))}
        </select>
        <select
          value={value.report}
          onChange={(e) => onChange({ ...value, report: e.target.value as DartForm["report"] })}
          className={fieldClass}
          aria-label="보고서 종류"
        >
          {REPORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={value.fsDiv}
          onChange={(e) => onChange({ ...value, fsDiv: e.target.value as DartForm["fsDiv"] })}
          className={fieldClass}
          aria-label="연결/별도"
        >
          <option value="CFS">연결 재무제표</option>
          <option value="OFS">별도 재무제표</option>
        </select>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        회사명을 입력하면 OpenDART에서 재무제표를 바로 가져옵니다 (파일 업로드 불필요).
      </p>
    </div>
  );
}
