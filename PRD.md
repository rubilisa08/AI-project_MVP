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

## 5. 기술 스택 (Technical Stack)

| 구분 | 기술 스택 | 비고 |
|---|---|---|
| Frontend | Next.js (React), Tailwind CSS, Shadcn UI | 빠른 B2B 대시보드 UI 구성 |
| Backend / DB | Supabase (PostgreSQL, Vector DB) | 사용자 인증 및 문서 임베딩 저장 |
| AI / Orchestration | LangChain / LangGraph, Claude 3.5 Sonnet & Haiku | Multi-Agent 워크플로우 제어 |
| Parsing & Tools | Python (Pandas, pdfplumber), OpenAI/Claude API | 표 파싱 및 데이터 계산 연동 |

## 6. 현재 구현 현황과의 차이 (Implementation Status vs. This PRD)

> 아래는 [rubilisa08/AI-project_MVP](https://github.com/rubilisa08/AI-project_MVP) 저장소의 실제 구현을 이 PRD와 비교한 결과입니다 (2026-09-12 기준). 4단계 Multi-Agent 아키텍처와 핵심 기능 흐름은 PRD와 거의 동일하게 구현되었으나, 기술 스택 일부는 MVP 단계에서 더 가벼운 방식으로 대체되었습니다.

### 6.1 PRD대로 구현된 부분

| PRD 항목 | 구현 상태 | 비고 |
|---|---|---|
| 4단계 Multi-Agent 아키텍처 | ✅ | Collector → Financial&Risk → Fact-Checker → Publisher, PRD 설계 그대로 |
| PDF/Excel 드롭존, URL 입력 | ✅ | `FileDropzone`, `UrlInputList` |
| 표 구조 보존 파싱 | ✅ | PDF는 페이지 단위(`n페이지`), Excel은 행 단위로 위치 기록 |
| 재무비율(부채비율·유동비율·영업이익률·ROE·ROA·매출성장률) | ✅ (계산 방식은 6.2 참고) | `lib/finance/ratios.ts` |
| 재무/시장/운영 3대 리스크 스코어 | ✅ | `RiskRadarScores { financial, market, operational }` |
| 원문 근거 1:1 매핑 및 환각 검증 | ✅ (오히려 더 엄격) | 청크 id 실존 여부를 코드로 먼저 확인 후, Claude가 주장 vs 원문을 대조해 supported/partially_supported/unsupported 판정. 근거 없는 주장은 최종본에서 제외 |
| 3줄 Executive Summary / Next Steps 3가지 | ✅ | zod 스키마로 정확히 3개 강제 |
| 용어 툴팁 + 원문 근거 팝업 | ✅ | `TermTooltip.tsx` |

### 6.2 기술 스택이 다르게 구현된 부분

| PRD 명시 | 실제 구현 | 차이 |
|---|---|---|
| Python (Pandas, pdfplumber) + Code Interpreter | TypeScript 계산 유틸 (`pdf-parse`, `xlsx`) | Python 실행 환경 없이 Next.js 서버에서 직접 계산 |
| LangChain / LangGraph | 없음 — `app/api/analyze/route.ts`에서 함수 호출 순서로 직접 오케스트레이션 | 별도 프레임워크 없이 커스텀 파이프라인 |
| Claude 3.5 Sonnet & Haiku (모델 티어링) | 단일 모델(`CLAUDE_MODEL` 환경변수, 기본값 `claude-sonnet-5`)만 사용 | 비용 절감용 Haiku 이원화 전략 미적용 |
| Supabase (PostgreSQL, Vector DB) | Supabase Postgres만 사용 (reports 테이블 + RLS) | 벡터DB/임베딩 저장 없음 → Fact-Checker는 RAG 검색이 아니라 청크 id 직접 대조 방식 |
| Shadcn UI | 순수 Tailwind CSS 커스텀 컴포넌트 | Shadcn 라이브러리 미사용 |
| DART 사업보고서 자동 수집 / 기업명 입력 | 미구현 | 기업명 입력 → 자동 크롤링 없음. 사용자가 직접 파일/URL을 업로드하는 방식만 지원 |

### 6.3 PRD에 없던 추가 구현 사항

- **Supabase Auth (매직 링크 로그인) + 리포트 저장/재조회** (`/reports` 목록·상세 페이지) — 로그인 시 생성된 리포트를 저장하고 다시 볼 수 있음
- **MOCK_LLM 모드** — API 키 없이 재무비율 임계값 기반 목업 응답으로 전체 파이프라인/UI를 무료로 검증 가능
- **SSRF 가드** (`lib/parsers/url-guard.ts`) — 뉴스 URL 입력 시 내부망 접근 등을 차단하는 보안 처리
- **excludedClaims** — 근거 부족으로 최종본에서 제외된 주장을 별도로 노출하는 투명성 기능
