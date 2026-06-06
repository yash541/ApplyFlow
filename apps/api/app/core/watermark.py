"""PDF watermark for free-tier downloads.

Three watermark elements per page — no top, no centre diagonal:
  Bottom : full text, horizontal, y=9
  Left   : short text, 90° CCW (reads bottom→top), anchored near bottom-left
  Right  : short text, −90° (reads top→bottom), anchored at same y-range as left

Left and right both span y ≈ 22–67 so they appear at the same vertical
level, tucked near the bottom of the page beside the footer text.

Uses only pypdf (already a dependency). Falls back silently on any error.
"""
import base64
import io

_BOTTOM_TEXT = (
    "ApplyFlow Free Plan  -  applyflow.com  -  Upgrade to Pro to remove watermark"
)
_SIDE_TEXT = "ApplyFlow Free"

# "ApplyFlow Free" at 6pt: estimated advance ≈ 45 units (Helvetica avg 0.53×size)
_SIDE_FONT_SIZE  = 6
_SIDE_TEXT_ADVANCE = 45   # approx horizontal advance in points at 6pt

_Y_LOW  = 22                              # bottom of both side texts
_Y_HIGH = _Y_LOW + _SIDE_TEXT_ADVANCE    # top of both side texts (≈ 67)


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _stamp_pdf_bytes(page_width: float, page_height: float) -> bytes:
    w, h = page_width, page_height
    sz   = _SIDE_FONT_SIZE
    bot  = _esc(_BOTTOM_TEXT)
    side = _esc(_SIDE_TEXT)

    content_str = "\n".join([
        "q 0.72 0.72 0.72 rg",

        # ── Bottom (horizontal) ────────────────────────────────────────────────
        f"BT /F1 6.5 Tf 1 0 0 1 20 9 Tm ({bot}) Tj ET",

        # ── Left border (90° CCW — reads bottom→top, anchored at y=_Y_LOW) ────
        #   Tm: 0 1 -1 0 x y  →  text origin (x, _Y_LOW), advances upward
        f"BT /F1 {sz} Tf 0 1 -1 0 10 {_Y_LOW} Tm ({side}) Tj ET",

        # ── Right border (−90° — reads top→bottom, starts at y=_Y_HIGH) ────────
        #   With −90° each char advances in the −y direction, so starting at
        #   _Y_HIGH and ending at _Y_HIGH − advance ≈ _Y_LOW — same visual band.
        f"BT /F1 {sz} Tf 0 -1 1 0 {w - 10:.1f} {_Y_HIGH} Tm ({side}) Tj ET",

        "Q",
    ])
    content_bytes = content_str.encode("latin-1", errors="replace")

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
    """Overlay watermark on every page. Returns original on any error."""
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
