const VIEWPORT_PADDING = 10;
const TOOLTIP_GAP = 12;

let tooltipEl = null;
let tooltipBodyEl = null;
let tooltipArrowEl = null;
let activeTarget = null;
let hideTimer = null;

function ensureTooltipElement() {
  if (tooltipEl) {
    return;
  }

  tooltipEl = document.createElement("div");
  tooltipEl.className = "floating-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.setAttribute("aria-hidden", "true");

  tooltipBodyEl = document.createElement("div");
  tooltipBodyEl.className = "floating-tooltip__body";

  tooltipArrowEl = document.createElement("div");
  tooltipArrowEl.className = "floating-tooltip__arrow";

  tooltipEl.append(tooltipBodyEl, tooltipArrowEl);
  document.body.append(tooltipEl);
}

function getTooltipText(target) {
  const text = target?.dataset?.tooltip;
  return typeof text === "string" ? text.trim() : "";
}

function isFocusableElement(el) {
  if (!el || !(el instanceof HTMLElement)) {
    return false;
  }

  if (el.matches("a, button, input, textarea, select, summary")) {
    return true;
  }

  const tabIndex = el.getAttribute("tabindex");
  return tabIndex !== null && Number(tabIndex) >= 0;
}

function makeTooltipTargetsKeyboardFocusable(root) {
  const scope = root || document;
  const nodes = scope.querySelectorAll("[data-tooltip]");

  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (!isFocusableElement(node)) {
      node.setAttribute("tabindex", "0");
    }
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function positionTooltip(targetRect, tooltipRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const centeredLeft = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  const clampedLeft = clamp(
    centeredLeft,
    VIEWPORT_PADDING,
    viewportWidth - tooltipRect.width - VIEWPORT_PADDING
  );

  const spaceAbove = targetRect.top - VIEWPORT_PADDING;
  const spaceBelow = viewportHeight - targetRect.bottom - VIEWPORT_PADDING;

  const canPlaceAbove = spaceAbove >= tooltipRect.height + TOOLTIP_GAP;
  const placeAbove = canPlaceAbove || spaceAbove >= spaceBelow;

  const top = placeAbove
    ? targetRect.top - tooltipRect.height - TOOLTIP_GAP
    : targetRect.bottom + TOOLTIP_GAP;

  const safeTop = clamp(top, VIEWPORT_PADDING, viewportHeight - tooltipRect.height - VIEWPORT_PADDING);

  return {
    left: clampedLeft,
    top: safeTop,
    placement: placeAbove ? "top" : "bottom"
  };
}

function renderTooltip(target, text) {
  ensureTooltipElement();

  tooltipBodyEl.textContent = text;
  tooltipEl.classList.remove("is-visible", "is-top", "is-bottom");
  tooltipEl.style.left = "0px";
  tooltipEl.style.top = "0px";
  tooltipEl.setAttribute("aria-hidden", "false");

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const { left, top, placement } = positionTooltip(targetRect, tooltipRect);

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.classList.add("is-visible", placement === "top" ? "is-top" : "is-bottom");
}

function hideSoon() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
  }

  hideTimer = window.setTimeout(() => {
    hideTooltip();
  }, 60);
}

function cancelHide() {
  if (!hideTimer) {
    return;
  }

  window.clearTimeout(hideTimer);
  hideTimer = null;
}

export function showTooltip(target, text) {
  if (!target || !text) {
    return;
  }

  activeTarget = target;
  cancelHide();
  renderTooltip(target, text);
}

export function hideTooltip() {
  if (!tooltipEl) {
    return;
  }

  activeTarget = null;
  tooltipEl.classList.remove("is-visible", "is-top", "is-bottom");
  tooltipEl.setAttribute("aria-hidden", "true");
}

function handleTargetEnter(target) {
  const text = getTooltipText(target);
  if (!text) {
    return;
  }

  showTooltip(target, text);
}

function reflowActiveTooltip() {
  if (!activeTarget || !tooltipEl || tooltipEl.getAttribute("aria-hidden") === "true") {
    return;
  }

  const text = getTooltipText(activeTarget);
  if (!text) {
    hideTooltip();
    return;
  }

  renderTooltip(activeTarget, text);
}

export function initTooltips(root = document) {
  ensureTooltipElement();
  makeTooltipTargetsKeyboardFocusable(root);

  const scope = root || document;

  scope.addEventListener("pointerenter", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-tooltip]") : null;
    if (!target) {
      return;
    }

    handleTargetEnter(target);
  }, true);

  scope.addEventListener("pointerleave", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-tooltip]") : null;
    if (!target || target !== activeTarget) {
      return;
    }

    hideSoon();
  }, true);

  scope.addEventListener("focusin", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-tooltip]") : null;
    if (!target) {
      return;
    }

    handleTargetEnter(target);
  });

  scope.addEventListener("focusout", (event) => {
    const related = event.relatedTarget;
    if (related instanceof HTMLElement && related.closest("[data-tooltip]")) {
      return;
    }

    hideSoon();
  });

  window.addEventListener("scroll", reflowActiveTooltip, true);
  window.addEventListener("resize", reflowActiveTooltip);

  tooltipEl.addEventListener("pointerenter", cancelHide);
  tooltipEl.addEventListener("pointerleave", hideSoon);
}
