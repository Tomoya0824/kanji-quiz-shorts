"""漢字3択クイズのショート動画を quiz.json から生成する。
usage: python3 make_short.py quiz.json out.mp4
"""
import json, math, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
T_HOOK, T_COUNT0, T_COUNT1, T_REVEAL, T_CTA, T_END = 0.0, 2.2, 7.2, 7.6, 14.0, 16.5
FONT_BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

BG_TOP, BG_BOT = (18, 24, 54), (40, 22, 70)
ACCENT = (255, 196, 61)
CORRECT = (52, 199, 120)
WHITE = (255, 255, 255)
DIM = (120, 120, 150)
LABELS = ["A", "B", "C"]

_fonts = {}
def font(path, size, index=0):
    size = max(1, int(size))
    k = (path, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(path, size, index=index)
    return _fonts[k]

def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3

def pop(t, start, dur=0.35):
    x = (t - start) / dur
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    return 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2  # back-ease

def make_background():
    g = np.linspace(0, 1, H)[:, None]
    top, bot = np.array(BG_TOP), np.array(BG_BOT)
    arr = (top * (1 - g) + bot * g)[:, :, None].repeat(1, 2)
    arr = np.broadcast_to((top * (1 - g) + bot * g)[:, None, :], (H, W, 3)).astype(np.uint8)
    img = Image.fromarray(arr.copy()).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for x, y, r in [(80, 300, 220), (1000, 120, 160), (980, 1500, 260), (60, 1800, 180)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 10))
    return Image.alpha_composite(img, ov.filter(ImageFilter.GaussianBlur(30))).convert("RGB")

def text_center(d, cx, cy, s, f, fill):
    b = d.textbbox((0, 0), s, font=f)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), s, font=f, fill=fill)

def frame(t, q, bg):
    img = bg.copy()
    d = ImageDraw.Draw(img, "RGBA")
    revealed = t >= T_REVEAL

    # series label
    text_center(d, W / 2, 130, q["series"], font(FONT_BOLD, 40), (255, 255, 255, 170))

    # hook
    s = pop(t, T_HOOK + 0.1)
    if s > 0:
        f = font(FONT_BLACK, int(84 * s) or 1)
        text_center(d, W / 2, 270, q["hook"], f, ACCENT)

    # kanji card
    s = pop(t, T_HOOK + 0.5, 0.45)
    if s > 0:
        cw, ch = int(820 * s), int(520 * s)
        cy = 640
        d.rounded_rectangle([W / 2 - cw / 2, cy - ch / 2, W / 2 + cw / 2, cy + ch / 2], 48, fill=(255, 255, 255, 245))
        if s > 0.3:
            size = int(300 * s) if len(q["question"]) <= 2 else int(560 / len(q["question"]) * s)
            text_center(d, W / 2, cy - 10, q["question"], font(SERIF, size), (25, 25, 45))

    # choices
    for i, c in enumerate(q["choices"]):
        appear = T_HOOK + 1.2 + i * 0.25
        a = ease_out((t - appear) / 0.3)
        if a <= 0: continue
        y = 1060 + i * 170 + (1 - a) * 60
        is_ans = i == q["answer_index"]
        if revealed and is_ans:
            fill, txt, lab_bg = CORRECT + (255,), WHITE, (255, 255, 255, 60)
        elif revealed:
            fill, txt, lab_bg = (60, 60, 90, 200), DIM, (255, 255, 255, 25)
        else:
            fill, txt, lab_bg = (255, 255, 255, int(40 * a)), WHITE, ACCENT + (255,)
        x0, x1 = 120, W - 120
        d.rounded_rectangle([x0, y, x1, y + 140], 70, fill=fill, outline=(255, 255, 255, int(120 * a)), width=3)
        d.ellipse([x0 + 22, y + 22, x0 + 118, y + 118], fill=lab_bg)
        text_center(d, x0 + 70, y + 70, LABELS[i], font(FONT_BLACK, 52), (25, 25, 45) if not revealed else txt)
        text_center(d, W / 2 + 40, y + 68, c, font(FONT_BLACK, 64), txt)
        if revealed and is_ans:
            d.ellipse([x1 - 115, y + 30, x1 - 35, y + 110], outline=WHITE, width=10)

    # countdown ring
    if T_COUNT0 <= t < T_COUNT1 + 0.2:
        remain = max(0.0, T_COUNT1 - t)
        n = math.ceil(remain) if remain > 0 else 0
        cx, cy, r = W / 2, 1640, 95
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 90))
        frac = remain / (T_COUNT1 - T_COUNT0)
        d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * frac, fill=ACCENT, width=14)
        if n > 0:
            bump = 1 + 0.25 * max(0, (n - remain) - 0.75) * 4
            text_center(d, cx, cy - 4, str(n), font(FONT_BLACK, int(110 * bump)), WHITE)

    # reveal panel
    if revealed:
        a = ease_out((t - T_REVEAL - 0.4) / 0.4)
        if a > 0:
            origin = q.get("origin", "")
            lines = [origin[i:i + 20] for i in range(0, len(origin), 20)][:2]
            ph = 190 + (40 + 46 * len(lines) if lines else 0)
            y0 = 1555 + (1 - a) * 80
            d.rounded_rectangle([70, y0, W - 70, y0 + ph], 36, fill=(0, 0, 0, int(150 * a)))
            text_center(d, W / 2, y0 + 60, f"意味：{q['meaning']}", font(FONT_BOLD, 44), (255, 255, 255, int(255 * a)))
            text_center(d, W / 2, y0 + 135, q["example"], font(FONT_BOLD, 40), ACCENT + (int(255 * a),))
            if lines:
                # 由来は答え発表の少し後に出す
                b = ease_out((t - T_REVEAL - 1.6) / 0.4)
                if b > 0:
                    d.line([140, y0 + 182, W - 140, y0 + 182], fill=(255, 255, 255, int(60 * b)), width=2)
                    for k, ln in enumerate(lines):
                        prefix = "由来：" if k == 0 else ""
                        text_center(d, W / 2, y0 + 220 + k * 46, prefix + ln, font(FONT_BOLD, 38), (200, 220, 255, int(255 * b)))
        s = pop(t, T_REVEAL, 0.4)
        if s > 0 and t < T_CTA:
            text_center(d, W / 2, 985, "正解は…", font(FONT_BLACK, int(60 * s) or 1), WHITE)

    # CTA
    if t >= T_CTA:
        s = pop(t, T_CTA, 0.4)
        d.rounded_rectangle([60, 920, W - 60, 1040], 40, fill=ACCENT + (int(255 * min(1, s)),))
        text_center(d, W / 2, 980, q["cta"], font(FONT_BLACK, int(58 * max(s, 0.01))), (25, 25, 45))
    return img

# ---------- audio ----------
SR = 44100
def tone(freq, dur, vol=0.3, decay=6.0):
    t = np.arange(int(SR * dur)) / SR
    return vol * np.sin(2 * np.pi * freq * t) * np.exp(-decay * t)

def make_audio(path):
    n = int(SR * T_END)
    out = np.zeros(n)
    t = np.arange(n) / SR
    # soft pad loop: Cmaj7 -> Am7 -> Fmaj7 -> G (2s each)
    chords = [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0],
              [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 392.0]]
    for k in range(int(T_END / 2) + 1):
        s0 = int(k * 2 * SR); s1 = min(n, s0 + 2 * SR)
        seg_t = t[s0:s1] - k * 2
        env = np.minimum(1, seg_t / 0.3) * np.minimum(1, (2 - seg_t) / 0.3)
        for f in chords[k % 4]:
            out[s0:s1] += 0.035 * np.sin(2 * np.pi * f * seg_t) * env
    # bass pulse
    for k in range(int(T_END * 2)):
        s0 = int(k * 0.5 * SR)
        b = tone(chords[(k // 4) % 4][0] / 2, 0.4, 0.12, 8)
        out[s0:s0 + len(b)] += b[: n - s0]
    def add(sec, sig):
        s0 = int(sec * SR); out[s0:s0 + len(sig)] += sig[: n - s0]
    add(T_HOOK + 0.1, tone(880, 0.3, 0.25) + tone(1320, 0.3, 0.15))
    for i in range(5):  # countdown ticks
        add(T_COUNT0 + i, tone(1500, 0.08, 0.35, 40))
    for i, f in enumerate([523.3, 659.3, 784.0, 1046.5]):  # reveal chime
        add(T_REVEAL + i * 0.08, tone(f, 0.9, 0.22, 3))
    add(T_CTA, tone(988, 0.25, 0.2) + tone(1318, 0.25, 0.15))
    fade = np.minimum(1, (T_END - t) / 0.8)
    out *= fade
    out = np.clip(out / max(1e-6, np.abs(out).max()) * 0.8, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())

def main(qpath, outpath):
    q = json.loads(Path(qpath).read_text(encoding="utf-8"))
    wav = Path(outpath).with_suffix(".wav")
    make_audio(wav)
    bg = make_background()
    total = int(T_END * FPS)
    proc = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(wav),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(outpath)],
        stdin=subprocess.PIPE)
    for i in range(total):
        proc.stdin.write(frame(i / FPS, q, bg).convert("RGB").tobytes())
    proc.stdin.close(); proc.wait()
    wav.unlink()
    print("done", outpath)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
