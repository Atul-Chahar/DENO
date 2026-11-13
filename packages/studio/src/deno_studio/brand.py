"""Brand kit from the founder's website: colours, fonts, logo (docs/18 §3, `set_brand_kit`).

Plain HTTP through the SSRF-guarded fetcher in ``deno_sources.website`` (no browser), so it runs inside a
serverless function. Reads the page, its ``theme-color``, inline ``<style>`` blocks and ``style=""`` attributes,
and up to two same-site stylesheets. Colours are ranked by use, with near-white/near-black split out as
background/ink and the most-used saturated colour as the accent.
"""

from __future__ import annotations

import colorsys
import re
from collections import Counter
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import parse_qs, urljoin, urlsplit

from selectolax.parser import HTMLParser

from deno_sources.website import SiteUnavailable, fetch_page

_HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
_RGB = re.compile(r"rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})")
_FONT_FAMILY = re.compile(r"font-family\s*:\s*([^;}{]+)", re.IGNORECASE)
_GENERIC = {
    "sans-serif",
    "serif",
    "monospace",
    "system-ui",
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "cursive",
    "inherit",
    "initial",
    "unset",
    "-apple-system",
    "blinkmacsystemfont",
    "segoe ui",
    "roboto",
    "helvetica neue",
    "arial",
    "helvetica",
    "apple color emoji",
    "segoe ui emoji",
    "segoe ui symbol",
    "noto color emoji",
    "emoji",
    "var",
    "fantasy",
    "math",
}

Fetch = Callable[[str, str, tuple[str, ...]], Awaitable[tuple[str, str]]]


@dataclass
class BrandKit:
    source_url: str = ""
    name: str = ""
    colors: dict[str, str] = field(default_factory=dict)  # background, ink, accent, + palette list in `palette`
    palette: list[str] = field(default_factory=list)
    fonts: dict[str, str] = field(default_factory=dict)  # display, body, mono
    google_fonts: list[str] = field(default_factory=list)
    logo_url: str | None = None
    icon_url: str | None = None
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _hex(raw: str) -> str:
    raw = raw.lower()
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    return f"#{raw}"


def _colors(css: str) -> Counter[str]:
    found: Counter[str] = Counter()
    for m in _HEX.finditer(css):
        found[_hex(m.group(1))] += 1
    for m in _RGB.finditer(css):
        r, g, b = (min(255, int(x)) for x in m.groups())
        found[f"#{r:02x}{g:02x}{b:02x}"] += 1
    return found


def _hls(color: str) -> tuple[float, float, float]:
    r, g, b = (int(color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hls(r, g, b)


def _fonts(css: str) -> Counter[str]:
    found: Counter[str] = Counter()
    for m in _FONT_FAMILY.finditer(css):
        for raw in m.group(1).split(","):
            name = raw.strip().strip("\"'").strip()
            if name and name.lower() not in _GENERIC and not name.lower().startswith(("var(", "__")):
                found[name] += 1
    return found


def _google_fonts(tree: HTMLParser, base: str) -> list[str]:
    families: list[str] = []
    for node in tree.css('link[href*="fonts.googleapis.com"]'):
        href = urljoin(base, node.attributes.get("href") or "")
        for fam in parse_qs(urlsplit(href).query).get("family", []):
            name = fam.split(":")[0].replace("+", " ").strip()
            if name and name not in families:
                families.append(name)
    return families


def summarise(html: str, url: str, css_extra: str = "") -> BrandKit:
    tree = HTMLParser(html)
    kit = BrandKit(source_url=url)
    title = tree.css_first('meta[property="og:site_name"]') or tree.css_first('meta[name="application-name"]')
    kit.name = (title.attributes.get("content") or "").strip()[:80] if title else ""
    if not kit.name and (t := tree.css_first("title")):
        kit.name = re.split(r"\s[|\-–—:]\s", t.text(strip=True))[0][:80]
    css = "\n".join(n.text() for n in tree.css("style"))
    css += "\n" + "\n".join(n.attributes.get("style") or "" for n in tree.css("[style]"))
    css += "\n" + css_extra
    colors = _colors(css)
    theme = tree.css_first('meta[name="theme-color"]')
    if theme and (m := _HEX.search(theme.attributes.get("content") or "")):
        colors[_hex(m.group(1))] += 50  # the site told us
    ranked = [c for c, _ in colors.most_common(24)]
    lights = [c for c in ranked if _hls(c)[1] >= 0.9]
    darks = [c for c in ranked if _hls(c)[1] <= 0.15]
    accents = [c for c in ranked if 0.2 < _hls(c)[1] < 0.85 and _hls(c)[2] >= 0.35]
    if lights:
        kit.colors["background"] = lights[0]
    if darks:
        kit.colors["ink"] = darks[0]
    if accents:
        kit.colors["accent"] = accents[0]
    kit.palette = ranked[:8]
    fonts = _fonts(css)
    kit.google_fonts = _google_fonts(tree, url)
    named = [f for f, _ in fonts.most_common(6)] or kit.google_fonts
    mono = next((f for f in named if "mono" in f.lower() or "code" in f.lower()), None)
    serif = [f for f in named if "serif" in f.lower() and "sans" not in f.lower()]
    others = [f for f in named if f != mono]
    if others:
        kit.fonts["body"] = others[0]
        kit.fonts["display"] = serif[0] if serif else (others[1] if len(others) > 1 else others[0])
    if mono:
        kit.fonts["mono"] = mono
    logo = (
        tree.css_first('img[alt*="logo" i]')
        or tree.css_first('img[class*="logo" i]')
        or tree.css_first('[class*="logo" i] img')
    )
    if logo and (src := logo.attributes.get("src")):
        kit.logo_url = urljoin(url, src)
    og = tree.css_first('meta[property="og:image"]')
    icon = tree.css_first('link[rel~="apple-touch-icon"]') or tree.css_first('link[rel~="icon"]')
    if icon and (href := icon.attributes.get("href")):
        kit.icon_url = urljoin(url, href)
    if not kit.logo_url and og and (content := og.attributes.get("content")):
        kit.logo_url = urljoin(url, content)
        kit.notes.append("No logo image found; using the social preview image. Upload a logo for best results.")
    if not kit.colors.get("accent"):
        kit.notes.append("No clear accent colour found; set one.")
    if not kit.fonts:
        kit.notes.append("No web fonts found; set display and body fonts.")
    return kit


async def _default_fetch(url: str, accept: str, want: tuple[str, ...]) -> tuple[str, str]:
    return await fetch_page(url, accept=accept, want=want)


async def from_website(url: str, *, fetch: Fetch = _default_fetch) -> BrandKit:
    final, html = await fetch(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", ("html",))
    tree = HTMLParser(html)
    host = urlsplit(final).hostname
    sheets: list[str] = []
    for node in tree.css('link[rel~="stylesheet"]'):
        href = urljoin(final, node.attributes.get("href") or "")
        if urlsplit(href).hostname == host and href not in sheets:
            sheets.append(href)
    css_extra = ""
    for href in sheets[:2]:
        try:
            _, text = await fetch(href, "text/css,*/*;q=0.1", ("css", "text/plain"))
            css_extra += text[:400_000] + "\n"
        except SiteUnavailable:
            continue
    return summarise(html, final, css_extra)


def merge(kit: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    """Apply founder overrides (colors/fonts dicts merge; other fields replace)."""
    out = dict(kit)
    for key, value in overrides.items():
        if value is None:
            continue
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = {**out[key], **{k: v for k, v in value.items() if v}}
        else:
            out[key] = value
    return out
