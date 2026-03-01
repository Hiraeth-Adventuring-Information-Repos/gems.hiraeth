const MODE_STORAGE_KEY = "gemstoneTracker.colorMode";
const VALID_MODES = ["auto", "light", "dark"];
const DEFAULT_MODE = "auto";

let mediaQueryList = null;
let mediaListener = null;

function isValidMode(mode) {
  return VALID_MODES.includes(mode);
}

function getSystemMode() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveEffectiveMode(modePreference) {
  if (modePreference === "dark" || modePreference === "light") {
    return modePreference;
  }

  return getSystemMode();
}

export function getStoredModePreference() {
  try {
    const value = localStorage.getItem(MODE_STORAGE_KEY);
    return isValidMode(value) ? value : null;
  } catch (error) {
    return null;
  }
}

export function setModePreference(mode) {
  const nextMode = isValidMode(mode) ? mode : DEFAULT_MODE;

  try {
    localStorage.setItem(MODE_STORAGE_KEY, nextMode);
  } catch (error) {
    // Ignore localStorage failures.
  }

  return nextMode;
}

function setActiveButtonState(controlRoot, modePreference) {
  if (!controlRoot) {
    return;
  }

  const buttons = controlRoot.querySelectorAll(".mode-button[data-mode]");
  buttons.forEach((button) => {
    const isActive = button.dataset.mode === modePreference;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function applyMode(controlRoot, modePreference) {
  const effectiveMode = resolveEffectiveMode(modePreference);
  document.documentElement.dataset.mode = effectiveMode;
  setActiveButtonState(controlRoot, modePreference);
}

function bindSystemModeListener(controlRoot) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }

  mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
  mediaListener = () => {
    const modePreference = getStoredModePreference() || DEFAULT_MODE;
    if (modePreference === "auto") {
      applyMode(controlRoot, modePreference);
    }
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", mediaListener);
    return;
  }

  if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(mediaListener);
  }
}

function setupControlHandlers(controlRoot) {
  if (!controlRoot) {
    return;
  }

  const buttons = controlRoot.querySelectorAll(".mode-button[data-mode]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = setModePreference(button.dataset.mode);
      applyMode(controlRoot, nextMode);
    });
  });
}

export function initColorMode(controlRoot) {
  const storedMode = getStoredModePreference();
  const modePreference = storedMode || DEFAULT_MODE;

  if (!storedMode) {
    setModePreference(DEFAULT_MODE);
  }

  applyMode(controlRoot, modePreference);
  setupControlHandlers(controlRoot);
  bindSystemModeListener(controlRoot);
}
