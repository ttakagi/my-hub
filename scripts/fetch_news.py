#!/usr/bin/env python3
"""Daily news fetcher for GitHub Actions.

Fetches RSS feeds for each Hub, translates English articles to Japanese,
enriches articles with full-text body and OG images, then writes JSON to data/.
"""

import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import feedparser
import trafilatura
from deep_translator import GoogleTranslator

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ─── Hub 定義 ─────────────────────────────────────────────────────────────────

HUBS = {
    "ai": {
        "name": "AI Hub",
        "feeds": [
            {"name": "TechCrunch AI",   "url": "https://techcrunch.com/category/artificial-intelligence/feed/",   "icon": "🤖", "lang": "en"},
            {"name": "The Verge AI",    "url": "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml","icon": "⚡", "lang": "en"},
            {"name": "VentureBeat AI",  "url": "https://venturebeat.com/ai/feed/",                                "icon": "🚀", "lang": "en"},
            {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/",                          "icon": "🔬", "lang": "en"},
            {"name": "AI News",         "url": "https://www.artificialintelligence-news.com/feed/",               "icon": "📰", "lang": "en"},
            {"name": "ITmedia AI+",     "url": "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",                   "icon": "🇯🇵", "lang": "ja"},
            {"name": "Ledge.ai",        "url": "https://ledge.ai/feed/",                                         "icon": "🧠", "lang": "ja"},
            {"name": "AINOW",           "url": "https://ainow.ai/feed/",                                         "icon": "🌸", "lang": "ja"},
            {"name": "ASCII AI",        "url": "https://ascii.jp/rss.xml",                                       "icon": "📡", "lang": "ja"},
        ],
    },
    "design": {
        "name": "Design Hub",
        "feeds": [
            {"name": "Smashing Magazine",   "url": "https://www.smashingmagazine.com/feed/",              "icon": "💥", "lang": "en"},
            {"name": "Design Milk",         "url": "https://design-milk.com/feed/",                       "icon": "🥛", "lang": "en"},
            {"name": "Dezeen",              "url": "https://www.dezeen.com/feed/",                        "icon": "🏛",  "lang": "en"},
            {"name": "Web Designer Depot",  "url": "https://www.webdesignerdepot.com/feed/",              "icon": "🎨", "lang": "en"},
            {"name": "UX Collective",       "url": "https://uxdesign.cc/feed",                            "icon": "✏️", "lang": "en"},
            {"name": "Creative Bloq",       "url": "https://www.creativebloq.com/feeds/all",              "icon": "🖌",  "lang": "en"},
            {"name": "Web担当者Forum",       "url": "https://webtan.impress.co.jp/rss.xml",               "icon": "🇯🇵", "lang": "ja"},
            {"name": "AXIS Web",            "url": "https://www.axismag.jp/feed/",                        "icon": "🎭", "lang": "ja"},
            {"name": "Goodpatch Blog",      "url": "https://goodpatch.com/blog/feed/",                    "icon": "✏️", "lang": "ja"},
        ],
    },
    "screen": {
        "name": "Screen Hub",
        "feeds": [
            {"name": "Motionographer",        "url": "https://motionographer.com/feed/",              "icon": "🎬", "lang": "en"},
            {"name": "Sixteen:Nine",          "url": "https://www.sixteen-nine.net/feed/",            "icon": "🖥",  "lang": "en"},
            {"name": "Digital Signage Today", "url": "https://www.digitalsignagetoday.com/rss/",      "icon": "📺", "lang": "en"},
            {"name": "Stash Media",           "url": "https://stashmedia.tv/feed/",                   "icon": "📡", "lang": "en"},
            {"name": "Mogura VR",             "url": "https://www.moguravr.com/feed/",                "icon": "🇯🇵", "lang": "ja"},
        ],
    },
    "gameui": {
        "name": "Game UI Hub",
        "feeds": [
            {"name": "Game Developer", "url": "https://www.gamedeveloper.com/rss.xml",        "icon": "🎮", "lang": "en"},
            {"name": "80 Level",       "url": "https://80.lv/feed/",                          "icon": "🔥", "lang": "en"},
            {"name": "Polygon",        "url": "https://www.polygon.com/rss/index.xml",        "icon": "🕹",  "lang": "en"},
            {"name": "4Gamer",         "url": "https://www.4gamer.net/rss/index.xml",         "icon": "🇯🇵", "lang": "ja"},
            {"name": "IGN Japan",      "url": "https://jp.ign.com/feed.xml",                  "icon": "⚔️", "lang": "ja"},
        ],
    },
}


# ─── ユーティリティ ────────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    """HTML タグを除去してプレーンテキストにする。"""
    return re.sub(r"<[^>]+>", "", html or "").strip()


def _rss_image(entry) -> str | None:
    """RSS エントリから画像 URL を抽出する。"""
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        return entry.media_thumbnail[0].get("url")
    if hasattr(entry, "media_content") and entry.media_content:
        for m in entry.media_content:
            if m.get("url") and "image" in m.get("type", "image"):
                return m["url"]
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            if "image" in enc.get("type", ""):
                return enc.get("href") or enc.get("url")
    # summary 中の <img src=...> を探す
    summary = getattr(entry, "summary", "") or ""
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
    if m:
        return m.group(1)
    return None


def _save(hub_id: str, data: dict) -> None:
    """JSON をファイルに書き出す。"""
    path = DATA_DIR / f"{hub_id}_news.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Saved {path.name} ({data['count']} articles)")


# ─── 本文取得（trafilatura） ─────────────────────────────────────────────────

def _fetch_one(article: dict) -> tuple[str | None, str | None]:
    """1 記事を取得して (body_text, og_image) を返す。"""
    try:
        downloaded = trafilatura.fetch_url(article["url"])
        if not downloaded:
            return None, None
        text = trafilatura.extract(downloaded) or ""
        meta = trafilatura.extract_metadata(downloaded)
        og_image = meta.image if meta and meta.image else None
        body_text = text[:450].strip() if text else ""
        return body_text, og_image
    except Exception:
        return None, None


# ─── 記事エンリッチ ────────────────────────────────────────────────────────────

def _enrich_articles(articles: list[dict]) -> list[dict]:
    """全記事に OG 画像・本文要約（日本語）を付与する。"""
    need = [i for i, a in enumerate(articles) if not a.get("image_url") and not a.get("body_ja")]
    if not need:
        print(f"  (all articles already enriched, skipping)")
        return articles

    print(f"  Enriching {len(need)} articles...")

    # 並列で本文 + OG 画像を取得
    results: dict[int, tuple] = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        future_map = {ex.submit(_fetch_one, articles[i]): i for i in need}
        for future in as_completed(future_map, timeout=120):
            idx = future_map[future]
            try:
                body, img = future.result(timeout=0)
                results[idx] = (body, img)
            except Exception:
                results[idx] = (None, None)

    # OG 画像を設定
    for idx, (body, img) in results.items():
        if img:
            articles[idx]["image_url"] = img

    # 英語本文をバッチ翻訳
    en_body_idx = [
        i for i in need
        if articles[i]["lang"] == "en" and results.get(i, (None,))[0]
    ]
    if en_body_idx:
        try:
            translator = GoogleTranslator(source="en", target="ja")
            bodies = [results[i][0] for i in en_body_idx]
            CHUNK = 20
            translated: list[str] = []
            for start in range(0, len(bodies), CHUNK):
                translated += translator.translate_batch(bodies[start:start + CHUNK])
            for idx, ja_body in zip(en_body_idx, translated):
                if ja_body:
                    articles[idx]["body_ja"] = ja_body
            print(f"    → {len(en_body_idx)} bodies translated (EN→JA)")
        except Exception as e:
            print(f"    Translation error (body): {e}")

    # 日本語記事の本文はそのまま保存
    ja_body_idx = [
        i for i in need
        if articles[i]["lang"] == "ja" and results.get(i, (None,))[0]
    ]
    for i in ja_body_idx:
        body = results[i][0]
        if body:
            articles[i]["body_ja"] = body

    return articles


# ─── Hub フェッチ ─────────────────────────────────────────────────────────────

def fetch_hub(hub_id: str) -> dict:
    """RSS を取得・翻訳・エンリッチして data/{hub_id}_news.json に書き出す。"""
    hub = HUBS[hub_id]
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Fetching {hub['name']}...")

    articles: list[dict] = []

    for feed_info in hub["feeds"]:
        try:
            feed = feedparser.parse(feed_info["url"])
            for entry in feed.entries[:10]:
                pub_date = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    pub_date = datetime(*entry.published_parsed[:6]).isoformat()
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    pub_date = datetime(*entry.updated_parsed[:6]).isoformat()

                summary = getattr(entry, "summary", "") or ""

                # RSS エントリから画像を先取りしておく（OG 取得失敗時のフォールバック）
                rss_img = _rss_image(entry)

                article: dict = {
                    "title":     getattr(entry, "title", ""),
                    "url":       getattr(entry, "link", ""),
                    "summary":   summary[:300] if summary else "",
                    "source":    feed_info["name"],
                    "icon":      feed_info["icon"],
                    "lang":      feed_info.get("lang", "en"),
                    "published": pub_date,
                }
                if rss_img:
                    article["image_url"] = rss_img

                articles.append(article)
        except Exception as e:
            print(f"  Error fetching {feed_info['name']}: {e}")

    articles.sort(key=lambda x: x.get("published") or "", reverse=True)
    print(f"  Fetched {len(articles)} articles from RSS")

    # ── 英語記事のタイトル＋要約を翻訳 ─────────────────────────────────────
    en_idx = [i for i, a in enumerate(articles) if a["lang"] == "en"]
    if en_idx:
        try:
            translator = GoogleTranslator(source="en", target="ja")
            SEP = " |SEP| "
            combined = [
                articles[i]["title"] + SEP + _strip_html(articles[i]["summary"])[:180]
                for i in en_idx
            ]
            CHUNK = 30
            translated_combined: list[str] = []
            for start in range(0, len(combined), CHUNK):
                translated_combined += translator.translate_batch(combined[start:start + CHUNK])
            for idx, result in zip(en_idx, translated_combined):
                if not result:
                    continue
                parts = result.split("|SEP|")
                articles[idx]["title_ja"]   = parts[0].strip()
                articles[idx]["summary_ja"] = parts[1].strip() if len(parts) > 1 else ""
            print(f"  → {len(en_idx)} titles+summaries translated (EN→JA)")
        except Exception as e:
            print(f"  Translation error (title/summary): {e}")

    # ── エンリッチ（本文 + OG 画像） ────────────────────────────────────────
    articles = _enrich_articles(articles)

    data = {
        "articles":     articles,
        "last_updated": datetime.now().isoformat(),
        "count":        len(articles),
    }
    _save(hub_id, data)
    return data


# ─── エントリポイント ─────────────────────────────────────────────────────────

def main() -> None:
    print(f"=== fetch_news.py start at {datetime.now().isoformat()} ===")
    for hub_id in HUBS:
        try:
            fetch_hub(hub_id)
        except Exception as e:
            print(f"[ERROR] {hub_id}: {e}")
    print(f"\n=== fetch_news.py done at {datetime.now().isoformat()} ===")


if __name__ == "__main__":
    main()
