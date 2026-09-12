# AI Business Briefing & Intelligence Publisher PRD (Product Requirement Document)

## 1. 프로젝트 개요 (Overview)

**프로젝트명**: AI Business Briefing & Intelligence Publisher

**목적**: 기업 공시(DART), 재무제표(Excel/PDF), 뉴스/리포트 등 비구조화된 비즈니스 데이터를 Multi-Agent 기반으로 수집·검증하여 C-Level 제출용 "5분 핵심 브리핑 웹 리포트"로 자동 변환하는 B2B SaaS MVP 구축.

**타깃 사용자**: 대기업/중견기업 경영기획팀, 전략기획팀, CFO/C-Level 임원.

## 2. 핵심 문제 및 해결 방안 (Problem & Solution)

**Problem**:
- 기획/재무 실무자가 수십 장의 공시·보고서를 분석해 보고서를 작성하는 데 평균 5~10시간 이상 소요됨.
- 단순 LLM 요약 서비스는 숫자 계산 오류(재무 비율) 및 환각(Hallucination) 현상으로 비즈니스 의사결정에 활용 불가.

**Solution**:
- Multi-Agent 파이프라인을 구축하여 [데이터 추출 → 파이썬 기반 재무 계산 → 원문 팩트 교차 검증 → 웹 리포트 발행] 과정 자동화.
- 단순 텍스트 요약이 아닌 가독성 높은 인터랙티브 웹 UI 콘텐츠 형태로 결과물 제공.

## 3. 멀티 에이전트 아키텍처 (Multi-Agent System Architecture)

```
[사용자 파일 업로드 / 기업명 입력]
                │
                ▼
  ┌───────────────────────────┐
  │  Collector Agent          │ ── (PDF/Excel 파싱 & Web Crawling)
  └─────────────┬─────────────┘
                │
  ┌─────────────▼─────────────┐
  │  Financial & Risk Agent   │ ── (Python Code Interpreter 기반 연산)
  └─────────────┬─────────────┘
                │
  ┌─────────────▼─────────────┐
  │  Fact-Checker Agent       │ ── (RAG 기반 원문 대조 & 교차 검증)
  └─────────────┬─────────────┘
                │
  ┌─────────────▼─────────────┐
  │  Publisher Agent          │ ── (인터랙티브 웹 리포트 JSON 생성)
  └───────────────────────────┘
```

## 4. 주요 기능 명세 (Key Features)

**Core Feature 1: Multi-format Input System**
- PDF / Excel / CSV 드롭존: DART 사업보고서, 재무제표, 증권사 리포트 파일 업로드.
- Web Link / Text Input: 관련 산업 뉴스 URL 또는 텍스트 즉시 입력.

**Core Feature 2: Multi-Agent Processing Pipeline**
- **Collector Agent**: pdfplumber / Unstructured를 활용하여 PDF 내 표(Table) 구조 유실 없이 JSON 변환.
- **Financial & Risk Agent**:
  - LLM이 직접 계산하지 않고 Python(Pandas) 도구를 호출하여 영업이익률, 부채비율, CAGR 등 정확한 수치 산출.
  - 재무/시장/운영 3대 영역의 리스크 스코어(0~100점) 산출.
- **Fact-Checker Agent**: AI가 도출한 모든 수치와 주장에 대해 원문 문서의 몇 페이지/어느 항목에 근거했는지 1:1 매핑 및 환각 검증.
- **Publisher Agent**: 시각화 카드, 차트 데이터, 용어 정리 등을 포함한 최종 웹 리포트 UI 구조화.

**Core Feature 3: Interactive Briefing Dashboard (Output UI)**
- **3-Line Executive Summary**: C-Level을 위한 초간단 3줄 서머리.
- **Risk & Opportunity Radar**: 영역별 리스크 수준(High/Medium/Low) 시각화.
- **Actionable Next Steps**: 실무자가 즉시 검토해야 할 3가지 액션 플랜 제시.
- **Interactive Terms & Source Tooltip**: 회계/산업 전문 용어 호버 시 툴팁 제공 및 클릭 시 원문 근거 팝업 출력.

## 5. 상세 기능 명세 (Detailed Functional Specification)

> 4장의 기능을 실제로 구현/검증 가능한 수준까지 구체화한 명세입니다. 값과 규칙은 현재 구현(rubilisa08/AI-project_MVP)을 기준으로 하되, 향후 기능 확장 시에도 이 기준을 그대로 따르거나 의도적으로 갱신합니다.

### 5.1 입력 처리 규칙 (Input Validation)

| 항목 | 규칙 |
|---|---|
| 지원 파일 형식 | PDF(`.pdf`), Excel/CSV(`.xlsx`, `.xls`, `.csv`) — 그 외 확장자는 파이프라인 실행 시 에러 |
| 파일당 최대 크기 | 15MB. 초과 시 요청 자체를 `413`으로 거부하고 어떤 파일이 초과했는지 파일명을 포함해 안내 |
| 파일/URL 최소 입력 | 파일 또는 URL 중 최소 1개 이상 필요. 둘 다 없으면 `400` |
| URL 형식 | `http://` 또는 `https://`만 허용. 콤마 구분 문자열 또는 JSON 배열 문자열 둘 다 파싱 가능 |
| URL 보안 검증 (SSRF 방지) | `localhost`/`0.0.0.0` 호스트명 차단, 사설 IPv4(10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16) 및 사설 IPv6(`::1`, `fc00::/7`, `fe80::/10`) 차단. 호스트명은 DNS 조회 후 **실제 확인된 IP**까지 재검증(DNS 리바인딩 방지) |
| 뉴스 페이지 fetch 제한 | 타임아웃 10초, 응답 본문 5MB 초과 시 에러 |
| 추출 결과 검증 | 모든 입력을 처리한 뒤 청크가 0건이면 "텍스트를 추출하지 못했습니다" 에러로 파이프라인 중단 |

### 5.2 Collector Agent 상세 명세

LLM을 호출하지 않는 결정론적 파싱 단계이며, 모든 출력은 인용 가능한 "소스 청크"(`SourceChunk`) 단위로 정규화됩니다.

- **PDF**: 페이지별로 텍스트를 추출한 뒤 문단 단위로 청크 분할. 위치 라벨은 `"N페이지"`.
- **Excel/CSV**: 첫 행을 기간(컬럼) 라벨로 사용하고, 각 행의 첫 열을 항목명으로 사용해 행 단위 청크 생성. 숫자는 콤마 제거·괄호 음수 표기(`(1,000)` → `-1000`)까지 파싱. 위치 라벨은 `"{시트명} 시트 {행번호}행"`.
- **뉴스 URL**: `<script>/<style>/<nav>/<footer>/<header>/<noscript>/<iframe>/<form>` 제거 후 `<article>` 우선 추출(200자 미만이면 `<body>` 전체로 대체). 문단 단위로 청크 분할, 위치 라벨은 `"본문 N문단"`.
- **청크 분할 규칙**: 문단(빈 줄 2개 이상) 단위로 나누고, 누적 길이가 700자를 넘기면 새 청크로 분리. 단일 문단이 700자를 초과하면 강제로 잘라 여러 청크로 분할.
- **재무 항목 자동 인식**: Excel 행 라벨이 아래 별칭과 공백 제거 후 완전히 일치하면 재무 라인아이템으로 등록(부분/유사 매칭 없음 — 라벨이 다르면 인식 실패):
  - `revenue`: 매출액, 매출, 수익, revenue, sales
  - `operatingIncome`: 영업이익, operating income, operating profit
  - `netIncome`: 당기순이익, 순이익, net income
  - `totalAssets`: 자산총계, 총자산, total assets
  - `totalLiabilities`: 부채총계, 총부채, total liabilities
  - `totalEquity`: 자본총계, 총자본, total equity, shareholders equity
  - `currentAssets`: 유동자산, current assets
  - `currentLiabilities`: 유동부채, current liabilities

### 5.3 Financial & Risk Agent 상세 명세

**재무비율 계산 공식** (계산에 사용된 원본 청크 id를 함께 기록해 근거 추적 가능):

| 지표 | 공식 |
|---|---|
| 부채비율 | 부채총계 ÷ 자본총계 × 100 |
| 유동비율 | 유동자산 ÷ 유동부채 × 100 |
| 당좌비율 | (유동자산 − 재고자산) ÷ 유동부채 × 100 |
| 영업이익률 | 영업이익 ÷ 매출액 × 100 |
| 매출총이익률 | (매출액 − 매출원가) ÷ 매출액 × 100 |
| ROE | 당기순이익 ÷ 자본총계 × 100 |
| ROA | 당기순이익 ÷ 총자산 × 100 |
| 이자보상배율 | 영업이익 ÷ 이자비용 |
| 매출성장률 | (최신 매출 − 직전 매출) ÷ 직전 매출 × 100 (최소 2개 기간 데이터 필요) |

**이중 계산 검증(환각 방지 핵심 장치)**: 위 9개 지표는 (1) TypeScript로 한 번, (2) Claude의 **Code Execution Tool**(`code_execution_20250825`)로 실제 pandas 코드를 작성·실행시켜 다시 한 번, 총 두 개의 독립된 결정론적 엔진으로 계산한다(`lib/finance/ratios.ts`, `lib/agents/pythonRatioEngine.ts`). LLM은 어느 쪽 계산에도 암산으로 관여하지 않는다 — TypeScript는 순수 함수, Python 쪽은 Claude가 코드를 작성하지만 최종 숫자는 실행된 코드의 stdout(JSON)을 그대로 파싱한 값이다. 두 결과가 오차범위(0.05) 내로 일치할 때만 화면에 "✓ TypeScript ↔ Python(pandas) 이중 계산 검증 완료" 배지가 표시되며, 실행된 실제 코드와 stdout을 그대로 펼쳐볼 수 있다. Python 호출이 실패(네트워크 오류, 파싱 실패 등)하면 조용히 TypeScript 값으로 폴백하고 검증 배지 없이 표시한다.

**리스크 식별 규칙**:
- 입력: 위에서 계산된 재무비율 + 원문 소스 청크만 (외부 지식/추측 금지, 시스템 프롬프트로 강제)
- 출력: 최대 8개 리스크. 각 리스크는 `category`(financial/market/operational 중 1개), `severity`(low/medium/high), `sourceChunkIds`(최소 1개, 스키마로 강제), 선택적으로 `metricRefs`(근거가 된 비율명)
- 근거가 빈약하면 리스크 개수를 줄이도록 지시(무리한 리스크 생성 방지)

**API 키 없이 검증 가능한 결정론적 목업 규칙** (`MOCK_LLM=true`):
- 유동비율 < 100% → "단기 유동성 부족" (80% 미만이면 high, 아니면 medium)
- 부채비율 > 150% → "높은 부채비율" (200% 초과 시 high, 아니면 medium)
- 영업이익률 < 5% → "낮은 영업이익률" (medium)
- 위 조건에 하나도 해당하지 않으면 "제공된 자료 범위가 제한적" (low) 1건을 기본 생성

### 5.4 Fact-Checker Agent 상세 명세 (2단계 검증)

1. **결정론적 1차 검증**: 리스크가 인용한 `sourceChunkId`가 실제 존재하는 청크 id 집합에 포함되는지 코드로 확인. 유효한 id가 하나도 없으면 LLM 호출 없이 즉시 제외(`excludedClaims`, 사유: "인용된 출처를 원문에서 찾을 수 없어 제외되었습니다.")
2. **LLM 기반 2차 검증**: 유효한 인용이 있는 리스크만 Claude에게 원문 청크와 대조시켜 판정
   - `supported`: 원문과 정확히 일치 → 그대로 채택
   - `partially_supported`: 방향은 같지만 과장/일부만 일치 → `correctedDescription`으로 설명을 원문에 맞게 교정 후 채택
   - `unsupported`: 원문에 명시되지 않은 수치/사실 → 최종본에서 자동 제외
3. 입력된 모든 claim에 대해 반드시 1개씩 verdict가 반환되도록 스키마로 강제. verdict 누락 시에도 해당 리스크는 제외 처리.

### 5.5 Publisher Agent 상세 명세

**출력 스키마 (`Report`)**:

| 필드 | 제약 |
|---|---|
| `headline` | 1~80자 |
| `executiveSummary` | 정확히 3개 문자열, 각 1~200자 |
| `nextSteps` | 정확히 3개 문자열, 각 1~200자 |
| `glossary` | 최대 8개, 각 `term`(1~40자) / `definition`(1~200자) / 선택적 `sourceChunkId` |
| `riskScores` | `{ financial, market, operational }` — 아래 산식으로 계산 |

**Risk Radar 점수 산식**: 카테고리별로 해당 카테고리에 속한 검증된 리스크 중 `severity` 점수(low=25, medium=55, high=85)의 **최댓값**을 채택. 해당 카테고리에 리스크가 없으면 기본값 15점.

**제약**: Fact-Checker를 통과한 리스크와 재무비율 범위 밖의 새로운 주장을 생성하지 않도록 시스템 프롬프트로 강제.

### 5.6 API 명세

`POST /api/analyze` (multipart/form-data)

**Request**
| 필드 | 타입 | 필수 |
|---|---|---|
| `files` | File[] | 선택 (files/urls 중 최소 1개) |
| `urls` | string (JSON 배열 또는 콤마 구분) | 선택 |

**Response**: `Content-Type: application/x-ndjson`, 스트리밍. 줄 단위 JSON 이벤트:

| 이벤트 | 필드 | 설명 |
|---|---|---|
| `stage` | `stage`, `status`("start"\|"done"), `message?` | 4단계(collector/financial_risk/fact_checker/publisher) 각각의 시작/완료 |
| `result` | `report` | 최종 `Report` 객체 (스트림의 마지막 데이터 이벤트) |
| `error` | `stage?`, `message` | 실패 시 발생 단계와 함께 전송, 스트림 종료 |

**에러 응답**: 입력 없음 → `400`, 파일 15MB 초과 → `413`.

### 5.7 화면별 요구사항 (UI Screens)

| 화면 | 경로 | 요구사항 |
|---|---|---|
| 업로드/결과 | `/` | 파일 드롭존 + URL 입력 리스트, 생성 버튼, 4단계 진행률 실시간 표시(NDJSON 스트림 기반), 완료 후 리포트 렌더링(ROI 배너 → Executive Summary → 재무 현황 스냅샷 → Risk Radar → Next Steps → 부록/출처 순), 로그인 시에만 "리포트 저장" 버튼 노출, "인쇄/PDF로 저장" 버튼으로 실무 배포용 인쇄 레이아웃 제공 |
| 로그인 | `/login` | 이메일 매직 링크 입력만 지원 (비밀번호 필드 없음) |
| 인증 콜백 | `/auth/confirm` | 매직 링크 클릭 후 세션 확립, 완료 시 홈으로 리다이렉트 |
| 리포트 목록 | `/reports` | 로그인한 본인 소유 리포트만 최신순 표시 (RLS로 강제) |
| 리포트 상세 | `/reports/[id]` | 저장된 `Report` JSON을 그대로 복원해 렌더링, 본인 소유가 아니면 접근 불가 |

### 5.8 예외/엣지 케이스 처리 요구사항

| 상황 | 처리 |
|---|---|
| 파일과 URL 모두 없음 | `400` 응답, 재요청 유도 |
| 파일 15MB 초과 | `413` 응답, 초과 파일명 명시 |
| 지원하지 않는 확장자 업로드 | 파이프라인 실행 중 `error` 이벤트로 전달, 어느 단계인지 표시 |
| 모든 소스에서 텍스트 추출 실패 | `error` 이벤트로 파이프라인 중단 |
| URL이 사설 IP/localhost로 확인됨 | 요청 이전에 차단 (SSRF 방지) |
| 뉴스 페이지가 5MB 초과 또는 10초 내 응답 없음 | `error` 이벤트로 해당 URL 처리 실패 안내 |
| 리스크가 존재하지 않는 청크 id를 인용(모델 환각) | 결정론적으로 자동 제외, LLM 호출 생략 |
| Fact-Checker가 `unsupported` 판정 | 최종본에서 자동 제외, `excludedClaims`에 사유 기록하여 투명하게 노출 |
| Claude 응답이 스키마 검증 실패 | 검증 오류 메시지를 포함해 1회 재시도, 재시도도 실패하면 파이프라인 에러로 종료 |

## 6. 기술 스택 (Technical Stack)

| 구분 | 기술 스택 | 비고 |
|---|---|---|
| Frontend | Next.js (React), Tailwind CSS, Shadcn UI | 빠른 B2B 대시보드 UI 구성 |
| Backend / DB | Supabase (PostgreSQL, Vector DB) | 사용자 인증 및 문서 임베딩 저장 |
| AI / Orchestration | LangChain / LangGraph, Claude 3.5 Sonnet & Haiku | Multi-Agent 워크플로우 제어 |
| Parsing & Tools | Python (Pandas, pdfplumber), OpenAI/Claude API | 표 파싱 및 데이터 계산 연동 |

## 7. 현재 구현 현황과의 차이 (Implementation Status vs. This PRD)

> 아래는 [rubilisa08/AI-project_MVP](https://github.com/rubilisa08/AI-project_MVP) 저장소의 실제 구현을 이 PRD와 비교한 결과입니다 (2026-09-12 기준). 4단계 Multi-Agent 아키텍처와 5장의 상세 기능 명세는 현재 구현과 거의 동일하게 맞춰졌으나, 6장 기술 스택 일부는 MVP 단계에서 더 가벼운 방식으로 대체되었습니다.

### 7.1 PRD대로 구현된 부분

| PRD 항목 | 구현 상태 | 비고 |
|---|---|---|
| 4단계 Multi-Agent 아키텍처 | ✅ | Collector → Financial&Risk → Fact-Checker → Publisher, PRD 설계 그대로 |
| PDF/Excel 드롭존, URL 입력 | ✅ | `FileDropzone`, `UrlInputList` |
| 표 구조 보존 파싱 | ✅ | PDF는 페이지 단위(`n페이지`), Excel은 행 단위로 위치 기록 |
| 재무비율(부채비율·유동비율·영업이익률·ROE·ROA·매출성장률 등 9개) | ✅ | `lib/finance/ratios.ts`. 화면에 "재무 현황 스냅샷" 카드로도 노출(`FinancialSnapshot.tsx`) |
| **Python(Pandas) 연동으로 재무비율 계산** | ✅ | 당초 PRD가 요구한 "LLM이 직접 계산하지 않고 Python 도구를 호출"을 Anthropic **Code Execution Tool**로 실제 구현. TypeScript 계산과 독립적으로 pandas 코드를 실행해 교차검증하고, 실행된 코드·stdout을 UI에서 그대로 확인 가능(`lib/agents/pythonRatioEngine.ts`, `RatioVerificationBadge.tsx`) — 자세한 내용은 5.3 |
| 재무/시장/운영 3대 리스크 스코어 | ✅ | `RiskRadarScores { financial, market, operational }` |
| 원문 근거 1:1 매핑 및 환각 검증 | ✅ (오히려 더 엄격) | 청크 id 실존 여부를 코드로 먼저 확인 후, Claude가 주장 vs 원문을 대조해 supported/partially_supported/unsupported 판정. 근거 없는 주장은 최종본에서 제외 |
| 3줄 Executive Summary / Next Steps 3가지 | ✅ | zod 스키마로 정확히 3개 강제 |
| 용어 툴팁 + 원문 근거 팝업 | ✅ | `TermTooltip.tsx` |

### 7.2 기술 스택이 다르게 구현된 부분

| PRD 명시 | 실제 구현 | 차이 |
|---|---|---|
| LangChain / LangGraph | 없음 — `app/api/analyze/route.ts`에서 함수 호출 순서로 직접 오케스트레이션 | 별도 프레임워크 없이 커스텀 파이프라인 |
| Claude 3.5 Sonnet & Haiku (모델 티어링) | 단일 모델(`CLAUDE_MODEL` 환경변수, 기본값 `claude-sonnet-5`)만 사용 | 비용 절감용 Haiku 이원화 전략 미적용 |
| Supabase (PostgreSQL, Vector DB) | Supabase Postgres만 사용 (reports 테이블 + RLS) | 벡터DB/임베딩 저장 없음 → Fact-Checker는 RAG 검색이 아니라 청크 id 직접 대조 방식 |
| Shadcn UI | 순수 Tailwind CSS 커스텀 컴포넌트 | Shadcn 라이브러리 미사용 |
| DART 사업보고서 자동 수집 / 기업명 입력 | 미구현 | 기업명 입력 → 자동 크롤링 없음. 사용자가 직접 파일/URL을 업로드하는 방식만 지원 |

### 7.3 PRD에 없던 추가 구현 사항

- **Supabase Auth (매직 링크 로그인) + 리포트 저장/재조회** (`/reports` 목록·상세 페이지) — 로그인 시 생성된 리포트를 저장하고 다시 볼 수 있음
- **MOCK_LLM 모드** — API 키 없이 재무비율 임계값 기반 목업 응답으로 전체 파이프라인/UI를 무료로 검증 가능
- **SSRF 가드** (`lib/parsers/url-guard.ts`) — 뉴스 URL 입력 시 내부망 접근 등을 차단하는 보안 처리
- **excludedClaims** — 근거 부족으로 최종본에서 제외된 주장을 별도로 노출하는 투명성 기능
- **TS ↔ Python 이중 계산 검증 배지** — 실행된 pandas 코드와 stdout을 그대로 펼쳐볼 수 있는 `RatioVerificationBadge`
- **ROI 배너** — 파이프라인 처리 시간을 실측(`processingTimeMs`)해 "8시간 → N분" 형태로 절감 효과를 정량 표시(`lib/roi.ts`, `ROIBanner.tsx`)
- **인쇄/PDF 대응 레이아웃** — 실무 배포를 고려한 `@media print` 스타일 및 "인쇄/PDF로 저장" 버튼
