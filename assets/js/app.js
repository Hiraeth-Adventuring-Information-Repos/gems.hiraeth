import { DATA_FILE_PATH, loadTrackerData, normalizeTrackerData } from "./data-loader.js";
import { validateLedger, validatePlayerInventory, toDisplayCount } from "./validation.js";
import { computeGlobalTotals, getRecentEventsForPlayer } from "./history.js";
import { initColorMode } from "./themes.js";
import { initTooltips } from "./tooltips.js";

const CLEAR_GEM_RULE = {
  displayColorName: "Clear",
  colorHex: "var(--clear-gem)",
  name: "Clear Gem (Inspiration)",
  cost: 0,
  fullEffect: "Use a clear gem to gain advantage on one attack roll, saving throw, or ability check.",
  shortEffect: "Gain advantage on one attack roll, save, or check."
};

const PAGE_TYPE = document.body?.dataset?.page || "tracker";

initColorMode(document.getElementById("color-mode-control"));
initTooltips(document);
bootstrap().catch((error) => {
  renderGlobalError(error instanceof Error ? error.message : "Unexpected startup failure.");
});

async function bootstrap() {
  const rawData = await loadTrackerData(DATA_FILE_PATH);
  const { data, issues: normalizeIssues } = normalizeTrackerData(rawData);

  const ledgerIssues = validateLedger(data.ledger, data.players, data.gems);
  const allIssues = [...normalizeIssues, ...ledgerIssues.map((issue) => issue.message)];

  renderGlobalIssues(allIssues);

  if (PAGE_TYPE === "tracker") {
    renderTrackerPage(data);
    return;
  }

  if (PAGE_TYPE === "rules") {
    renderRulesPage(data);
    return;
  }

  renderGlobalError(`Unknown page type '${PAGE_TYPE}'. Expected 'tracker' or 'rules'.`);
}

function renderTrackerPage(data) {
  const campaignNameEl = document.getElementById("campaign-name");
  const updatedAtEl = document.getElementById("updated-at");
  const playerGrid = document.getElementById("player-grid");
  const historySummary = document.getElementById("history-summary");

  if (campaignNameEl) {
    campaignNameEl.textContent = data.meta.campaignName;
  }

  if (updatedAtEl) {
    const readableDate = formatDateTime(data.meta.updatedAt);
    if (readableDate) {
      updatedAtEl.textContent = readableDate;
      updatedAtEl.dateTime = data.meta.updatedAt;
    } else {
      updatedAtEl.textContent = "Unknown";
      updatedAtEl.removeAttribute("datetime");
    }
  }

  if (!playerGrid) {
    return;
  }

  playerGrid.innerHTML = "";

  if (data.players.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "panel panel-warning";
    emptyState.textContent = "No players found. Add player entries in data/gemstone-tracker.json.";
    playerGrid.append(emptyState);
    return;
  }

  const gemCatalog = new Map(data.gems.map((gem) => [gem.id, gem]));
  const globalTotals = computeGlobalTotals(data.ledger, data.gems);
  renderHistorySummary(historySummary, globalTotals, data.gems);

  data.players.forEach((player) => {
    const recentEvents = getRecentEventsForPlayer(data.ledger, player.uuid, 5);
    playerGrid.append(createPlayerCard(player, data.gems, gemCatalog, data.meta.capModel, recentEvents));
  });
}

function renderHistorySummary(root, globalTotals, gems) {
  if (!root) {
    return;
  }

  root.innerHTML = "";

  const panel = document.createElement("section");
  panel.className = "history-summary-panel";

  const heading = document.createElement("div");
  heading.className = "history-summary-heading";

  const title = document.createElement("h2");
  title.textContent = "Campaign Ledger Summary";
  const subtitle = document.createElement("p");
  subtitle.className = "subhead";
  subtitle.textContent = "Gained, spent, and net totals from transaction history.";

  heading.append(title, subtitle);
  panel.append(heading);

  const grid = document.createElement("div");
  grid.className = "history-summary-grid";

  grid.append(createSummaryCard("Overall", globalTotals.overall));
  grid.append(createSummaryCard("Clear Gems", globalTotals.clear));
  grid.append(createSummaryCard("Colored Gems", globalTotals.colored));

  panel.append(grid);

  const byGemEntries = Object.entries(globalTotals.byGem)
    .filter(([, totals]) => totals.gained > 0 || totals.spent > 0)
    .sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
    .slice(0, 6);

  if (byGemEntries.length > 0) {
    const byGemSection = document.createElement("div");
    byGemSection.className = "history-by-gem";

    const byGemTitle = document.createElement("h3");
    byGemTitle.textContent = "Top Gem Activity";
    byGemSection.append(byGemTitle);

    const byGemList = document.createElement("div");
    byGemList.className = "history-by-gem-list";

    byGemEntries.forEach(([gemId, totals]) => {
      const gem = gems.find((entry) => entry.id === gemId);
      const row = document.createElement("div");
      row.className = "history-by-gem-item";

      const name = document.createElement("span");
      name.className = "history-by-gem-name";
      name.textContent = gem ? `${gem.displayColorName} ${gem.name}` : gemId;

      const stats = document.createElement("span");
      stats.className = "history-by-gem-stats";
      stats.textContent = `+${totals.gained} / -${totals.spent} / net ${formatSigned(totals.net)}`;

      row.append(name, stats);
      byGemList.append(row);
    });

    byGemSection.append(byGemList);
    panel.append(byGemSection);
  }

  root.append(panel);
}

function createSummaryCard(label, totals) {
  const card = document.createElement("article");
  card.className = "summary-card";

  const heading = document.createElement("h3");
  heading.textContent = label;

  const values = document.createElement("div");
  values.className = "summary-card-values";

  values.append(createSummaryStat("Gained", `+${totals.gained}`));
  values.append(createSummaryStat("Spent", `-${totals.spent}`));
  values.append(createSummaryStat("Net", formatSigned(totals.net)));

  card.append(heading, values);
  return card;
}

function createSummaryStat(label, value) {
  const item = document.createElement("div");
  item.className = "summary-stat";

  const statLabel = document.createElement("span");
  statLabel.className = "summary-stat-label";
  statLabel.textContent = label;

  const statValue = document.createElement("span");
  statValue.className = "summary-stat-value";
  statValue.textContent = value;

  item.append(statLabel, statValue);
  return item;
}

function createPlayerCard(player, gems, gemCatalog, capModel, recentEvents = []) {
  const card = document.createElement("article");
  card.className = "player-card";

  const header = document.createElement("div");
  const playerName = document.createElement("h3");
  playerName.textContent = player.initials || player.name || "UN";
  playerName.title = player.name || player.initials || "Player";
  header.append(playerName);
  card.append(header);

  const playerIssues = validatePlayerInventory(player, gemCatalog, capModel);
  if (playerIssues.length > 0) {
    const badgeRail = document.createElement("div");
    badgeRail.className = "badge-rail";

    playerIssues.forEach((issue) => {
      const badge = document.createElement("span");
      badge.className = "warning-badge";
      badge.textContent = issue.message;
      badgeRail.append(badge);
    });

    card.append(badgeRail);
  }

  const clearCount = toDisplayCount(player.clearGems);
  const clearMax = Number.isInteger(capModel.clearMax) ? capModel.clearMax : 3;
  card.append(
    createInventoryRow({
      title: "Clear",
      valueLabel: `${clearCount}/${clearMax}`,
      trackNode: createDiamondTrack({
        count: clearCount,
        cap: clearMax,
        fillColors: [],
        defaultFillColor: "var(--clear-gem)",
        tooltip: CLEAR_GEM_RULE.shortEffect
      })
    })
  );

  const coloredSequence = buildColoredSequence(player, gems);
  const coloredTotal = coloredSequence.length;
  const coloredMax = Number.isInteger(capModel.coloredTotalMax) ? capModel.coloredTotalMax : 3;
  card.append(
    createInventoryRow({
      title: "Colored",
      valueLabel: `${coloredTotal}/${coloredMax}`,
      trackNode: createDiamondTrack({
        count: coloredTotal,
        cap: coloredMax,
        fillColors: coloredSequence,
        defaultFillColor: "#a4a4a4",
        tooltip: "Total colored gems currently held"
      })
    })
  );

  const gemsList = document.createElement("div");
  gemsList.className = "gem-list";

  const ownedEntries = gems
    .map((gem) => ({ gem, count: toDisplayCount(player.colored?.[gem.id]) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      if (a.gem.cost !== b.gem.cost) {
        return a.gem.cost - b.gem.cost;
      }
      return a.gem.name.localeCompare(b.gem.name);
    });

  if (ownedEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-gems";
    empty.textContent = "No colored gems currently tracked.";
    gemsList.append(empty);
  } else {
    ownedEntries.forEach(({ gem, count }) => {
      gemsList.append(createGemListItem(gem, count));
    });
  }

  if (typeof player.notes === "string" && player.notes.trim()) {
    const notes = document.createElement("p");
    notes.className = "subhead";
    notes.textContent = `Notes: ${player.notes.trim()}`;
    gemsList.append(notes);
  }

  card.append(gemsList);
  card.append(createRecentActivity(recentEvents, gems));
  return card;
}

function createRecentActivity(events, gems) {
  const section = document.createElement("section");
  section.className = "activity-section";

  const title = document.createElement("h4");
  title.className = "activity-title";
  title.textContent = "Recent Activity";
  section.append(title);

  if (!Array.isArray(events) || events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-gems";
    empty.textContent = "No ledger entries yet.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("div");
  list.className = "activity-list";

  events.forEach((event) => {
    const item = document.createElement("div");
    item.className = "activity-item";

    const left = document.createElement("div");
    left.className = "activity-main";

    const asset = describeEventAsset(event, gems);
    const time = formatDateTime(event.timestamp) || event.timestamp;

    const primary = document.createElement("span");
    primary.className = "activity-primary";
    primary.textContent = `${time} • ${asset}`;

    left.append(primary);

    if (event.note) {
      const note = document.createElement("span");
      note.className = "activity-note";
      note.textContent = event.note;
      left.append(note);
    }

    const delta = document.createElement("span");
    const isGain = event.delta > 0;
    delta.className = `delta-chip ${isGain ? "is-gain" : "is-spend"}`;
    delta.textContent = formatSigned(event.delta);

    item.append(left, delta);
    list.append(item);
  });

  section.append(list);
  return section;
}

function describeEventAsset(event, gems) {
  if (event.assetType === "clear") {
    return "Clear Gem";
  }

  const gem = gems.find((entry) => entry.id === event.gemId);
  return gem ? gem.name : event.gemId || "Unknown Gem";
}

function createInventoryRow({ title, valueLabel, trackNode }) {
  const row = document.createElement("div");
  row.className = "player-row";

  const labelBlock = document.createElement("div");
  labelBlock.className = "label-block";

  const titleSpan = document.createElement("span");
  titleSpan.className = "label-title";
  titleSpan.textContent = title;

  const valueSpan = document.createElement("span");
  valueSpan.className = "label-value";
  valueSpan.textContent = valueLabel;

  labelBlock.append(titleSpan, valueSpan);
  row.append(labelBlock, trackNode);
  return row;
}

function createDiamondTrack({ count, cap, fillColors, defaultFillColor, tooltip }) {
  const track = document.createElement("div");
  track.className = "diamond-track";
  if (tooltip) {
    track.dataset.tooltip = tooltip;
  }

  const safeCount = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
  const safeCap = Math.max(0, Number.isFinite(cap) ? Math.floor(cap) : 0);

  for (let index = 0; index < Math.min(safeCount, safeCap); index += 1) {
    const diamond = document.createElement("span");
    diamond.className = "diamond filled";
    diamond.style.setProperty("--gem-color", fillColors[index] || defaultFillColor);
    track.append(diamond);
  }

  for (let index = Math.min(safeCount, safeCap); index < safeCap; index += 1) {
    const diamond = document.createElement("span");
    diamond.className = "diamond empty";
    diamond.style.setProperty("--gem-color", defaultFillColor);
    track.append(diamond);
  }

  if (safeCount > safeCap) {
    const overflow = document.createElement("span");
    overflow.className = "overflow-badge";
    overflow.textContent = `+${safeCount - safeCap}`;
    track.append(overflow);
  }

  return track;
}

function createGemListItem(gem, count) {
  const item = document.createElement("div");
  item.className = "gem-list-item";

  const info = document.createElement("div");
  info.className = "gem-list-info";

  const swatch = document.createElement("span");
  swatch.className = "gem-swatch";
  swatch.style.backgroundColor = gem.colorHex;

  const label = document.createElement("span");
  label.className = "gem-label";
  label.dataset.tooltip = gem.shortEffect || gem.fullEffect || "No effect summary available.";

  const colorName = document.createElement("span");
  colorName.className = "gem-color-name";
  colorName.textContent = gem.displayColorName;

  const gemName = document.createElement("span");
  gemName.textContent = gem.name;

  info.append(swatch);
  label.append(colorName, gemName);
  info.append(label);

  const right = document.createElement("div");
  right.className = "badge-rail";

  const countBadge = document.createElement("span");
  countBadge.className = "count-badge";
  countBadge.textContent = `x${count}`;

  const costBadge = document.createElement("span");
  costBadge.className = "count-badge";
  costBadge.textContent = `cost ${gem.cost}`;

  right.append(countBadge, costBadge);
  item.append(info, right);
  return item;
}

function buildColoredSequence(player, gems) {
  const sequence = [];

  gems.forEach((gem) => {
    const count = toDisplayCount(player.colored?.[gem.id]);
    for (let index = 0; index < count; index += 1) {
      sequence.push(gem.colorHex);
    }
  });

  return sequence;
}

function renderRulesPage(data) {
  const groupsRoot = document.getElementById("rules-groups");
  if (!groupsRoot) {
    return;
  }

  groupsRoot.innerHTML = "";
  groupsRoot.append(createClearGemSection());

  const grouped = groupGemsByCost(data.gems);
  const tierOrder = [3, 6, 9, 12];

  tierOrder.forEach((tier) => {
    const tierGems = grouped.get(tier) || [];
    if (tierGems.length > 0) {
      groupsRoot.append(createTierSection(tier, tierGems));
    }
  });

  const otherTiers = [...grouped.keys()].filter((tier) => !tierOrder.includes(tier)).sort((a, b) => a - b);
  otherTiers.forEach((tier) => {
    groupsRoot.append(createTierSection(tier, grouped.get(tier)));
  });
}

function groupGemsByCost(gems) {
  const grouped = new Map();

  gems.forEach((gem) => {
    const tier = Number.isInteger(gem.cost) ? gem.cost : -1;
    if (!grouped.has(tier)) {
      grouped.set(tier, []);
    }
    grouped.get(tier).push(gem);
  });

  grouped.forEach((tierGems) => {
    tierGems.sort((a, b) => a.name.localeCompare(b.name));
  });

  return grouped;
}

function createClearGemSection() {
  const section = document.createElement("section");
  section.className = "tier-section";

  const heading = document.createElement("div");
  heading.className = "tier-heading";

  const title = document.createElement("h2");
  title.textContent = "Clear Inspiration Gem";

  const subtitle = document.createElement("p");
  subtitle.className = "tier-sub";
  subtitle.textContent = "Base inspiration effect";

  heading.append(title, subtitle);

  const list = document.createElement("div");
  list.className = "rules-list";
  list.append(createRuleCard(CLEAR_GEM_RULE));

  section.append(heading, list);
  return section;
}

function createTierSection(cost, gems) {
  const section = document.createElement("section");
  section.className = "tier-section";

  const heading = document.createElement("div");
  heading.className = "tier-heading";

  const title = document.createElement("h2");
  title.textContent = cost >= 0 ? `Cost ${cost} Gems` : "Unsorted Cost Tier";

  const subtitle = document.createElement("p");
  subtitle.className = "tier-sub";
  subtitle.textContent = `${gems.length} gem type${gems.length === 1 ? "" : "s"}`;

  heading.append(title, subtitle);

  const list = document.createElement("div");
  list.className = "rules-list";
  gems.forEach((gem) => {
    list.append(createRuleCard(gem));
  });

  section.append(heading, list);
  return section;
}

function createRuleCard(gem) {
  const card = document.createElement("article");
  card.className = "rule-card";

  const meta = document.createElement("div");
  meta.className = "rule-meta";

  const swatch = document.createElement("span");
  swatch.className = "gem-swatch";
  swatch.style.backgroundColor = gem.colorHex;

  const color = document.createElement("span");
  color.className = "gem-color-name";
  color.textContent = gem.displayColorName;

  const cost = document.createElement("span");
  cost.className = "count-badge";
  cost.textContent = gem.cost > 0 ? `cost ${gem.cost}` : "base";

  meta.append(swatch, color, cost);

  const name = document.createElement("h3");
  name.className = "rule-name";
  name.textContent = gem.name;

  const text = document.createElement("p");
  text.className = "rule-text";
  text.textContent = gem.fullEffect || gem.shortEffect || "No rule text available.";

  card.append(meta, name, text);
  return card;
}

function renderGlobalIssues(issues) {
  const panel = document.getElementById("global-issues");
  const list = document.getElementById("global-issues-list");

  if (!panel || !list) {
    return;
  }

  list.innerHTML = "";
  if (!Array.isArray(issues) || issues.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  issues.forEach((issue) => {
    const li = document.createElement("li");
    li.textContent = issue;
    list.append(li);
  });

  panel.classList.remove("hidden");
}

function renderGlobalError(message) {
  const panel = document.getElementById("global-error");
  const detail = document.getElementById("global-error-message");

  if (!panel || !detail) {
    return;
  }

  detail.textContent = `${message} Expected top-level keys: meta, gems, players.`;
  panel.classList.remove("hidden");
}

function formatDateTime(isoValue) {
  if (!isoValue) {
    return null;
  }

  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function formatSigned(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
}
