# AI Business Briefing & Intelligence Publisher

파편화된 공시자료·계약서(PDF), 재무제표(Excel), 관련 뉴스(URL)를 업로드하면 **4단계 Multi-Agent
파이프라인**이 원문 근거 기반의 C-Level용 5분 브리핑을 자동 생성하는 B2B SaaS MVP입니다.

## 왜 Multi-Agent인가 — 환각(Hallucination) 방지 설계

단순히 LLM에게 "요약해줘"라고 던지지 않고, 역할을 분담해 서로를 검증하게 합니다.

1. **Collector** — LLM 호출 없이 결정론적 파싱만 수행합니다. PDF/Excel/뉴스 URL을 문단·행 단위
   "소스 청크"(`id`, 위치, 원문)로 정규화합니다. ([lib/agents/collector.ts](lib/agents/collector.ts))
2. **Financial & Risk Agent** — 재무비율(부채비율·유동비율·영업이익률·ROE·ROA·매출성장률)은
   **TypeScript 계산 유틸이 직접 산출**합니다(LLM에 맡기지 않음).
   계산된 수치 + 관련 소스 청크를 Claude에 전달해 리스크 요인을 구조화된 JSON으로 추출합니다.
   ([lib/finance/ratios.ts](lib/finance/ratios.ts), [lib/agents/financialRisk.ts](lib/agents/financialRisk.ts))
3. **Fact-Checker Agent** — 2단계로 검증합니다. (1) 인용된 소스 청크 id가 실제로 존재하는지
   결정론적으로 확인하고, (2) Claude에게 "주장 vs 원문 청크"를 대조시켜 supported/
   partially_supported/unsupported를 판정받습니다. 근거 없는 주장은 최종본에서 제외됩니다.
   ([lib/agents/factChecker.ts](lib/agents/factChecker.ts))
4. **Publisher Agent** — 검증된 데이터만 다시 Claude에 전달해 3줄 요약, Risk Radar 점수(결정론적
   집계), Actionable Next Steps 3가지, 용어 툴팁(+출처)을 최종 리포트로 생성합니다.
   ([lib/agents/publisher.ts](lib/agents/publisher.ts))

각 LLM 호출은 Anthropic 도구 호출(tool use)로 JSON 스키마를 강제하고, zod로 검증합니다.
검증 실패 시 1회 재시도합니다. ([lib/claude.ts](lib/claude.ts))

## 실행 방법

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev
```

`http://localhost:3000` 접속 후 PDF/Excel 파일이나 뉴스 URL을 업로드하고 "브리핑 생성하기"를
누르면 4단계 파이프라인 진행 상황이 실시간으로 표시됩니다(NDJSON 스트리밍).

### 샘플 데이터로 테스트

`sample_data/financial_sample.xlsx`에 유동비율이 낮고(88.9%) 부채비율이 높은(233%) 샘플 재무제표가
들어 있습니다. 이 파일만 업로드해도 재무비율 계산 → 리스크 도출 → 팩트체크 → 퍼블리시 전체
파이프라인을 확인할 수 있습니다. (재생성: `node scripts/generate-sample-excel.mjs`)

## 프로젝트 구조

```
app/page.tsx              업로드 UI + 결과 렌더링
app/api/analyze/route.ts  파이프라인 오케스트레이션, NDJSON 스트리밍
lib/types.ts               공유 타입 + zod 스키마
lib/claude.ts               Anthropic 구조화 출력 헬퍼 (tool use + zod 검증 + 재시도)
lib/parsers/                pdf.ts / excel.ts / news.ts / chunk.ts / url-guard.ts(SSRF 가드)
lib/finance/ratios.ts       결정론적 재무비율 계산
lib/agents/                 collector / financialRisk / factChecker / publisher
components/                 업로드 UI, 파이프라인 진행 표시, 리포트 뷰(용어 툴팁·출처 하이라이팅 포함)
```

## 알려진 한계 (MVP 범위)

- **영속화 없음**: 현재 리포트는 클라이언트 세션에만 존재하며 새로고침하면 사라집니다. 아래
  "다음 단계"에 Supabase 연동 설계를 정리했습니다.
- **인증 없음**: 단일 사용자 데모 기준입니다.
- **재무 라벨 인식**: 엑셀에서 매출액/영업이익/당기순이익/자산총계/부채총계/자본총계/유동자산/
  유동부채 등 한글·영문 표준 라벨만 인식합니다 (`lib/finance/ratios.ts`의 `KNOWN_LINE_ITEMS`).

## 다음 단계: Supabase 연동 설계 (미구현)

Supabase 프로젝트 생성 후 아래 스키마로 영속화를 추가할 수 있도록 설계했습니다.

```sql
-- 사용자당 여러 리포트
create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  headline text not null,
  report_json jsonb not null,      -- lib/types.ts의 Report 전체를 그대로 저장
  created_at timestamptz default now()
);

-- 원문 소스 파일 메타데이터 (실제 파일은 Supabase Storage 버킷에 저장)
create table sources (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  label text not null,
  type text check (type in ('pdf', 'excel', 'news')),
  storage_path text  -- Storage 버킷 경로 (뉴스 URL인 경우 null)
);

alter table reports enable row level security;
create policy "사용자는 본인 리포트만" on reports
  for all using (auth.uid() = user_id);
```

연동 시 변경 지점: `app/api/analyze/route.ts`에서 파이프라인 완료 후 `reports` 테이블에 insert,
업로드 파일은 파싱 전에 Storage에 먼저 업로드. 프런트는 리포트 목록/상세 페이지를 추가.
