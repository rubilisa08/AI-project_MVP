# AI Business Briefing & Intelligence Publisher — 기획 문서

## 1. 서비스 개요

**AI Business Briefing & Intelligence Publisher**는 기업 공시(DART), 재무제표(Excel/PDF), 관련 뉴스 등
파편화된 비정형 비즈니스 데이터를 업로드하면, **4단계 Multi-Agent 파이프라인**
(Collector → Financial & Risk → Fact-Checker → Publisher)이 원문 근거 기반으로 검증된
**"5분 핵심 브리핑" 웹 리포트**를 자동 생성해주는 B2B SaaS MVP입니다.

단순 LLM 요약과 달리, 재무비율은 LLM이 암산하지 않고 **TypeScript·Python(pandas) 두 개의
독립된 엔진으로 이중 계산·교차검증**하며, 모든 리스크 주장은 **원문 소스 청크 id에 1:1로
근거를 매핑**한 뒤 Fact-Checker가 대조 검증합니다. 근거 없는 주장은 최종 리포트에서
자동 제외되어, 숫자 오류와 환각(Hallucination)을 구조적으로 차단합니다.

## 2. 타겟 사용자

- 대기업/중견기업 **경영기획팀, 전략기획팀**
- **CFO 및 C-Level 임원** — 투자·거래처·경쟁사 검토 시 빠른 의사결정이 필요한 사람
- 실무자가 작성한 보고서를 **빠르게 검증하고 싶은 관리자급**

## 3. 해결하는 문제

| 문제 | 기존 방식의 한계 | 본 서비스의 해결 방안 |
|---|---|---|
| 공시·재무제표·뉴스를 읽고 보고서로 정리하는 데 **5~10시간** 소요 | 실무자가 수십 장을 수작업으로 분석 | 업로드 → 수 분 내 자동 브리핑 생성 |
| 단순 LLM 요약은 **재무 비율 계산 오류**가 잦음 | LLM이 암산으로 숫자를 계산 | Python(pandas) 코드 실행 + TypeScript 이중 계산, 둘이 일치할 때만 검증 배지 표시 |
| LLM 요약의 **환각(근거 없는 주장)** 을 사람이 다시 원문과 대조해야 함 | 사후 검증 비용 발생 | 결정론적 청크 존재 검증 + LLM 원문 대조(2단계)로 근거 없는 주장 자동 제외 |
| 재무제표 자체의 오류(항등식 불일치 등)를 놓침 | 계산만 맞으면 넘어감 | 자산=부채+자본 항등식, 전기 대비 ±300% 이상치를 자동 탐지해 경고 |

## 4. 핵심 기능 요약

1. **Multi-format 입력**: PDF/Excel/CSV 드롭존 + 뉴스 URL 입력 (DART 링크 드래그 앤 드롭 지원)
2. **Multi-Agent 파이프라인**: Collector → Financial & Risk → Fact-Checker → Publisher, NDJSON 스트리밍으로 진행 상황 실시간 표시
3. **Interactive Briefing Dashboard**: 3줄 Executive Summary, Risk Radar(재무/시장/운영), Actionable Next Steps 3가지, 용어 툴팁 + 원문 근거 팝업
4. **투명성 장치**: 이중 계산 검증 배지, 회계 정합성/이상치 경고, 제외된 주장(excludedClaims) 노출

## 5. 기술 스택

Next.js(React) · Tailwind CSS · Supabase(Postgres, Auth) · Anthropic Claude API
(Code Execution Tool로 pandas 실행) · pdfplumber

## 6. 기대 효과

보고서 작성 시간을 **평균 5~10시간 → 수 분**으로 단축하면서도, 이중 계산·팩트체크
구조로 신뢰 가능한 수치와 근거를 제공해 **"빠르지만 검증되지 않은 요약"** 이 아닌
**"C-Level이 그대로 의사결정에 쓸 수 있는 브리핑"** 을 목표로 합니다.

---
*저장소: [github.com/rubilisa08/AI-project_MVP](https://github.com/rubilisa08/AI-project_MVP) · 상세 기능 명세는 [PRD.md](PRD.md) 참고*
