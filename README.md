# Ecommerce Luxury Editorial Deck

這是一份獨立 HTML PPT 專案，主題是「超商型智慧 3D 列印電商企劃」。

它使用固定 `1600 x 900` 簡報舞台，風格為米白、留白多、細線框架、低彩度文字與精品目錄感的 editorial presentation。

## Files

- `index.html`: 19 頁 HTML 簡報
- `deck.css`: 簡報版面與視覺樣式
- `assets/`: 簡報圖片素材
- `ai-slide-adjuster/`: AI Slide Adjuster 工具
- `ecommerce-luxury-editorial.pdf`: PDF 匯出版

## Preview

```sh
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/
```

Clean preview without adjuster:

```text
http://127.0.0.1:4173/?adjuster=off
```

## Verify

```sh
node /Users/lawrencelee0113/.codex/skills/html-ppt-workflow/scripts/verify-deck.mjs /Users/lawrencelee0113/workspace/ecommerce-luxury-editorial --pdf /Users/lawrencelee0113/workspace/ecommerce-luxury-editorial/ecommerce-luxury-editorial.pdf
```

Expected result:

- portable `1600x900` HTML PPT deck
- 19 PDF pages
- each PDF page is 16:9
