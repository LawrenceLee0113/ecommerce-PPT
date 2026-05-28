"use strict";

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function roundPx(value) {
  return Math.round(Number(value) || 0);
}

function normalizeRect(rect, viewport, basis) {
  const scaleX = basis.width / viewport.width;
  const scaleY = basis.height / viewport.height;
  return {
    x: roundPx(rect.x * scaleX),
    y: roundPx(rect.y * scaleY),
    width: roundPx(rect.width * scaleX),
    height: roundPx(rect.height * scaleY),
  };
}

function clampRect(rect, basis) {
  const width = Math.max(1, Math.min(roundPx(rect.width), basis.width));
  const height = Math.max(1, Math.min(roundPx(rect.height), basis.height));
  return {
    x: Math.max(0, Math.min(roundPx(rect.x), basis.width - width)),
    y: Math.max(0, Math.min(roundPx(rect.y), basis.height - height)),
    width,
    height,
  };
}

function computeDelta(original, target) {
  return {
    dx: roundPx(target.x - original.x),
    dy: roundPx(target.y - original.y),
    dw: roundPx(target.width - original.width),
    dh: roundPx(target.height - original.height),
  };
}

function formatPercent(value, total) {
  return `${round((value / total) * 100).toFixed(1)}%`;
}

function toPercentRect(rect, basis) {
  return {
    x: formatPercent(rect.x, basis.width),
    y: formatPercent(rect.y, basis.height),
    width: formatPercent(rect.width, basis.width),
    height: formatPercent(rect.height, basis.height),
  };
}

function cssEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function makeCssSelector({ slideId, aiId, tagName = "*" }) {
  const safeTag = String(tagName || "*").toLowerCase();
  const element = aiId ? `${safeTag}[data-ai-id="${cssEscape(aiId)}"]` : safeTag;
  return slideId
    ? `.slide[data-slide-id="${cssEscape(slideId)}"] ${element}`
    : element;
}

function formatRect(rect) {
  return `x=${roundPx(rect.x)}, y=${roundPx(rect.y)}, w=${roundPx(rect.width)}, h=${roundPx(rect.height)}`;
}

function formatPercentLine(rect, basis) {
  const percent = toPercentRect(rect, basis);
  return `x%=${percent.x}, y%=${percent.y}, w%=${percent.width}, h%=${percent.height}`;
}

function signed(value) {
  const number = roundPx(value);
  return number > 0 ? `+${number}` : String(number);
}

function createPrompt({ slideId, aiId, selector, basis, original, target, intent = "" }) {
  const delta = computeDelta(original, target);
  const lines = [
    "請調整 HTML 簡報中的元素。",
    "",
    `頁面：${slideId || "未知頁面"}`,
    `元素：${aiId || "手動框選"}`,
    `選擇器：${selector || "未提供"}`,
    `座標基準：${basis.width}x${basis.height}，原點為該投影片左上角`,
    "",
    "目前位置：",
    formatRect(original),
    formatPercentLine(original, basis),
    "",
    "目標位置：",
    formatRect(target),
    formatPercentLine(target, basis),
    "",
    "調整差值：",
    `dx=${signed(delta.dx)}, dy=${signed(delta.dy)}, dw=${signed(delta.dw)}, dh=${signed(delta.dh)}`,
  ];

  if (intent.trim()) {
    lines.push("", "人類意圖：", intent.trim());
  }

  lines.push(
    "",
    "修改限制：",
    "請優先修改既有 CSS 類別、版面容器，或該投影片的局部樣式。",
    "避免直接把所有元素改成絕對定位。",
    "不要改文字內容，除非人類意圖明確要求。",
    `請把變更範圍限制在 ${slideId || "目前頁面"}；只有當同一修正應套用到所有使用該元件的投影片時，才調整共用元件。`,
  );

  return lines.join("\n");
}

const api = {
  clampRect,
  computeDelta,
  createPrompt,
  makeCssSelector,
  normalizeRect,
  toPercentRect,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof window !== "undefined") {
  window.AiSlideAdjusterCore = api;
}
