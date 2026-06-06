"""PDF watermark for free-tier downloads.

Stamps four watermark elements on every page:
  - Centre  : diagonal "ApplyFlow Free" (45° CCW, 14pt)
  - Left    : vertical text reading bottom-to-top (90° CCW, 6pt)
  - Right   : vertical text reading top-to-bottom (−90°, 6pt)
  - Bottom  : horizontal footer (6.5pt)
  - Top     : none (intentionally omitted)

Uses only pypdf (already a dependency) — no extra packages needed.
Falls back to the original PDF silently if anything goes wrong.
"""
import base64
import io

_BOTTOM_TEXT = (
    "ApplyFlow Free Plan  -  applyflow.com  -  Upgrade to Pro to remove watermark"
)
_SIDE_TEXT   = "ApplyFlow Free  -  applyflow.com"
_CENTRE_TEXT = "ApplyFlow Free"

# 45° trig constant
_COS45 = 0.7071


def _esc(text: str) -> str:
    """Escape special characters for a PDF string literal."""
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _stamp_pdf_bytes(page_width: float, page_height: float) -> bytes:
    """Build a minimal valid PDF page containing all watermark elements.

    PDF text matrix Tm: a b c d e f
      Normal (0°):   1   0  0  1  x y
      90° CCW:       0   1 -1  0  x y   (reads bottom→top on left border)
      −90° / 90° CW: 0  -1  1  0  x y   (reads top→bottom on right border)
      45° CCW:     .707 .707 −.707 .707  x y   (diagonal centre)
    """
    w, h = page_width, page_height

    # Centre-diagonal start point — offset so "ApplyFlow Free" at 14pt is
    # approximately centred.  Helvetica avg char width ≈ 0.55×size.
    # "ApplyFlow Free" = 14 chars × 0.55 × 14pt ≈ 108 units; half ≈ 54;
    # projected onto each axis at 45°: 54 × cos45 ≈ 38 units.
    cx = w / 2 - 38
    cy = h / 2 - 38

    bottom  = _esc(_BOTTOM_TEXT)
    side    = _esc(_SIDE_TEXT)
    centre  = _esc(_CENTRE_TEXT)

    content_str = "\n".join([
        "q 0.72 0.72 0.72 rg",

        # ── Bottom (horizontal) ────────────────────────────────────────────────
        f"BT /F1 6.5 Tf 1 0 0 1 20 9 Tm ({bottom}) Tj ET",

        # ── Left border (90° CCW — text reads bottom → top) ───────────────────
        f"BT /F1 6 Tf 0 1 -1 0 10 80 Tm ({side}) Tj ET",

        # ── Right border (−90° — text reads top → bottom) ─────────────────────
        f"BT /F1 6 Tf 0 -1 1 0 {w - 10:.1f} {h - 80:.1f} Tm ({side}) Tj ET",

        # ── Centre diagonal (45° CCW) ──────────────────────────────────────────
        f"BT /F1 14 Tf {_COS45} {_COS45} -{_COS45} {_COS45} {cx:.1f} {cy:.1f} Tm ({centre}) Tj ET",

        "Q",
    ])
    content_bytes = content_str.encode("latin-1", errors="replace")

    # ── Assemble raw PDF ───────────────────────────────────────────────────────
    header = b"%PDF-1.4\n"
    obj1   = b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
    obj2   = b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
    obj3   = (
        f"3 0 obj\n<</Type /Page /Parent 2 0 R "
        f"/MediaBox [0 0 {w:.2f} {h:.2f}] "
        f"/Contents 4 0 R "
        f"/Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n"
    ).encode()
    obj4   = (
        f"4 0 obj\n<</Length {len(content_bytes)}>>\nstream\n".encode()
        + content_bytes
        + b"\nendstream\nendobj\n"
    )
    obj5   = b"5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n"

    # Calculate exact byte offsets for xref
    offsets: dict[int, int] = {}
    pos = len(header)
    for idx, chunk in enumerate([obj1, obj2, obj3, obj4, obj5], start=1):
        offsets[idx] = pos
        pos += len(chunk)

    startxref = pos
    xref = b"xref\n0 6\n" + b"0000000000 65535 f \n"
    for i in range(1, 6):
        xref += f"{offsets[i]:010d} 00000 n \n".encode()

    trailer = (
        f"trailer\n<</Size 6 /Root 1 0 R>>\n"
        f"startxref\n{startxref}\n%%EOF\n"
    ).encode()

    return header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer


def add_footer_watermark(pdf_b64: str) -> str:
    """Overlay watermark on every page of a base64-encoded PDF.

    Returns the original base64 string unchanged if watermarking fails —
    downloads never break even on malformed or encrypted PDFs.
    """
    if not pdf_b64:
        return pdf_b64
    try:
        from pypdf import PdfReader, PdfWriter

        reader = PdfReader(io.BytesIO(base64.b64decode(pdf_b64)))
        writer = PdfWriter()

        for page in reader.pages:
            w = float(page.mediabox.width)
            h = float(page.mediabox.height)
            stamp_page = PdfReader(io.BytesIO(_stamp_pdf_bytes(w, h))).pages[0]
            page.merge_page(stamp_page)
            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        return base64.b64encode(out.getvalue()).decode()

    except Exception:
        return pdf_b64
