"""PDF footer watermark for free-tier downloads.

Stamps a subtle grey footer on every page of a base64-encoded PDF.
Uses only pypdf (already a dependency) — no new packages required.
Falls back to the original PDF silently if anything goes wrong.
"""
import base64
import io

WATERMARK_TEXT = (
    "ApplyFlow Free Plan  -  applyflow.com  -  Upgrade to Pro to remove watermark"
)


def _stamp_pdf_bytes(page_width: float, page_height: float) -> bytes:
    """Build a minimal single-page PDF containing only the footer text.

    Constructs raw PDF syntax and calculates xref offsets precisely so
    the result is valid without needing reportlab or any extra library.
    """
    safe_text = (
        WATERMARK_TEXT
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )

    content_str = (
        f"q 0.60 0.60 0.60 rg "
        f"BT /F1 6.5 Tf 20 9 Td ({safe_text}) Tj ET Q"
    )
    content_bytes = content_str.encode("latin-1", errors="replace")

    header  = b"%PDF-1.4\n"
    obj1    = b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
    obj2    = b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
    obj3    = (
        f"3 0 obj\n<</Type /Page /Parent 2 0 R "
        f"/MediaBox [0 0 {page_width:.2f} {page_height:.2f}] "
        f"/Contents 4 0 R "
        f"/Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n"
    ).encode()
    obj4    = (
        f"4 0 obj\n<</Length {len(content_bytes)}>>\nstream\n".encode()
        + content_bytes
        + b"\nendstream\nendobj\n"
    )
    obj5    = b"5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n"

    # Calculate byte offsets for xref table
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
    """Overlay footer watermark on every page of a base64-encoded PDF.

    Returns the original base64 string unchanged if watermarking fails,
    so downloads never break even on malformed PDFs.
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
            stamp_bytes = _stamp_pdf_bytes(w, h)
            stamp_page  = PdfReader(io.BytesIO(stamp_bytes)).pages[0]
            page.merge_page(stamp_page)
            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        return base64.b64encode(out.getvalue()).decode()

    except Exception:
        return pdf_b64  # non-fatal: serve original rather than breaking download
