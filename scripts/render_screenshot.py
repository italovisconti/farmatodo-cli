#!/usr/bin/env python3
import sys
import json
import os
from PIL import Image, ImageDraw, ImageFont

def render_spans_to_png(spans_data, output_path, title="Farmatodo CLI - OpenTUI"):
    cols = spans_data.get("cols", 100)
    rows = spans_data.get("rows", 26)
    lines = spans_data.get("lines", [])

    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    bold_font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
    title_font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

    font_size = 15
    font = ImageFont.truetype(font_path, font_size)
    bold_font = ImageFont.truetype(bold_font_path, font_size)
    title_font = ImageFont.truetype(title_font_path, 12)

    cell_w = font.getlength("M")
    ascent, descent = font.getmetrics()
    cell_h = ascent + descent + 2

    pad_x = 16
    pad_y = 12
    titlebar_h = 32

    img_w = int(cols * cell_w + pad_x * 2)
    img_h = int(rows * cell_h + pad_y * 2 + titlebar_h)

    # Terminal background (#0f172a or #0a0e1a)
    term_bg = (10, 15, 29, 255)
    titlebar_bg = (15, 23, 42, 255)
    border_color = (30, 41, 59, 255)

    img = Image.new("RGBA", (img_w, img_h), term_bg)
    draw = ImageDraw.Draw(img)

    # Draw titlebar
    draw.rectangle([(0, 0), (img_w, titlebar_h)], fill=titlebar_bg)
    draw.line([(0, titlebar_h), (img_w, titlebar_h)], fill=border_color, width=1)

    # Window controls (macOS / modern style dots)
    dot_radius = 5
    dot_y = titlebar_h // 2
    draw.ellipse([(14 - dot_radius, dot_y - dot_radius), (14 + dot_radius, dot_y + dot_radius)], fill=(239, 68, 68))
    draw.ellipse([(32 - dot_radius, dot_y - dot_radius), (32 + dot_radius, dot_y + dot_radius)], fill=(245, 158, 11))
    draw.ellipse([(50 - dot_radius, dot_y - dot_radius), (50 + dot_radius, dot_y + dot_radius)], fill=(34, 197, 94))

    # Title text centered
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    draw.text(((img_w - title_w) // 2, (titlebar_h - 14) // 2), title, font=title_font, fill=(148, 163, 184))

    # Outer border
    draw.rectangle([(0, 0), (img_w - 1, img_h - 1)], outline=border_color, width=1)

    # Render terminal lines
    content_y_start = titlebar_h + pad_y

    for row_idx, line in enumerate(lines):
        if row_idx >= rows:
            break
        y = content_y_start + row_idx * cell_h
        x = pad_x

        for span in line.get("spans", []):
            text = span.get("text", "")
            width = span.get("width", len(text))
            fg = span.get("fg", {}).get("buffer", {})
            bg = span.get("bg", {}).get("buffer", {})

            fg_color = (
                fg.get("0", 255),
                fg.get("1", 255),
                fg.get("2", 255),
                fg.get("3", 255)
            )

            bg_color = (
                bg.get("0", 0),
                bg.get("1", 0),
                bg.get("2", 0),
                bg.get("3", 0)
            )

            span_pixel_w = width * cell_w

            # If background is set and not default transparent/black
            if bg_color[3] > 0 and (bg_color[0] != 0 or bg_color[1] != 0 or bg_color[2] != 0):
                draw.rectangle([(x, y), (x + span_pixel_w - 1, y + cell_h - 1)], fill=bg_color)

            # Draw text
            if text:
                # Use bold font for bright/selected attributes if needed
                attrs = span.get("attributes", 0)
                active_font = bold_font if (attrs & 1) else font
                draw.text((x, y + 1), text, font=active_font, fill=fg_color)

            x += span_pixel_w

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path)
    print(f"Screenshot successfully saved to: {output_path} ({img_w}x{img_h})")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 render_screenshot.py <spans_json_file> <output_png_file> [title]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_png = sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else "Farmatodo CLI - OpenTUI"

    with open(input_file, "r", encoding="utf-8") as f:
        spans_data = json.load(f)

    render_spans_to_png(spans_data, output_png, title)
