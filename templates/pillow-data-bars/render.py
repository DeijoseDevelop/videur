"""Barras animadas con Pillow -> FFmpeg por stdin (rgb24)."""

import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

W = int(os.environ["VIDEUR_WIDTH"])
H = int(os.environ["VIDEUR_HEIGHT"])
FPS = int(os.environ["VIDEUR_FPS"])
DURATION = float(os.environ["VIDEUR_DURATION"])
OUTPUT = os.environ["VIDEUR_OUTPUT"]
TOTAL = max(1, int(FPS * DURATION))

BG = (7, 11, 18)
GRID = (20, 32, 51)
TEXT = (230, 237, 247)
MUTED = (143, 163, 186)
COLORS = [(34, 211, 238), (139, 92, 246), (245, 158, 11), (52, 211, 153), (34, 211, 238)]


def ease_out_cubic(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - pow(1 - x, 3)


def font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


TITLE_FONT = font(max(28, int(H * 0.078)), True)
SUB_FONT = font(max(16, int(H * 0.039)))
LABEL_FONT = font(max(12, int(H * 0.025)))


def center_text(draw, text, y, fnt, fill):
    box = draw.textbbox((0, 0), text, font=fnt)
    x = (W - (box[2] - box[0])) / 2
    draw.text((x, y), text, font=fnt, fill=fill)


def main() -> int:
    ffmpeg = os.environ.get("VIDEUR_FFMPEG", "ffmpeg")
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{W}x{H}", "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-",
        "-f", "lavfi", "-i", f"aevalsrc=0.06*sin(2*PI*220*t)+0.03*sin(2*PI*330*t):d={DURATION}",
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
        OUTPUT,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    bar_width = int(W * 0.0625)
    gap = int(W * 0.03125)
    count = 5
    total_width = count * bar_width + (count - 1) * gap
    start_x = (W - total_width) // 2
    base_y = int(H * 0.83)

    try:
        for frame in range(TOTAL):
            t = frame / FPS
            progress = frame / TOTAL
            img = Image.new("RGB", (W, H), BG)
            draw = ImageDraw.Draw(img)

            for x in range(0, W, 80):
                draw.line([(x, 0), (x, H)], fill=GRID, width=1)
            for y in range(0, H, 80):
                draw.line([(0, y), (W, y)], fill=GRID, width=1)

            center_text(draw, "ENERGIA SOLAR", H * 0.12, TITLE_FONT, TEXT)
            center_text(draw, "Datos animados con Python + Pillow", H * 0.22, SUB_FONT, MUTED)

            for i in range(count):
                local = max(0.0, min(1.0, progress * 1.8 - i * 0.08))
                factor = ease_out_cubic(local)
                max_height = H * (0.14 + i * 0.035)
                height = int(max_height * factor)
                x0 = start_x + i * (bar_width + gap)
                y0 = base_y - height
                if height > 2:
                    draw.rounded_rectangle(
                        [x0, y0, x0 + bar_width, base_y],
                        radius=max(4, int(bar_width * 0.12)),
                        fill=COLORS[i % len(COLORS)],
                    )
                draw.text((x0, base_y + 12), f"{i + 1}", font=LABEL_FONT, fill=MUTED)

            draw.line([(start_x, base_y + 2), (start_x + total_width, base_y + 2)], fill=(45, 65, 90), width=2)
            draw.text((W - 160, H - 40), f"{t:05.2f}s", font=LABEL_FONT, fill=MUTED)

            proc.stdin.write(img.tobytes())
            if frame % 10 == 0 or frame == TOTAL - 1:
                print(f"[videur:progress] {progress:.4f}", flush=True)

        proc.stdin.close()
        stderr = proc.stderr.read().decode("utf-8", "replace")
        code = proc.wait()
        if code != 0:
            print(stderr, file=sys.stderr)
            return code
        print(f"[videur:progress] 1.0", flush=True)
        return 0
    finally:
        try:
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
