from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps
from reportlab.lib import colors
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "output" / "pdf" / "galarentals-business-card-double-sided.pdf"
LOGO_PATH = ROOT / "public" / "gala-logo.webp"
HERO_PATH = ROOT / "public" / "hero-camry.webp"

PAGE_W = 90 * mm
PAGE_H = 55 * mm

NAVY = HexColor("#002347")
NAVY_LIGHT = HexColor("#003366")
GOLD = HexColor("#C5A028")
GOLD_LIGHT = HexColor("#E5C76B")
SILVER = HexColor("#E5E4E2")
OFFWHITE = HexColor("#F7F5EF")
SLATE = HexColor("#5B6676")
RED = HexColor("#B8332E")

PHONE = "+61415228557"
EMAIL = "admin@galarentals.com.au"
WEBSITE = "galarentals.com.au"  # inferred from the branded email domain in this repo
CONTACT_NAME = "Sarfraz Ahmad"
LICENCE = "317786C"
ABN = "16 623 061 941"
ACN = "623 061 941"


def register_font(name: str, path: str, fallback: str) -> str:
    font_path = Path(path)
    if font_path.exists():
        pdfmetrics.registerFont(TTFont(name, str(font_path)))
        return name
    return fallback


SERIF = register_font("CardSerif", r"C:\Windows\Fonts\georgiab.ttf", "Times-Bold")
SANS = register_font("CardSans", r"C:\Windows\Fonts\segoeui.ttf", "Helvetica")
SANS_BOLD = register_font("CardSansBold", r"C:\Windows\Fonts\segoeuib.ttf", "Helvetica-Bold")


def wrap_text(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    top_y: float,
    max_width: float,
    font_name: str,
    font_size: float,
    leading: float,
    fill_color: colors.Color,
) -> float:
    c.setFont(font_name, font_size)
    c.setFillColor(fill_color)
    y = top_y
    for line in wrap_text(text, font_name, font_size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def cover_image(path: Path, width: int, height: int, centering: tuple[float, float], overlay_alpha: int = 0) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    fitted = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS, centering=centering)
    if overlay_alpha:
        overlay = Image.new("RGBA", fitted.size, (0, 35, 71, overlay_alpha))
        fitted = Image.alpha_composite(fitted, overlay)
    fitted = ImageEnhance.Brightness(fitted).enhance(1.16)
    fitted = ImageEnhance.Contrast(fitted).enhance(1.04)
    return fitted


def draw_clipped_image(
    c: canvas.Canvas,
    image: Image.Image,
    x: float,
    y: float,
    width: float,
    height: float,
    radius: float,
) -> None:
    c.saveState()
    path = c.beginPath()
    path.roundRect(x, y, width, height, radius)
    c.clipPath(path, stroke=0, fill=0)
    c.drawImage(ImageReader(image), x, y, width, height, mask="auto")
    c.restoreState()


def draw_dot_field(c: canvas.Canvas, start_x: float, start_y: float, columns: int, rows: int, step: float) -> None:
    c.saveState()
    c.setFillColor(Color(229 / 255, 199 / 255, 107 / 255, alpha=0.14))
    for row in range(rows):
        for column in range(columns):
            c.circle(start_x + column * step, start_y - row * step, 0.5 * mm, fill=1, stroke=0)
    c.restoreState()


def draw_front(c: canvas.Canvas) -> None:
    margin = 6 * mm
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.saveState()
    c.setFillColor(Color(197 / 255, 160 / 255, 40 / 255, alpha=0.12))
    c.circle(PAGE_W - 4 * mm, PAGE_H - 8 * mm, 18 * mm, fill=1, stroke=0)
    c.circle(PAGE_W - 10 * mm, 10 * mm, 12 * mm, fill=1, stroke=0)
    c.restoreState()
    draw_dot_field(c, PAGE_W - 24 * mm, PAGE_H - 8 * mm, columns=4, rows=5, step=3.1 * mm)

    c.setFillColor(GOLD)
    c.roundRect(margin, PAGE_H - 9.4 * mm, 28 * mm, 4.8 * mm, 2.4 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont(SANS_BOLD, 5.7)
    c.drawString(margin + 2.3 * mm, PAGE_H - 7.8 * mm, "SYDNEY RENTAL SUPPORT")

    draw_wrapped_text(
        c,
        "Professional rental support for Sydney customers.",
        margin,
        PAGE_H - 16 * mm,
        43 * mm,
        SERIF,
        14,
        15.5,
        colors.white,
    )

    draw_wrapped_text(
        c,
        "Application-first subscription rentals with clear approval, billing, and handover support.",
        margin,
        PAGE_H - 29 * mm,
        42 * mm,
        SANS,
        6.9,
        8.4,
        Color(231 / 255, 236 / 255, 241 / 255),
    )

    c.setFillColor(Color(0, 0, 0, alpha=0.18))
    c.roundRect(margin, 11 * mm, 31 * mm, 6.3 * mm, 3.1 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD_LIGHT)
    c.setFont(SANS_BOLD, 5.6)
    c.drawString(margin + 2.3 * mm, 13.2 * mm, "SECURE CHECKOUT  |  REVIEW-FIRST")

    c.setFillColor(Color(1, 1, 1, alpha=0.13))
    c.roundRect(PAGE_W - 34 * mm, 24.5 * mm, 27 * mm, 24.5 * mm, 6 * mm, fill=1, stroke=0)
    c.setStrokeColor(Color(229 / 255, 199 / 255, 107 / 255, alpha=0.18))
    c.setLineWidth(0.5)
    c.roundRect(PAGE_W - 34 * mm, 24.5 * mm, 27 * mm, 24.5 * mm, 6 * mm, fill=0, stroke=1)
    c.drawImage(ImageReader(LOGO_PATH), PAGE_W - 33 * mm, 25.4 * mm, 25 * mm, 22.7 * mm, mask="auto")

    hero = cover_image(HERO_PATH, width=1120, height=650, centering=(0.67, 0.55), overlay_alpha=24)
    photo_x = PAGE_W - 34 * mm
    photo_y = 6.5 * mm
    photo_w = 27 * mm
    photo_h = 14.8 * mm
    draw_clipped_image(c, hero, photo_x, photo_y, photo_w, photo_h, 4.2 * mm)
    c.setStrokeColor(GOLD_LIGHT)
    c.setLineWidth(0.6)
    c.roundRect(photo_x, photo_y, photo_w, photo_h, 4.2 * mm, fill=0, stroke=1)

    c.setStrokeColor(Color(229 / 255, 199 / 255, 107 / 255, alpha=0.35))
    c.setLineWidth(0.5)
    c.line(margin, 7.4 * mm, PAGE_W - 7 * mm, 7.4 * mm)

    c.setFillColor(colors.white)
    c.setFont(SANS_BOLD, 6.6)
    c.drawString(margin, 4.6 * mm, PHONE)
    c.setFont(SANS, 6.2)
    c.drawRightString(PAGE_W - 7 * mm, 4.6 * mm, WEBSITE)


def draw_back(c: canvas.Canvas) -> None:
    c.setFillColor(OFFWHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    left_w = 29 * mm
    c.setFillColor(NAVY)
    c.rect(0, 0, left_w, PAGE_H, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(left_w, 0, 1.3 * mm, PAGE_H, fill=1, stroke=0)

    c.drawImage(ImageReader(LOGO_PATH), 5.2 * mm, PAGE_H - 20.5 * mm, 18.5 * mm, 18.5 * mm, mask="auto")
    c.setFillColor(colors.white)
    c.setFont(SANS_BOLD, 5.3)
    c.drawCentredString(left_w / 2, PAGE_H - 23 * mm, "GALA RENTALS")
    c.setFillColor(GOLD_LIGHT)
    draw_wrapped_text(
        c,
        "Apply confidently. Rent easier.",
        5.1 * mm,
        PAGE_H - 29 * mm,
        18.5 * mm,
        SERIF,
        8.8,
        9.6,
        GOLD_LIGHT,
    )
    draw_wrapped_text(
        c,
        "Flexible subscription rentals with professional handover support.",
        5.1 * mm,
        13.8 * mm,
        18.4 * mm,
        SANS,
        5.8,
        6.8,
        Color(223 / 255, 231 / 255, 239 / 255),
    )
    c.setFillColor(GOLD)
    c.setFont(SANS_BOLD, 6.6)
    c.drawCentredString(left_w / 2, 4.8 * mm, PHONE)

    content_x = 36 * mm
    label_x = content_x
    value_x = content_x
    c.setFillColor(GOLD)
    c.setFont(SANS_BOLD, 5.7)
    c.drawString(content_x, PAGE_H - 8.2 * mm, "GALA RENTALS")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 12.6)
    c.drawString(content_x, PAGE_H - 14.1 * mm, CONTACT_NAME)
    c.setFillColor(SLATE)
    c.setFont(SANS, 6.5)
    c.drawString(content_x, PAGE_H - 17.8 * mm, "Sydney rental support")

    draw_wrapped_text(
        c,
        "Premium application-first rental support for customers across Sydney.",
        content_x,
        PAGE_H - 22.8 * mm,
        47 * mm,
        SANS,
        5.9,
        6.8,
        SLATE,
    )

    contact_top = PAGE_H - 31 * mm
    c.setFillColor(GOLD)
    c.setFont(SANS_BOLD, 5.2)
    c.drawString(label_x, contact_top, "PHONE")
    c.setFillColor(NAVY)
    c.setFont(SANS_BOLD, 8.8)
    c.drawString(value_x, contact_top - 4.1 * mm, PHONE)

    c.setFillColor(GOLD)
    c.setFont(SANS_BOLD, 5.2)
    c.drawString(61.5 * mm, contact_top, "WEB")
    c.setFillColor(NAVY)
    c.setFont(SANS_BOLD, 7.6)
    c.drawString(61.5 * mm, contact_top - 4.1 * mm, WEBSITE)

    c.setFillColor(GOLD)
    c.setFont(SANS_BOLD, 5.2)
    c.drawString(label_x, contact_top - 9.8 * mm, "EMAIL")
    c.setFillColor(NAVY)
    c.setFont(SANS, 7.1)
    c.drawString(value_x, contact_top - 13.8 * mm, EMAIL)

    c.setFillColor(GOLD)
    c.setFont(SANS_BOLD, 5.2)
    c.drawString(61.5 * mm, 8.7 * mm, "SERVICE")
    c.setFillColor(NAVY)
    c.setFont(SANS, 7.4)
    c.drawString(61.5 * mm, 4.5 * mm, "Sydney, NSW")

    c.setStrokeColor(Color(0, 35 / 255, 71 / 255, alpha=0.16))
    c.setLineWidth(0.4)
    c.line(content_x, 2.8 * mm, PAGE_W - 4.8 * mm, 2.8 * mm)
    c.setFillColor(Color(0, 35 / 255, 71 / 255, alpha=0.76))
    c.setFont(SANS, 4.9)
    c.drawString(content_x, 1.1 * mm, f"Licence {LICENCE}  |  ABN {ABN}  |  ACN {ACN}")


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT_PATH), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Galarentals Business Card")
    c.setAuthor("Codex for Galarentals")
    c.setSubject("Double-sided business card artwork")
    c.setCreator("scripts/generate_business_card_pdf.py")

    draw_front(c)
    c.showPage()
    draw_back(c)
    c.save()
    print(f"Created {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
