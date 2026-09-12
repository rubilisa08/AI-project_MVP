"""Regenerates sample_data/financial_sample.pdf, a synthetic financial-statement
PDF (same figures as financial_sample.xlsx) used to exercise the PDF table
extraction path (lib/agents/pdfTableExtractor.ts) end-to-end with a real
ANTHROPIC_API_KEY.

Run with: pip install reportlab && python scripts/generate_sample_financial_pdf.py
"""

import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

# Helvetica has no Hangul glyphs. reportlab's built-in CID Korean fonts render
# visually but omit a ToUnicode CMap, so pdfplumber/pdf-parse extract empty
# text from them - useless for testing pdfTableExtractor.ts. Embed a real TTF
# (Windows' bundled Malgun Gothic) instead, which produces extractable text.
KOREAN_FONT = "MalgunGothic"
# Windows-specific path. On macOS/Linux, point this at any installed Korean TTF
# (e.g. NanumGothic.ttf) instead.
pdfmetrics.registerFont(TTFont(KOREAN_FONT, r"C:\Windows\Fonts\malgun.ttf"))

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "sample_data", "financial_sample.pdf")

BALANCE_SHEET_ROWS = [
    ["구분", "2024", "2023"],
    ["자산총계", "200,000", "180,000"],
    ["부채총계", "140,000", "130,000"],
    ["자본총계", "60,000", "50,000"],
    ["유동자산", "80,000", "70,000"],
    ["유동부채", "90,000", "60,000"],
]

INCOME_STATEMENT_ROWS = [
    ["구분", "2024", "2023"],
    ["매출액", "120,000", "100,000"],
    ["영업이익", "15,000", "8,000"],
    ["당기순이익", "9,000", "4,000"],
]

TABLE_STYLE = TableStyle(
    [
        ("FONTNAME", (0, 0), (-1, -1), KOREAN_FONT),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4338ca")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]
)


def build():
    styles = getSampleStyleSheet()
    for style_name in ("Title", "Normal", "Heading2"):
        styles[style_name].fontName = KOREAN_FONT

    doc = SimpleDocTemplate(OUT_PATH, pagesize=A4)
    story = [
        Paragraph("주식회사 예시 사업보고서 (샘플)", styles["Title"]),
        Paragraph("본 문서는 pdfTableExtractor.ts 테스트를 위해 생성된 가상의 재무 데이터입니다.", styles["Normal"]),
        Spacer(1, 12 * mm),
        Paragraph("1. 재무상태표 (요약)", styles["Heading2"]),
        Table(BALANCE_SHEET_ROWS, style=TABLE_STYLE, colWidths=[60 * mm, 40 * mm, 40 * mm]),
        PageBreak(),
        Paragraph("2. 손익계산서 (요약)", styles["Heading2"]),
        Table(INCOME_STATEMENT_ROWS, style=TABLE_STYLE, colWidths=[60 * mm, 40 * mm, 40 * mm]),
        Spacer(1, 8 * mm),
        Paragraph(
            "본 보고서는 유동성 및 부채 비율 관련 리스크 점검이 필요한 상황을 가정한 샘플 데이터입니다.",
            styles["Normal"],
        ),
    ]
    doc.build(story)
    print(f"샘플 재무제표 PDF 생성 완료: {OUT_PATH}")


if __name__ == "__main__":
    build()
