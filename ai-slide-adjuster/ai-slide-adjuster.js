(function () {
  "use strict";

  if (new URLSearchParams(window.location.search).get("adjuster") === "off") return;

  const core = window.AiSlideAdjusterCore;
  if (!core) {
    console.warn("AI Slide Adjuster requires core.js before ai-slide-adjuster.js");
    return;
  }
  const adjusterScript = document.currentScript;

  const state = {
    enabled: true,
    toolbarVisible: true,
    mode: "select",
    selectedElement: null,
    slide: null,
    original: null,
    target: null,
    selector: "",
    slideId: "",
    aiId: "",
    drag: null,
    toolbarPosition: null,
    toolbarDrag: null,
    suppressToolbarClick: false,
    relations: [],
    relationSeq: 0,
    activeRelationId: null,
    lockedSlideId: "",
    pendingSlideAction: null,
  };

  const relationColors = ["#2563eb", "#059669", "#9333ea", "#ea580c", "#0891b2", "#ca8a04"];
  const TARGET_ANCHOR_Y_OFFSET = 20;
  const TOOLBAR_EDGE_PADDING = 12;
  const TOOLBAR_DRAG_THRESHOLD = 4;

  function parseBasis() {
    const deck = document.querySelector(".deck");
    const value = deck?.dataset.deckSize || "1600x900";
    const match = value.match(/^(\d+)x(\d+)$/);
    return match
      ? { width: Number(match[1]), height: Number(match[2]) }
      : { width: 1600, height: 900 };
  }

  function findActiveSlide() {
    const slides = Array.from(document.querySelectorAll(".slide"));
    return (
      slides.find((slide) => slide.classList.contains("active")) ||
      slides.find((slide) => slide.getAttribute("aria-hidden") === "false") ||
      slides.find((slide) => slide.offsetParent !== null) ||
      slides[0] ||
      document.body
    );
  }

  function getRelativeRect(rect, slideRect) {
    return {
      x: rect.left - slideRect.left,
      y: rect.top - slideRect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function toViewportRect(rect, slideRect, basis) {
    const scaleX = slideRect.width / basis.width;
    const scaleY = slideRect.height / basis.height;
    return {
      left: slideRect.left + rect.x * scaleX,
      top: slideRect.top + rect.y * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    };
  }

  function fromViewportRect(rect, slideRect, basis) {
    return core.clampRect(
      core.normalizeRect(getRelativeRect(rect, slideRect), slideRect, basis),
      basis,
    );
  }

  function rectFromPoints(a, b) {
    return {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    };
  }

  function injectStyles() {
    if (document.querySelector('link[data-ai-slide-adjuster-style]')) return;
    const href = adjusterScript?.src ? adjusterScript.src.replace(/ai-slide-adjuster\.js(?:\?.*)?$/, "ai-slide-adjuster.css") : "";
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.aiSlideAdjusterStyle = "true";
    document.head.append(link);
  }

  function icon(name) {
    const iconViewBoxes = {
      box: "0 0 100 100",
    };
    const icons = {
      adjuster: '<path d="M4 12h16"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/>',
      cursor: '<path d="M5 3l14 8-6 2-3 6z"/>',
      box: '<g fill="#000000"><rect x="13" y="13" width="14" height="14" rx="2"/><rect x="73" y="13" width="14" height="14" rx="2"/><rect x="13" y="73" width="14" height="14" rx="2"/><rect x="73" y="73" width="14" height="14" rx="2"/></g><g stroke="#000000" stroke-width="4" stroke-linecap="round"><line x1="34" y1="20" x2="38" y2="20"/><line x1="48" y1="20" x2="52" y2="20"/><line x1="62" y1="20" x2="66" y2="20"/><line x1="34" y1="80" x2="38" y2="80"/><line x1="48" y1="80" x2="52" y2="80"/><line x1="62" y1="80" x2="66" y2="80"/><line x1="20" y1="39" x2="20" y2="43"/><line x1="20" y1="57" x2="20" y2="61"/><line x1="80" y1="39" x2="80" y2="43"/><line x1="80" y1="57" x2="80" y2="61"/></g><path d="M 42 38 L 48 65 L 53 55 L 67 51 Z" fill="#000000" stroke="#000000" stroke-width="3" stroke-linejoin="round"/>',
      copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16V6a1 1 0 0 1 1-1h10"/>',
      download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
      eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.3A9.8 9.8 0 0 1 12 4c5 0 8.5 4.1 10 8a15.1 15.1 0 0 1-3 4.6"/><path d="M6.5 6.5A14.9 14.9 0 0 0 2 12c1.5 3.9 5 8 10 8 1.5 0 2.9-.4 4.1-1"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    };
    return `<svg class="asa-icon" viewBox="${iconViewBoxes[name] || "0 0 24 24"}" aria-hidden="true">${icons[name]}</svg>`;
  }

  function createUi() {
    const root = document.createElement("div");
    root.className = "asa-root";
    root.innerHTML = `
      <div class="asa-toolbar" role="toolbar" aria-label="AI 投影片調整工具">
        <button class="asa-button" type="button" data-action="toggle" aria-label="切換調整工具" aria-pressed="true" title="切換調整工具 (A)">${icon("adjuster")}</button>
        <button class="asa-button" type="button" data-mode="select" aria-label="選取元素" aria-pressed="true" title="選取元素">${icon("cursor")}</button>
        <button class="asa-button" type="button" data-mode="box" aria-label="框選區域" aria-pressed="false" title="框選區域">${icon("box")}</button>
        <button class="asa-button asa-button-copy" type="button" data-action="copy" aria-label="複製提示詞" title="複製提示詞">${icon("copy")}</button>
        <button class="asa-button" type="button" data-action="download-pdf" aria-label="下載 PDF" title="下載 PDF">${icon("download")}</button>
        <button class="asa-button" type="button" data-action="toggle-toolbar" aria-label="隱藏工具列" title="隱藏工具列 (T)">${icon("eyeOff")}</button>
      </div>
      <div class="asa-selection" hidden></div>
      <div class="asa-hover-highlight" hidden></div>
      <div class="asa-relations" aria-hidden="true"></div>
      <div class="asa-ghost"><span class="asa-measure"></span><span class="asa-resize" data-resize></span></div>
      <section class="asa-panel" aria-label="AI 調整詳細資訊">
        <header class="asa-panel-header">
          <p class="asa-panel-title">AI 投影片調整工具</p>
          <span class="asa-panel-status" data-status>就緒</span>
        </header>
        <div class="asa-panel-body">
          <div class="asa-code" data-details>點選含有 data-ai-id 的元素，或改用框選模式。</div>
          <div class="asa-field">
            <label for="asa-intent">意圖備註</label>
            <input id="asa-intent" data-intent type="text" placeholder="選填：描述想達成的視覺目標" />
          </div>
          <div class="asa-field">
            <label for="asa-prompt">產生的提示詞</label>
            <textarea id="asa-prompt" data-prompt readonly></textarea>
          </div>
        </div>
      </section>
      <section class="asa-guard-modal" aria-label="尚未複製調整的提醒" hidden>
        <div class="asa-guard-card" role="dialog" aria-modal="true">
          <p class="asa-guard-title">這張投影片有尚未複製的調整</p>
          <p class="asa-guard-copy">請先複製提示詞再切換投影片，或捨棄這張投影片上的移動關係。</p>
          <div class="asa-guard-actions">
            <button class="asa-button-text" type="button" data-guard-action="copy">複製提示詞</button>
            <button class="asa-button-text" type="button" data-guard-action="discard">捨棄並切換</button>
            <button class="asa-button-text" type="button" data-guard-action="stay">留在此頁</button>
          </div>
        </div>
      </section>
      <div class="asa-toast" role="status" data-toast>已複製</div>
    `;
    document.body.append(root);
    return {
      root,
      selection: root.querySelector(".asa-selection"),
      hoverHighlight: root.querySelector(".asa-hover-highlight"),
      relationsLayer: root.querySelector(".asa-relations"),
      ghost: root.querySelector(".asa-ghost"),
      measure: root.querySelector(".asa-measure"),
      details: root.querySelector("[data-details]"),
      prompt: root.querySelector("[data-prompt]"),
      intent: root.querySelector("[data-intent]"),
      status: root.querySelector("[data-status]"),
      toast: root.querySelector("[data-toast]"),
      toolbar: root.querySelector(".asa-toolbar"),
      modeButtons: Array.from(root.querySelectorAll("[data-mode]")),
      toggle: root.querySelector("[data-action='toggle']"),
      toolbarToggle: root.querySelector("[data-action='toggle-toolbar']"),
      copy: root.querySelector("[data-action='copy']"),
      download: root.querySelector("[data-action='download-pdf']"),
      guardModal: root.querySelector(".asa-guard-modal"),
    };
  }

  function renderRect(node, rect) {
    Object.assign(node.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  function setHidden(node, hidden) {
    node.hidden = hidden;
  }

  function selectedTagName() {
    return state.selectedElement?.tagName?.toLowerCase() || "*";
  }

  function relationColor(index) {
    return relationColors[index % relationColors.length];
  }

  function hasRelations(slideId = state.lockedSlideId) {
    return state.relations.some((relation) => !slideId || relation.slideId === slideId);
  }

  function activeRelation() {
    return state.relations.find((relation) => relation.id === state.activeRelationId) || state.relations[0] || null;
  }

  function syncLegacyState(relation) {
    state.selectedElement = relation?.element || null;
    state.slide = relation?.slide || null;
    state.original = relation?.original || null;
    state.target = relation?.target || null;
    state.selector = relation?.selector || "";
    state.slideId = relation?.slideId || "";
    state.aiId = relation?.aiId || "";
  }

  function relationPrompt(relation, ui) {
    return core.createPrompt({
      slideId: relation.slideId,
      aiId: relation.aiId,
      selector: relation.selector,
      basis: parseBasis(),
      original: relation.original,
      target: relation.target,
      intent: ui.intent.value,
    });
  }

  function buildPrompt(ui) {
    if (!state.relations.length) return "";
    if (state.relations.length === 1) return relationPrompt(state.relations[0], ui);
    return state.relations
      .map((relation, index) => [`調整項目 ${index + 1} / ${state.relations.length}`, "", relationPrompt(relation, ui)].join("\n"))
      .join("\n\n---\n\n");
  }

  function updatePanel(ui) {
    const relation = activeRelation();
    syncLegacyState(relation);
    if (!relation) {
      ui.details.textContent = "點選含有 data-ai-id 的元素，或改用框選模式。";
      ui.prompt.value = "";
      ui.status.textContent = state.enabled ? "就緒" : "關閉";
      return;
    }
    const delta = core.computeDelta(relation.original, relation.target);
    ui.details.textContent = [
      `移動關係：${state.relations.length}`,
      `目前作用元素：${relation.aiId || "手動框選"}`,
      `投影片：${relation.slideId || "未知頁面"}`,
      `選擇器：${relation.selector || "手動框選區域"}`,
      `原始位置：x=${relation.original.x}, y=${relation.original.y}, w=${relation.original.width}, h=${relation.original.height}`,
      `目標位置：x=${relation.target.x}, y=${relation.target.y}, w=${relation.target.width}, h=${relation.target.height}`,
      `調整差值：dx=${delta.dx}, dy=${delta.dy}, dw=${delta.dw}, dh=${delta.dh}`,
    ].join("\n");
    ui.prompt.value = buildPrompt(ui);
    ui.status.textContent = state.mode === "box" ? "框選模式" : "選取模式";
  }

  function setMode(ui, mode) {
    state.mode = mode;
    ui.modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    updatePanel(ui);
  }

  function setEnabled(ui, enabled) {
    state.enabled = enabled;
    ui.root.classList.toggle("is-disabled", !enabled);
    ui.toggle.setAttribute("aria-pressed", String(enabled));
    updatePanel(ui);
  }

  function setToolbarVisible(ui, visible) {
    state.toolbarVisible = visible;
    ui.root.classList.toggle("is-toolbar-hidden", !visible);
    ui.toolbarToggle.setAttribute("aria-label", visible ? "隱藏工具列" : "顯示工具列");
    ui.toolbarToggle.setAttribute("title", visible ? "隱藏工具列 (T)" : "顯示工具列 (T)");
    if (!visible) showToast(ui, "工具列已隱藏，按 T 可重新顯示。");
  }

  function isAdjusterInteractive() {
    return state.enabled && state.toolbarVisible;
  }

  function clampToolbarPosition(toolbar, left, top) {
    const maxLeft = Math.max(TOOLBAR_EDGE_PADDING, window.innerWidth - toolbar.offsetWidth - TOOLBAR_EDGE_PADDING);
    const maxTop = Math.max(TOOLBAR_EDGE_PADDING, window.innerHeight - toolbar.offsetHeight - TOOLBAR_EDGE_PADDING);
    return {
      left: Math.min(Math.max(left, TOOLBAR_EDGE_PADDING), maxLeft),
      top: Math.min(Math.max(top, TOOLBAR_EDGE_PADDING), maxTop),
    };
  }

  function applyToolbarPosition(ui, left, top) {
    const next = clampToolbarPosition(ui.toolbar, left, top);
    state.toolbarPosition = next;
    ui.toolbar.style.left = `${next.left}px`;
    ui.toolbar.style.top = `${next.top}px`;
    ui.toolbar.style.right = "auto";
  }

  function startToolbarDrag(ui, event) {
    if (event.button !== 0) return;
    if (event.target.closest(".asa-button")) return;
    const rect = ui.toolbar.getBoundingClientRect();
    state.toolbarDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      active: false,
    };
    ui.toolbar.setPointerCapture?.(event.pointerId);
  }

  function updateToolbarDrag(ui, event) {
    const drag = state.toolbarDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active && Math.hypot(dx, dy) < TOOLBAR_DRAG_THRESHOLD) return;
    if (!drag.active) {
      drag.active = true;
      ui.toolbar.classList.add("is-dragging");
    }
    event.preventDefault();
    applyToolbarPosition(ui, drag.startLeft + dx, drag.startTop + dy);
  }

  function finishToolbarDrag(ui, event) {
    const drag = state.toolbarDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      event.preventDefault();
      state.suppressToolbarClick = true;
      window.setTimeout(() => {
        state.suppressToolbarClick = false;
      }, 0);
    }
    ui.toolbar.classList.remove("is-dragging");
    ui.toolbar.releasePointerCapture?.(event.pointerId);
    state.toolbarDrag = null;
  }

  function renderHoverHighlight(ui, element) {
    if (!isAdjusterInteractive() || state.mode !== "select" || state.drag || !element || element.closest(".asa-root")) {
      setHidden(ui.hoverHighlight, true);
      return;
    }
    const activeSlide = findActiveSlide();
    if (!activeSlide.contains(element)) {
      setHidden(ui.hoverHighlight, true);
      return;
    }
    renderRect(ui.hoverHighlight, element.getBoundingClientRect());
    setHidden(ui.hoverHighlight, false);
  }

  function createBox(className, relation, rect) {
    const node = document.createElement("div");
    node.className = className;
    node.dataset.relationId = relation.id;
    node.style.setProperty("--asa-relation-color", relation.color);
    renderRect(node, rect);
    return node;
  }

  function targetCenter(targetRect) {
    return {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };
  }

  function targetAnchor(targetRect) {
    const center = targetCenter(targetRect);
    return {
      x: center.x,
      y: center.y + TARGET_ANCHOR_Y_OFFSET,
    };
  }

  function createArrow(relation, originalRect, targetRect) {
    const originalCenter = {
      x: originalRect.left + originalRect.width / 2,
      y: originalRect.top + originalRect.height / 2,
    };
    const targetAnchorPoint = targetAnchor(targetRect);
    const pad = 18;
    const left = Math.min(originalCenter.x, targetAnchorPoint.x) - pad;
    const top = Math.min(originalCenter.y, targetAnchorPoint.y) - pad;
    const width = Math.max(34, Math.abs(targetAnchorPoint.x - originalCenter.x) + pad * 2);
    const height = Math.max(34, Math.abs(targetAnchorPoint.y - originalCenter.y) + pad * 2);
    const x1 = originalCenter.x - left;
    const y1 = originalCenter.y - top;
    const x2 = targetAnchorPoint.x - left;
    const y2 = targetAnchorPoint.y - top;
    const node = document.createElement("div");
    node.className = "asa-relation-arrow";
    node.dataset.relationId = relation.id;
    node.style.setProperty("--asa-relation-color", relation.color);
    renderRect(node, { left, top, width, height });
    node.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="asa-arrow-${relation.id}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z"></path>
          </marker>
        </defs>
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#asa-arrow-${relation.id})"></line>
      </svg>
    `;
    return node;
  }

  function renderRelationActions(relation, targetRect) {
    const actionsAnchor = targetCenter(targetRect);
    const actionsLeft = actionsAnchor.x;
    const actionsTop = actionsAnchor.y;
    const actionsWidth = 84;
    return `
      <div class="asa-relation-actions" data-relation-id="${relation.id}" style="--asa-actions-left: ${actionsLeft}px; --asa-actions-top: ${actionsTop}px; --asa-actions-width: ${actionsWidth}px;">
        <button class="asa-relation-action asa-relation-action-copy" type="button" data-relation-action="copy" data-relation-id="${relation.id}" aria-label="複製這筆提示詞" title="複製這筆提示詞">${icon("copy")}</button>
        <button class="asa-relation-action asa-relation-action-delete" type="button" data-relation-action="delete" data-relation-id="${relation.id}" aria-label="刪除移動關係" title="刪除移動關係">${icon("trash")}</button>
      </div>
    `;
  }

  function renderRelations(ui) {
    ui.relationsLayer.replaceChildren();
    ui.ghost.classList.remove("is-visible");
    if (!state.relations.length) {
      setHidden(ui.selection, true);
      updatePanel(ui);
      return;
    }
    const basis = parseBasis();
    state.relations.forEach((relation) => {
      const slideRect = relation.slide.getBoundingClientRect();
      const originalRect = toViewportRect(relation.original, slideRect, basis);
      const targetRect = toViewportRect(relation.target, slideRect, basis);
      const originalBox = createBox("asa-relation-original", relation, originalRect);
      const targetBox = createBox("asa-relation-target", relation, targetRect);
      const arrow = createArrow(relation, originalRect, targetRect);
      const actions = document.createElement("div");
      actions.innerHTML = renderRelationActions(relation, targetRect);
      if (relation.id === state.activeRelationId) targetBox.classList.add("is-active");
      targetBox.innerHTML = `<span class="asa-measure">${relation.target.x}, ${relation.target.y} / ${relation.target.width} x ${relation.target.height}</span><span class="asa-resize" data-resize></span>`;
      ui.relationsLayer.append(originalBox, arrow, targetBox, actions.firstElementChild);
    });
    updatePanel(ui);
  }

  function removeRelation(ui, id) {
    state.relations = state.relations.filter((relation) => relation.id !== id);
    if (state.activeRelationId === id) state.activeRelationId = state.relations[0]?.id || null;
    if (!state.relations.length) {
      state.lockedSlideId = "";
      syncLegacyState(null);
    }
    renderRelations(ui);
  }

  function addRelation(ui, element, viewportRect) {
    if (!isAdjusterInteractive()) return;
    const basis = parseBasis();
    const slide = findActiveSlide();
    const slideId = slide.dataset.slideId || "";
    if (hasRelations(state.lockedSlideId) && state.lockedSlideId && state.lockedSlideId !== slideId) {
      guardSlideNavigation(ui, null);
      return;
    }
    const slideRect = slide.getBoundingClientRect();
    const normalized = fromViewportRect(viewportRect, slideRect, basis);
    const target = { ...normalized };
    const aiId = element?.dataset.aiId || "";
    const existing = aiId ? state.relations.find((relation) => relation.slideId === slideId && relation.aiId === aiId) : null;
    if (existing) {
      state.activeRelationId = existing.id;
      renderRelations(ui);
      return;
    }
    state.selectedElement = element;
    const selector = aiId
      ? core.makeCssSelector({ slideId, aiId, tagName: selectedTagName() })
      : "";
    const relation = {
      id: `relation-${++state.relationSeq}`,
      color: relationColor(state.relations.length),
      element,
      slide,
      original: normalized,
      target,
      slideId,
      aiId,
      selector,
    };
    state.relations.push(relation);
    state.activeRelationId = relation.id;
    state.lockedSlideId = state.lockedSlideId || slideId;
    setHidden(ui.selection, true);
    setHidden(ui.hoverHighlight, true);
    renderRelations(ui);
  }

  function showToast(ui, text) {
    ui.toast.textContent = text;
    ui.toast.classList.add("is-visible");
    window.setTimeout(() => ui.toast.classList.remove("is-visible"), 1300);
  }

  async function copyPrompt(ui) {
    const prompt = buildPrompt(ui);
    if (!prompt) {
      showToast(ui, "請先選取元素或框選區域");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      ui.prompt.select();
      document.execCommand("copy");
    }
    showToast(ui, "已複製提示詞");
  }

  async function copyRelationPrompt(ui, relationId) {
    const relation = state.relations.find((item) => item.id === relationId);
    if (!relation) {
      showToast(ui, "找不到這組移動關係");
      return;
    }
    const prompt = relationPrompt(relation, ui);
    ui.prompt.value = prompt;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      ui.prompt.select();
      document.execCommand("copy");
    }
    showToast(ui, "已複製單筆提示詞");
  }

  function downloadPdf(ui) {
    showToast(ui, "請在列印視窗選擇儲存為 PDF。");
    document.body.classList.add("asa-printing-pdf");
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove("asa-printing-pdf");
      updatePanel(ui);
    }, 60);
  }

  function startRelationDrag(ui, event, targetBox, resize) {
    const relation = state.relations.find((item) => item.id === targetBox.dataset.relationId);
    if (!relation) return;
    event.preventDefault();
    event.stopPropagation();
    state.activeRelationId = relation.id;
    const rect = targetBox.getBoundingClientRect();
    state.drag = {
      type: resize ? "resize" : "move",
      relationId: relation.id,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    };
    targetBox.setPointerCapture(event.pointerId);
    renderRelations(ui);
  }

  function updateRelationDrag(ui, event) {
    if (!state.drag || !["move", "resize"].includes(state.drag.type)) return;
    const relation = state.relations.find((item) => item.id === state.drag.relationId);
    if (!relation) return;
    const basis = parseBasis();
    const slideRect = relation.slide.getBoundingClientRect();
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    const next = { ...state.drag.startRect };
    if (state.drag.type === "move") {
      next.left += dx;
      next.top += dy;
    } else {
      next.width = Math.max(8, next.width + dx);
      next.height = Math.max(8, next.height + dy);
    }
    relation.target = fromViewportRect(next, slideRect, basis);
    renderRelations(ui);
  }

  function stopRelationDrag() {
    state.drag = null;
  }

  function startBoxSelection(ui, event) {
    if (!isAdjusterInteractive() || state.mode !== "box") return;
    if (event.target.closest(".asa-root")) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY };
    state.drag = { type: "box", startX: start.x, startY: start.y };
    renderRect(ui.selection, { left: start.x, top: start.y, width: 1, height: 1 });
    ui.selection.hidden = false;
  }

  function updateBoxSelection(ui, event) {
    if (state.drag?.type !== "box") return;
    const rect = rectFromPoints({ x: state.drag.startX, y: state.drag.startY }, { x: event.clientX, y: event.clientY });
    renderRect(ui.selection, rect);
  }

  function finishBoxSelection(ui, event) {
    if (state.drag?.type !== "box") return;
    const rect = rectFromPoints({ x: state.drag.startX, y: state.drag.startY }, { x: event.clientX, y: event.clientY });
    state.drag = null;
    if (rect.width < 6 || rect.height < 6) return;
    addRelation(ui, null, rect);
  }

  function closeGuard(ui) {
    state.pendingSlideAction = null;
    ui.root.classList.remove("is-guard-open");
    setHidden(ui.guardModal, true);
  }

  function guardSlideNavigation(ui, nextAction) {
    if (!hasRelations(state.lockedSlideId)) return false;
    state.pendingSlideAction = nextAction;
    ui.root.classList.add("is-guard-open");
    setHidden(ui.guardModal, false);
    return true;
  }

  function clearRelations(ui) {
    state.relations = [];
    state.activeRelationId = null;
    state.lockedSlideId = "";
    syncLegacyState(null);
    renderRelations(ui);
  }

  function isSlideNavigationKey(event) {
    return ["ArrowRight", "ArrowLeft", "PageDown", "PageUp"].includes(event.key);
  }

  function installSlideGuard(ui) {
    const originalShowSlide = window.showSlide;
    if (typeof originalShowSlide === "function") {
      window.showSlide = function guardedShowSlide(index, ...args) {
        const slides = Array.from(document.querySelectorAll(".slide"));
        const activeIndex = slides.findIndex((slide) => slide.classList.contains("active"));
        const requestedIndex = Math.max(0, Math.min(Number(index), slides.length - 1));
        if (requestedIndex !== activeIndex && hasRelations(state.lockedSlideId)) {
          guardSlideNavigation(ui, () => originalShowSlide.call(window, requestedIndex, ...args));
          return;
        }
        return originalShowSlide.call(window, index, ...args);
      };
    }

    document.addEventListener("click", (event) => {
      const control = event.target.closest(".deck-controls button");
      if (!control || !hasRelations(state.lockedSlideId)) return;
      event.preventDefault();
      event.stopPropagation();
      const nextAction = () => control.click();
      guardSlideNavigation(ui, nextAction);
    }, true);

    document.addEventListener("keydown", (event) => {
      if (!isSlideNavigationKey(event) || !hasRelations(state.lockedSlideId)) return;
      event.preventDefault();
      event.stopPropagation();
      guardSlideNavigation(ui, null);
    }, true);
  }

  function init() {
    injectStyles();
    const ui = createUi();

    ui.root.addEventListener("click", (event) => {
      if (state.suppressToolbarClick && event.target.closest(".asa-toolbar")) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const mode = event.target.closest("[data-mode]")?.dataset.mode;
      const action = event.target.closest("[data-action]")?.dataset.action;
      const guardAction = event.target.closest("[data-guard-action]")?.dataset.guardAction;
      if (mode) setMode(ui, mode);
      if (action === "toggle") setEnabled(ui, !state.enabled);
      if (action === "toggle-toolbar") setToolbarVisible(ui, !state.toolbarVisible);
      if (action === "copy") copyPrompt(ui);
      if (action === "download-pdf") downloadPdf(ui);
      if (guardAction === "copy") copyPrompt(ui);
      if (guardAction === "stay") closeGuard(ui);
      if (guardAction === "discard") {
        const pending = state.pendingSlideAction;
        clearRelations(ui);
        closeGuard(ui);
        if (pending) pending();
      }
    });

    ui.intent.addEventListener("input", () => updatePanel(ui));

    document.addEventListener("click", (event) => {
      if (!isAdjusterInteractive() || state.mode !== "select") return;
      if (event.target.closest(".asa-root")) return;
      const element = event.target.closest("[data-ai-id]");
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      addRelation(ui, element, element.getBoundingClientRect());
    }, true);

    document.addEventListener("pointerdown", (event) => startBoxSelection(ui, event), true);
    document.addEventListener("pointermove", (event) => {
      updateToolbarDrag(ui, event);
      updateBoxSelection(ui, event);
      updateRelationDrag(ui, event);
      if (!state.drag && isAdjusterInteractive()) renderHoverHighlight(ui, event.target.closest?.("[data-ai-id]"));
      const hoveredRelation = event.target.closest?.(".asa-relation-target, .asa-relation-arrow, .asa-relation-actions");
      const hoveredRelationId = hoveredRelation?.dataset.relationId || "";
      ui.relationsLayer.querySelectorAll(".asa-relation-target").forEach((target) => {
        target.classList.toggle("is-hovered", target.dataset.relationId === hoveredRelationId);
      });
      ui.relationsLayer.querySelectorAll(".asa-relation-actions").forEach((actions) => {
        actions.classList.toggle("is-hovered", actions.dataset.relationId === hoveredRelationId);
      });
    }, true);
    document.addEventListener("pointerup", (event) => {
      finishToolbarDrag(ui, event);
      finishBoxSelection(ui, event);
      stopRelationDrag();
    }, true);
    document.addEventListener("pointercancel", (event) => {
      finishToolbarDrag(ui, event);
      stopRelationDrag();
    }, true);

    ui.toolbar.addEventListener("pointerdown", (event) => startToolbarDrag(ui, event));

    ui.relationsLayer.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-relation-action]");
      if (!actionButton) return;
      event.preventDefault();
      event.stopPropagation();
      if (actionButton.dataset.relationAction === "copy") copyRelationPrompt(ui, actionButton.dataset.relationId);
      if (actionButton.dataset.relationAction === "delete") removeRelation(ui, actionButton.dataset.relationId);
    });

    ui.relationsLayer.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-relation-action]")) return;
      const targetBox = event.target.closest(".asa-relation-target");
      if (!targetBox) return;
      startRelationDrag(ui, event, targetBox, Boolean(event.target.closest("[data-resize]")));
    });

    window.addEventListener("resize", () => {
      if (state.toolbarPosition) applyToolbarPosition(ui, state.toolbarPosition.left, state.toolbarPosition.top);
      renderRelations(ui);
    });

    function isTypingTarget(target) {
      return target.closest("input, textarea, select, [contenteditable='true']");
    }

    document.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "a" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setEnabled(ui, !state.enabled);
      }
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setToolbarVisible(ui, !state.toolbarVisible);
      }
      if (event.key === "Escape") setEnabled(ui, false);
    });

    installSlideGuard(ui);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
