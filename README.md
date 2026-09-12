# AI Business Briefing & Intelligence Publisher

파편화된 공시자료·계약서(PDF), 재무제표(Excel), 관련 뉴스(URL)를 업로드하면 **4단계 Multi-Agent
파이프라인**이 원문 근거 기반의 C-Level용 5분 브리핑을 자동 생성하는 B2B SaaS MVP입니다.

> 📄 제품 요구사항과 실제 구현 현황 비교는 [PRD.md](PRD.md)를 참고하세요.

## 왜 Multi-Agent인가 — 환각(Hallucination) 방지 설계

단순히 LLM에게 "요약해줘"라고 던지지 않고, 역할을 분담해 서로를 검증하게 합니다.

1. **Collector** — LLM 호출 없이 결정론적 파싱만 수행합니다. PDF/Excel/뉴스 URL을 문단·행 단위
   "소스 청크"(`id`, 위치, 원문)로 정규화합니다. PDF는 텍스트 청크 추출과 별도로, Claude가
   **Code Execution Tool + pdfplumber**로 PDF 안의 재무제표 표 자체를 찾아 페이지 번호까지 인용
   근거로 남기며 라인아이템으로 추출합니다 — Excel 없이 PDF만 올려도 재무비율 계산이 가능합니다
   (`ANTHROPIC_API_KEY` 필요, 실패 시 조용히 텍스트 청크만 사용). PDF는 파일 업로드뿐 아니라
   **다른 탭의 링크를 드롭존에 끌어다 놓아도** 됩니다 — 서버가 URL을 받아 응답의 Content-Type이
   `application/pdf`면 업로드한 PDF와 동일하게 처리합니다(DART 사업보고서 링크 등).
   ([lib/agents/collector.ts](lib/agents/collector.ts), [lib/agents/pdfTableExtractor.ts](lib/agents/pdfTableExtractor.ts), [lib/parsers/news.ts](lib/parsers/news.ts))
2. **Financial & Risk Agent** — 재무비율(부채비율·유동비율·당좌비율·영업이익률·매출총이익률·ROE·
   ROA·이자보상배율·매출성장률) 9종을 **두 개의 독립된 결정론적 엔진**으로 각각 계산해 교차검증합니다:
   (1) TypeScript 계산 유틸, (2) Claude의 **Code Execution Tool**로 실제 pandas 코드를 작성·실행시킨
   결과. LLM은 어느 계산에도 암산으로 관여하지 않으며, 두 값이 일치할 때만 화면에 검증 배지가 뜨고
   실행된 코드와 stdout을 그대로 펼쳐볼 수 있습니다. 같은 계산 안에서 **회계 항등식(자산총계 = 부채
   총계 + 자본총계)**도 함께 검증하고, 전기 대비 ±300%를 넘는 이상 변동은 별도로 경고합니다 — 숫자가
   맞는지뿐 아니라 원본 데이터 자체가 말이 되는지까지 확인합니다. 계산된 수치 + 관련 소스 청크를
   Claude에 전달해 리스크 요인을 구조화된 JSON으로 추출합니다.
   ([lib/finance/ratios.ts](lib/finance/ratios.ts), [lib/agents/pythonRatioEngine.ts](lib/agents/pythonRatioEngine.ts), [lib/agents/financialRisk.ts](lib/agents/financialRisk.ts))
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
cp .env.example .env.local   # ANTHROPIC_API_KEY, Supabase URL/anon key 입력
npm run dev
```

Supabase는 프로젝트를 만든 뒤 대시보드의 **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql)을
한 번 실행하고, **Settings → API**에서 Project URL과 anon(publishable) key를 `.env.local`에 넣으면 됩니다.
service_role 키는 이 앱에서 쓰지 않습니다.

`http://localhost:3000` 접속 후 PDF/Excel 파일이나 뉴스 URL을 업로드하고 "브리핑 생성하기"를
누르면 4단계 파이프라인 진행 상황이 실시간으로 표시됩니다(NDJSON 스트리밍). 로그인(매직 링크)하면
생성된 리포트를 저장하고 `/reports`에서 다시 볼 수 있습니다 — 로그인 없이도 브리핑 생성 자체는
그대로 체험할 수 있습니다.

### API 키 없이 먼저 확인하기 (Mock 모드)

`.env.local`에 `MOCK_LLM=true`를 설정하면 Claude API를 호출하지 않고, 각 에이전트가
재무비율 임계값 기반의 목업 응답을 반환합니다. 파이프라인 구조·스트리밍 진행률·리포트 UI를
비용 없이 먼저 확인하고 싶을 때 사용하세요 (`ANTHROPIC_API_KEY`는 비워둬도 됩니다).
실제 Claude 분석 품질을 확인하려면 `MOCK_LLM=false`로 바꾸고 키를 넣으세요.

### 샘플 데이터로 테스트

`sample_data/financial_sample.xlsx`에 유동비율이 낮고(88.9%) 부채비율이 높은(233%) 샘플 재무제표가
들어 있습니다. 이 파일만 업로드해도 재무비율 계산 → 리스크 도출 → 팩트체크 → 퍼블리시 전체
파이프라인을 확인할 수 있습니다. (재생성: `node scripts/generate-sample-excel.mjs`)

`sample_data/financial_sample.pdf`는 같은 숫자를 표 형태로 담은 PDF본으로, PDF 재무제표 표 추출
기능(`lib/agents/pdfTableExtractor.ts`)을 테스트하기 위한 것입니다. **이 기능은 `MOCK_LLM=false` +
실제 `ANTHROPIC_API_KEY`가 있어야만 동작합니다** — Files API 업로드와 Code Execution을 실제로
호출하기 때문에 오프라인 목업으로는 의미가 없습니다. MOCK_LLM=true에서 PDF만 올리면 텍스트 청크는
생기지만 재무비율은 계산되지 않습니다(Excel과 동시 업로드하거나 실제 키로 테스트하세요).
(재생성: `pip install reportlab && python scripts/generate_sample_financial_pdf.py`, Windows의
맑은 고딕 폰트를 사용합니다 — 다른 OS는 스크립트 상단의 폰트 경로를 수정하세요.)

## 프로젝트 구조

```
app/page.tsx              업로드 UI + 결과 렌더링
app/api/analyze/route.ts  파이프라인 오케스트레이션, NDJSON 스트리밍
app/login/page.tsx        매직 링크 로그인
app/auth/confirm/route.ts 매직 링크 콜백 (세션 확립)
app/reports/              내 리포트 목록/상세 (Supabase 조회, RLS로 본인 것만)
proxy.ts                  매 요청마다 Supabase 세션 쿠키 갱신 (Next 16의 middleware 개칭)
lib/types.ts               공유 타입 + zod 스키마
lib/claude.ts               Anthropic 구조화 출력 헬퍼 (tool use + zod 검증 + 재시도)
lib/parsers/                pdf.ts / excel.ts / news.ts / chunk.ts / url-guard.ts(SSRF 가드)
lib/finance/ratios.ts       결정론적 재무비율 계산(TypeScript) + 회계 정합성/이상치 검증
lib/agents/pythonRatioEngine.ts  Code Execution Tool로 pandas 재무비율 이중 계산
lib/agents/pdfTableExtractor.ts  Code Execution Tool + pdfplumber로 PDF 표에서 라인아이템 추출
lib/roi.ts                  ROI(처리 시간 절감) 계산 헬퍼
lib/agents/                 collector / financialRisk / factChecker / publisher
lib/supabase/               client.ts(브라우저) / server.ts(서버 컴포넌트·라우트)
components/                 업로드 UI, 파이프라인 진행 표시, 리포트 뷰(재무 현황 스냅샷·이중 계산
                             검증 배지·ROI 배너·용어 툴팁·출처 하이라이팅·인쇄 대응 포함)
supabase/schema.sql         reports 테이블 + RLS 정책 (SQL Editor에서 1회 실행)
```

## Supabase 연동

- **저장**: 리포트 생성 후 로그인 상태면 "리포트 저장" 버튼으로 `reports` 테이블에 저장합니다
  (`report_json`에 [lib/types.ts](lib/types.ts)의 `Report` 전체를 그대로 저장 — 별도 `sources`
  테이블 없이 상세 페이지를 그대로 복원).
- **인증**: 비밀번호 없는 매직 링크(이메일 OTP)만 지원합니다.
- **RLS**: `reports`는 `auth.uid() = user_id` 정책으로 본인 행만 select/insert/delete 가능하고,
  리포트는 수정하지 않는 스냅샷으로 취급해 update 정책은 없습니다. anon key는 노출돼도 안전하지만
  service_role 키는 이 앱 어디에도 사용하지 않습니다.

## 알려진 한계 (MVP 범위)

- **원본 파일 미보관**: 생성된 리포트(JSON)는 저장되지만, 업로드한 PDF/Excel 원본은 Storage에
  저장하지 않습니다 — 파싱 후 버려집니다.
- **재무 라벨 인식**: 엑셀에서 매출액/영업이익/당기순이익/자산총계/부채총계/자본총계/유동자산/
  유동부채/매출원가/재고자산/이자비용 등 한글·영문 표준 라벨만 인식합니다
  (`lib/finance/ratios.ts`의 `KNOWN_LINE_ITEMS`).
- **리포트 공유 없음**: 저장된 리포트는 본인만 볼 수 있고, 팀 공유/코멘트 기능은 아직 없습니다.
- **Code Execution Tool 비용**: 월 1,550시간 무료 제공 후 시간당 $0.05가 과금됩니다. MOCK_LLM=true
  에서는 실제 API를 호출하지 않고 동일한 UI를 무료로 확인할 수 있습니다.
- **PDF 업로드마다 추가 API 호출**: PDF를 올릴 때마다 재무제표 표가 있는지 확인하기 위해 Files API
  업로드 + Code Execution 호출이 1회 발생합니다(재무제표가 아닌 PDF여도 마찬가지). 지연시간과
  비용이 조금 늘어나는 대신 Excel 없이도 PDF만으로 재무비율을 계산할 수 있습니다.
- **DART 자동 연동 없음**: 기업명을 입력하면 DART 사업보고서를 자동으로 가져오는 기능은 아직
  없습니다 — 사용자가 PDF/Excel 파일을 직접 업로드해야 합니다.
