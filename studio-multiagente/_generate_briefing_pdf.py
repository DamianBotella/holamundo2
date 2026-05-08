# -*- coding: utf-8 -*-
"""
Generate a professional PDF from ArquitAI_briefing_para_claude.md.

Pipeline:
  markdown (.md) -> markdown.Markdown(extensions=[tables, fenced_code]) -> HTML
  Then a custom HTML walker emits ReportLab Platypus flowables (Paragraphs,
  Tables, HRFlowables, Spacers) with explicit ParagraphStyles for body,
  headings, code, etc.

Why not WeasyPrint? Requires GTK on Windows, unreliable.
Why not xhtml2pdf? Weak table layout for our wide tables.
Reportlab Platypus + custom HTML walker = full control, no external deps.
"""

from __future__ import annotations

import html as html_lib
import os
import re
import sys
from datetime import date
from html.parser import HTMLParser

import markdown as md_lib
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_MD = os.path.join(HERE, "ArquitAI_briefing_para_claude.md")
OUT_PDF = os.path.join(HERE, "ArquitAI_briefing_para_claude.pdf")

DOC_TITLE = "ArquitAI - Briefing tecnico-estrategico para analisis de mercado"
DOC_SUBTITLE = "Documento de contexto v1.0"
DOC_DATE = "2026-05-04"
DOC_AUTHOR = "Damian Martinez (ArquitAI)"

# ---------------------------------------------------------------------------
# Fonts
# ---------------------------------------------------------------------------
# Use Windows fonts that ship with the OS to avoid downloads:
#   Body serif:    Cambria  (warm, readable serif)
#   Heading sans:  Calibri  (modern sans, native)
#   Mono:          Consolas
# Fall back to ReportLab built-ins (Times-Roman / Helvetica / Courier) if missing.

WIN_FONTS = r"C:\Windows\Fonts"


def _try_register(font_name: str, *paths: str) -> bool:
    for p in paths:
        full = p if os.path.isabs(p) else os.path.join(WIN_FONTS, p)
        if os.path.exists(full):
            try:
                pdfmetrics.registerFont(TTFont(font_name, full))
                return True
            except Exception:
                continue
    return False


def register_fonts() -> dict:
    fonts = {
        "body": "Times-Roman",
        "body_b": "Times-Bold",
        "body_i": "Times-Italic",
        "body_bi": "Times-BoldItalic",
        "head": "Helvetica",
        "head_b": "Helvetica-Bold",
        "mono": "Courier",
        "mono_b": "Courier-Bold",
    }

    # Body serif - Cambria
    if _try_register("BodySerif", "cambria.ttc", "cambria.ttf") and \
       _try_register("BodySerif-B", "cambriab.ttf") and \
       _try_register("BodySerif-I", "cambriai.ttf") and \
       _try_register("BodySerif-BI", "cambriaz.ttf"):
        fonts["body"] = "BodySerif"
        fonts["body_b"] = "BodySerif-B"
        fonts["body_i"] = "BodySerif-I"
        fonts["body_bi"] = "BodySerif-BI"
        try:
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            registerFontFamily(
                "BodySerif",
                normal="BodySerif",
                bold="BodySerif-B",
                italic="BodySerif-I",
                boldItalic="BodySerif-BI",
            )
        except Exception:
            pass
    else:
        # Try Constantia as another nice serif
        if _try_register("BodySerif", "constan.ttf") and \
           _try_register("BodySerif-B", "constanb.ttf"):
            fonts["body"] = "BodySerif"
            fonts["body_b"] = "BodySerif-B"

    # Heading sans - Calibri
    if _try_register("HeadSans", "calibri.ttf") and \
       _try_register("HeadSans-B", "calibrib.ttf"):
        fonts["head"] = "HeadSans"
        fonts["head_b"] = "HeadSans-B"
        try:
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            registerFontFamily(
                "HeadSans", normal="HeadSans", bold="HeadSans-B"
            )
        except Exception:
            pass

    # Mono - Consolas
    if _try_register("Mono", "consola.ttf") and \
       _try_register("Mono-B", "consolab.ttf"):
        fonts["mono"] = "Mono"
        fonts["mono_b"] = "Mono-B"
        try:
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            registerFontFamily("Mono", normal="Mono", bold="Mono-B")
        except Exception:
            pass

    return fonts


FONTS = register_fonts()


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4
MARGIN_L = 2.2 * cm
MARGIN_R = 2.2 * cm
MARGIN_T = 2.2 * cm
MARGIN_B = 2.2 * cm

CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

COLOR_TEXT = colors.HexColor("#1f2328")
COLOR_HEAD = colors.HexColor("#0b3a5b")
COLOR_H2 = colors.HexColor("#0f4c75")
COLOR_H3 = colors.HexColor("#2d5d7b")
COLOR_MUTED = colors.HexColor("#6b7280")
COLOR_RULE = colors.HexColor("#cbd5e1")
COLOR_CODE_BG = colors.HexColor("#f3f4f6")
COLOR_CODE_BORDER = colors.HexColor("#e5e7eb")
COLOR_TABLE_HEAD_BG = colors.HexColor("#0b3a5b")
COLOR_TABLE_HEAD_FG = colors.white
COLOR_TABLE_ROW_ALT = colors.HexColor("#f8fafc")
COLOR_TABLE_BORDER = colors.HexColor("#cbd5e1")
COLOR_LINK = colors.HexColor("#0b66c2")


def _styles():
    s = {}
    s["body"] = ParagraphStyle(
        "body",
        fontName=FONTS["body"],
        fontSize=10.2,
        leading=14.5,
        textColor=COLOR_TEXT,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    s["body_left"] = ParagraphStyle(
        "body_left",
        parent=s["body"],
        alignment=TA_LEFT,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        fontName=FONTS["head_b"],
        fontSize=20,
        leading=24,
        textColor=COLOR_HEAD,
        spaceBefore=18,
        spaceAfter=10,
        keepWithNext=True,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        fontName=FONTS["head_b"],
        fontSize=14.5,
        leading=18,
        textColor=COLOR_H2,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )
    s["h3"] = ParagraphStyle(
        "h3",
        fontName=FONTS["head_b"],
        fontSize=12,
        leading=15,
        textColor=COLOR_H3,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    s["h4"] = ParagraphStyle(
        "h4",
        fontName=FONTS["head_b"],
        fontSize=10.5,
        leading=13,
        textColor=COLOR_H3,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True,
    )
    s["bullet"] = ParagraphStyle(
        "bullet",
        parent=s["body"],
        alignment=TA_LEFT,
        leftIndent=16,
        bulletIndent=4,
        spaceAfter=3,
    )
    s["code_block"] = ParagraphStyle(
        "code_block",
        fontName=FONTS["mono"],
        fontSize=8.6,
        leading=11.5,
        textColor=COLOR_TEXT,
        leftIndent=6,
        rightIndent=6,
        spaceBefore=4,
        spaceAfter=4,
        backColor=COLOR_CODE_BG,
        borderColor=COLOR_CODE_BORDER,
        borderWidth=0.5,
        borderPadding=6,
    )
    s["table_cell"] = ParagraphStyle(
        "table_cell",
        fontName=FONTS["body"],
        fontSize=8.6,
        leading=11,
        textColor=COLOR_TEXT,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    s["table_head"] = ParagraphStyle(
        "table_head",
        fontName=FONTS["head_b"],
        fontSize=8.8,
        leading=11.5,
        textColor=COLOR_TABLE_HEAD_FG,
        alignment=TA_LEFT,
    )
    s["toc_h1"] = ParagraphStyle(
        "toc_h1",
        fontName=FONTS["head_b"],
        fontSize=11,
        leading=15,
        textColor=COLOR_HEAD,
        spaceBefore=4,
        spaceAfter=2,
    )
    s["toc_h2"] = ParagraphStyle(
        "toc_h2",
        fontName=FONTS["head"],
        fontSize=10,
        leading=14,
        textColor=COLOR_TEXT,
        leftIndent=14,
        spaceAfter=1,
    )
    s["toc_h3"] = ParagraphStyle(
        "toc_h3",
        fontName=FONTS["head"],
        fontSize=9.2,
        leading=13,
        textColor=COLOR_MUTED,
        leftIndent=28,
        spaceAfter=0,
    )
    s["cover_title"] = ParagraphStyle(
        "cover_title",
        fontName=FONTS["head_b"],
        fontSize=26,
        leading=32,
        textColor=COLOR_HEAD,
        alignment=TA_CENTER,
        spaceAfter=14,
    )
    s["cover_subtitle"] = ParagraphStyle(
        "cover_subtitle",
        fontName=FONTS["head"],
        fontSize=14,
        leading=18,
        textColor=COLOR_H2,
        alignment=TA_CENTER,
        spaceAfter=40,
    )
    s["cover_meta"] = ParagraphStyle(
        "cover_meta",
        fontName=FONTS["body_i"],
        fontSize=11,
        leading=15,
        textColor=COLOR_MUTED,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    return s


STYLES = _styles()


# ---------------------------------------------------------------------------
# Inline markdown -> reportlab mini-HTML
# ---------------------------------------------------------------------------
# We let python-markdown convert block-level structure (lists, tables, code
# fences, headings) but for inline spans we deal with ReportLab's <b>/<i>/
# <font>/<u> mini-language. The HTMLParser walker below extracts inline
# fragments per block.

def _rl_escape(text: str) -> str:
    """Escape for ReportLab Paragraph parser: preserve markup we generate."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


class InlineCollector(HTMLParser):
    """Collect inline HTML inside one block element and render it as
    ReportLab's mini-HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        if tag in ("strong", "b"):
            self.out.append("<b>")
        elif tag in ("em", "i"):
            self.out.append("<i>")
        elif tag == "code":
            self.out.append(
                f'<font name="{FONTS["mono"]}" size="9" backColor="#f3f4f6">'
            )
        elif tag == "u":
            self.out.append("<u>")
        elif tag == "br":
            self.out.append("<br/>")
        elif tag == "a":
            href = attrs_d.get("href", "")
            self.out.append(
                f'<a href="{html_lib.escape(href)}" color="#0b66c2">'
            )
        elif tag == "li":
            # markers handled separately by the block walker
            pass
        else:
            # unknown - drop the tag, keep text
            pass

    def handle_endtag(self, tag):
        if tag in ("strong", "b"):
            self.out.append("</b>")
        elif tag in ("em", "i"):
            self.out.append("</i>")
        elif tag == "code":
            self.out.append("</font>")
        elif tag == "u":
            self.out.append("</u>")
        elif tag == "a":
            self.out.append("</a>")

    def handle_startendtag(self, tag, attrs):
        if tag == "br":
            self.out.append("<br/>")

    def handle_data(self, data):
        self.out.append(_rl_escape(data))

    def result(self) -> str:
        return "".join(self.out).strip()


def render_inline(html_fragment: str) -> str:
    p = InlineCollector()
    p.feed(html_fragment)
    p.close()
    return p.result()


# ---------------------------------------------------------------------------
# Block walker: HTML -> Platypus flowables
# ---------------------------------------------------------------------------

# We parse the markdown -> HTML once, then walk the DOM ourselves with a
# tiny recursive-descent parser over the HTML string. Using HTMLParser at
# block level is painful for tables/nested lists, so we use a simple regex
# driven block extractor on the well-formed output of python-markdown.

VOID_ELEMENTS = {
    "br", "hr", "img", "input", "meta", "link", "area",
    "base", "col", "embed", "param", "source", "track", "wbr",
}


class BlockExtractor(HTMLParser):
    """Build a tree of (tag, attrs, children_or_text) from markdown HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = ("root", {}, [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = (tag, dict(attrs), [])
        self.stack[-1][2].append(node)
        # Don't push void elements onto the stack - they have no children
        if tag not in VOID_ELEMENTS:
            self.stack.append(node)

    def handle_endtag(self, tag):
        # Find the matching tag on stack; if not, ignore (markdown
        # never emits unbalanced output, but be defensive).
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return
        # else: ignore

    def handle_startendtag(self, tag, attrs):
        node = (tag, dict(attrs), [])
        self.stack[-1][2].append(node)

    def handle_data(self, data):
        if data:
            self.stack[-1][2].append(("#text", {}, data))

    def handle_entityref(self, name):
        self.stack[-1][2].append(("#text", {}, f"&{name};"))

    def handle_charref(self, name):
        self.stack[-1][2].append(("#text", {}, f"&#{name};"))


def node_to_html(node) -> str:
    """Serialize a parsed node back to HTML for inline rendering."""
    tag, attrs, children = node
    if tag == "#text":
        return children  # raw text/entity
    if tag == "root":
        return "".join(node_to_html(c) for c in children)
    inner = "".join(node_to_html(c) for c in children)
    if tag in ("br", "hr", "img"):
        return f"<{tag}/>"
    attr_str = "".join(
        f' {k}="{html_lib.escape(v, quote=True)}"' for k, v in attrs.items()
    )
    return f"<{tag}{attr_str}>{inner}</{tag}>"


# Track section anchors so we can build a TOC.
HEADINGS: list[tuple[int, str, str]] = []  # (level, text, anchor)


def slugify(text: str, idx: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return f"sec-{idx}-{base[:50]}" if base else f"sec-{idx}"


def text_only(node) -> str:
    tag, _, children = node
    if tag == "#text":
        return children
    return "".join(text_only(c) for c in children)


def heading_para(level: int, text: str, anchor: str):
    style_key = f"h{min(level, 4)}"
    style = STYLES[style_key]
    # Anchor for potential cross-refs (TOC links would need named destinations
    # - we keep them as plain text since reportlab anchor support requires
    #   bookmark flowables; PDF readers still let you scroll).
    bookmark = (
        f'<a name="{anchor}"/>'
    )
    return Paragraph(bookmark + _rl_escape(text), style)


def render_table(node) -> Table:
    """Build a Platypus Table from <table>."""
    rows = []
    head_rows = 0
    for child in node[2]:
        if child[0] == "thead":
            for tr in child[2]:
                if tr[0] == "tr":
                    rows.append(_render_tr(tr, header=True))
                    head_rows += 1
        elif child[0] == "tbody":
            for tr in child[2]:
                if tr[0] == "tr":
                    rows.append(_render_tr(tr, header=False))
        elif child[0] == "tr":
            # bare tr (no thead/tbody)
            rows.append(_render_tr(child, header=(len(rows) == 0)))
            if len(rows) == 1:
                head_rows = 1

    if not rows:
        return Spacer(1, 0)

    n_cols = max(len(r) for r in rows)
    # pad short rows
    rows = [r + [Paragraph("", STYLES["table_cell"])] * (n_cols - len(r))
            for r in rows]

    # Column widths: distribute proportionally to the average length of
    # plain text per column, with a min/max clamp.
    text_rows = []
    for r in rows:
        tr_texts = []
        for cell in r:
            if isinstance(cell, Paragraph):
                # crude: strip tags
                tr_texts.append(re.sub(r"<[^>]+>", "", cell.text))
            else:
                tr_texts.append(str(cell))
        text_rows.append(tr_texts)

    col_avg = []
    for c in range(n_cols):
        lens = [len(row[c]) for row in text_rows]
        col_avg.append(max(6, sum(lens) / len(lens)))
    total = sum(col_avg)
    raw_widths = [CONTENT_W * (l / total) for l in col_avg]
    # Clamp to avoid tiny / huge cols
    min_w = 1.4 * cm
    widths = [max(min_w, w) for w in raw_widths]
    # Renormalize so they sum to CONTENT_W
    scale = CONTENT_W / sum(widths)
    widths = [w * scale for w in widths]

    t = Table(rows, colWidths=widths, repeatRows=head_rows, hAlign="LEFT")

    style_cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_TABLE_BORDER),
    ]
    if head_rows:
        style_cmds += [
            ("BACKGROUND", (0, 0), (-1, head_rows - 1), COLOR_TABLE_HEAD_BG),
            ("TEXTCOLOR", (0, 0), (-1, head_rows - 1), COLOR_TABLE_HEAD_FG),
            ("FONTNAME", (0, 0), (-1, head_rows - 1), FONTS["head_b"]),
            ("BOTTOMPADDING", (0, 0), (-1, head_rows - 1), 6),
            ("TOPPADDING", (0, 0), (-1, head_rows - 1), 6),
        ]
    # Zebra striping for body rows
    for i in range(head_rows, len(rows)):
        if (i - head_rows) % 2 == 1:
            style_cmds.append(
                ("BACKGROUND", (0, i), (-1, i), COLOR_TABLE_ROW_ALT)
            )

    t.setStyle(TableStyle(style_cmds))
    return t


def _render_tr(tr_node, header: bool):
    cells = []
    for c in tr_node[2]:
        if c[0] in ("th", "td"):
            inner_html = "".join(node_to_html(ch) for ch in c[2])
            inline = render_inline(inner_html)
            style = STYLES["table_head"] if (header or c[0] == "th") else STYLES["table_cell"]
            cells.append(Paragraph(inline or "&nbsp;", style))
    return cells


def render_list(node, ordered: bool, depth: int = 0):
    """Return a list of flowables for a <ul>/<ol>."""
    flowables = []
    counter = 1
    for li in node[2]:
        if li[0] != "li":
            continue
        # An <li> may contain inline content, paragraphs, sublists, code...
        # Pull inline text first (everything that's not a block-level child).
        inline_html_parts = []
        sub_flowables = []
        for child in li[2]:
            if child[0] in ("ul", "ol"):
                sub_flowables.extend(render_list(child, child[0] == "ol", depth + 1))
            elif child[0] == "p":
                inline_html_parts.append(
                    "".join(node_to_html(c) for c in child[2])
                )
            elif child[0] == "pre":
                # code block inside list item
                sub_flowables.extend(render_pre(child))
            else:
                inline_html_parts.append(node_to_html(child))
        marker = f"{counter}. " if ordered else "&bull;&nbsp;"
        counter += 1
        text = render_inline(" ".join(p for p in inline_html_parts if p))
        style = ParagraphStyle(
            f"li_d{depth}",
            parent=STYLES["bullet"],
            leftIndent=16 + depth * 14,
            bulletIndent=4 + depth * 14,
        )
        if text:
            flowables.append(Paragraph(marker + text, style))
        flowables.extend(sub_flowables)
    flowables.append(Spacer(1, 4))
    return flowables


def render_pre(node):
    """Render <pre><code>...</code></pre> as a code block."""
    # Find the <code> child or use raw text
    code_text_parts = []
    for child in node[2]:
        if child[0] == "code":
            code_text_parts.append(text_only(child))
        elif child[0] == "#text":
            code_text_parts.append(child[2])
    code = "".join(code_text_parts).rstrip("\n")
    if not code:
        return [Spacer(1, 2)]
    # Preserve line breaks; escape for Paragraph
    escaped = _rl_escape(code).replace("\n", "<br/>")
    # Replace runs of leading spaces with non-breaking ones for indentation
    def fix_indent(line: str) -> str:
        m = re.match(r"^( +)", line)
        if not m:
            return line
        spaces = m.group(1)
        return ("&nbsp;" * len(spaces)) + line[len(spaces):]

    lines = code.split("\n")
    fixed = [fix_indent(_rl_escape(l)) for l in lines]
    body = "<br/>".join(fixed) if fixed else "&nbsp;"
    return [Paragraph(body, STYLES["code_block"]), Spacer(1, 4)]


def render_block(node, flowables: list, heading_idx: list):
    """Render a single block-level node into flowables."""
    tag, attrs, children = node
    if tag == "#text":
        txt = children.strip()
        if txt:
            flowables.append(
                Paragraph(_rl_escape(txt), STYLES["body_left"])
            )
        return
    if tag in ("h1", "h2", "h3", "h4"):
        level = int(tag[1])
        text = text_only(node).strip()
        heading_idx[0] += 1
        anchor = slugify(text, heading_idx[0])
        HEADINGS.append((level, text, anchor))
        flowables.append(heading_para(level, text, anchor))
        return
    if tag == "p":
        inner = "".join(node_to_html(c) for c in children)
        text = render_inline(inner)
        if text:
            flowables.append(Paragraph(text, STYLES["body"]))
        return
    if tag == "hr":
        flowables.append(Spacer(1, 2))
        flowables.append(
            HRFlowable(
                width="100%",
                thickness=0.6,
                color=COLOR_RULE,
                spaceBefore=4,
                spaceAfter=8,
            )
        )
        return
    if tag == "ul":
        flowables.extend(render_list(node, ordered=False))
        return
    if tag == "ol":
        flowables.extend(render_list(node, ordered=True))
        return
    if tag == "table":
        flowables.append(Spacer(1, 4))
        flowables.append(render_table(node))
        flowables.append(Spacer(1, 8))
        return
    if tag == "pre":
        flowables.extend(render_pre(node))
        return
    if tag == "blockquote":
        # render children indented
        inner_flow = []
        h_idx = heading_idx
        for c in children:
            render_block(c, inner_flow, h_idx)
        # wrap in a table for the left bar look
        if inner_flow:
            tbl = Table(
                [[inner_flow]],
                colWidths=[CONTENT_W],
                hAlign="LEFT",
            )
            tbl.setStyle(TableStyle([
                ("LINEBEFORE", (0, 0), (0, -1), 2, COLOR_H2),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            flowables.append(tbl)
            flowables.append(Spacer(1, 4))
        return
    # Fallback: walk children
    for c in children:
        render_block(c, flowables, heading_idx)


# ---------------------------------------------------------------------------
# Page templates: cover, TOC, body
# ---------------------------------------------------------------------------

def _draw_header_footer(canvas, doc):
    canvas.saveState()
    # Header: small gray title (skip on cover)
    if doc.page > 1:
        canvas.setFont(FONTS["head"], 8.2)
        canvas.setFillColor(COLOR_MUTED)
        canvas.drawString(
            MARGIN_L, PAGE_H - MARGIN_T + 12,
            DOC_TITLE,
        )
        # thin rule under header
        canvas.setStrokeColor(COLOR_RULE)
        canvas.setLineWidth(0.4)
        canvas.line(
            MARGIN_L, PAGE_H - MARGIN_T + 6,
            PAGE_W - MARGIN_R, PAGE_H - MARGIN_T + 6,
        )
    # Footer: page number
    canvas.setFont(FONTS["head"], 9)
    canvas.setFillColor(COLOR_MUTED)
    page_str = f"Pagina {doc.page}"
    canvas.drawRightString(
        PAGE_W - MARGIN_R, MARGIN_B - 14, page_str
    )
    if doc.page > 1:
        canvas.drawString(
            MARGIN_L, MARGIN_B - 14,
            f"ArquitAI - briefing v1.0 - {DOC_DATE}"
        )
    canvas.restoreState()


def _draw_cover(canvas, doc):
    # Cover page: only minimal footer (no header, no page number)
    canvas.saveState()
    # Subtle top bar
    canvas.setFillColor(COLOR_HEAD)
    canvas.rect(0, PAGE_H - 1.2 * cm, PAGE_W, 1.2 * cm, fill=1, stroke=0)
    # Bottom bar
    canvas.setFillColor(COLOR_HEAD)
    canvas.rect(0, 0, PAGE_W, 0.8 * cm, fill=1, stroke=0)
    canvas.restoreState()


def build_pdf():
    # 1. Read source markdown
    with open(SRC_MD, "r", encoding="utf-8") as f:
        md_text = f.read()

    # 2. Convert markdown -> HTML
    html_text = md_lib.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists"],
        output_format="html5",
    )

    # 3. Parse HTML into block tree
    extractor = BlockExtractor()
    extractor.feed(html_text)
    extractor.close()
    root = extractor.root

    # 4. Build flowables for body
    body_flowables = []
    heading_idx = [0]
    for node in root[2]:
        render_block(node, body_flowables, heading_idx)

    # 5. Build cover flowables
    cover = [
        Spacer(1, 4 * cm),
        Paragraph(DOC_TITLE.replace(" - ", " &mdash; "), STYLES["cover_title"]),
        Spacer(1, 0.4 * cm),
        Paragraph(DOC_SUBTITLE, STYLES["cover_subtitle"]),
        Spacer(1, 4.5 * cm),
        Paragraph(f"Fecha: {DOC_DATE}", STYLES["cover_meta"]),
        Paragraph(f"Autor: {DOC_AUTHOR}", STYLES["cover_meta"]),
        Spacer(1, 0.6 * cm),
        Paragraph(
            "Documento de contexto preparado para el analisis de mercado por una instancia de Claude.",
            STYLES["cover_meta"],
        ),
    ]

    # 6. Build TOC flowables from collected HEADINGS
    toc_flow = [
        Paragraph("Indice de contenidos", STYLES["h1"]),
        HRFlowable(width="100%", thickness=0.6, color=COLOR_RULE,
                   spaceBefore=2, spaceAfter=10),
    ]
    for level, text, _anchor in HEADINGS:
        if level == 1:
            toc_flow.append(Paragraph(_rl_escape(text), STYLES["toc_h1"]))
        elif level == 2:
            toc_flow.append(Paragraph(_rl_escape(text), STYLES["toc_h2"]))
        elif level == 3:
            toc_flow.append(Paragraph(_rl_escape(text), STYLES["toc_h3"]))

    # 7. Document with three page templates
    doc = BaseDocTemplate(
        OUT_PDF,
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title=DOC_TITLE,
        author=DOC_AUTHOR,
        subject="ArquitAI briefing for market analysis",
    )

    frame_full = Frame(
        MARGIN_L, MARGIN_B,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B,
        id="content",
        showBoundary=0,
    )
    frame_cover = Frame(
        MARGIN_L, MARGIN_B + 0.8 * cm,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B - 1.6 * cm,
        id="cover",
        showBoundary=0,
    )

    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame_cover], onPage=_draw_cover),
        PageTemplate(id="toc", frames=[frame_full], onPage=_draw_header_footer),
        PageTemplate(id="body", frames=[frame_full], onPage=_draw_header_footer),
    ])

    story = []
    story.extend(cover)
    story.append(NextPageTemplate("toc"))
    story.append(PageBreak())
    story.extend(toc_flow)
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())
    story.extend(body_flowables)

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    size = os.path.getsize(OUT_PDF)
    print(f"OK: {OUT_PDF}  ({size} bytes)")
