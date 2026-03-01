function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function toDisplayCount(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return 0;
}

export function validatePlayerInventory(player, gemCatalog, capModel) {
  const issues = [];
  const clearMax = Number.isInteger(capModel?.clearMax) ? capModel.clearMax : 3;
  const coloredTotalMax = Number.isInteger(capModel?.coloredTotalMax) ? capModel.coloredTotalMax : 3;

  const clearValue = player?.clearGems;
  if (!Number.isInteger(clearValue)) {
    issues.push({
      code: "clear_non_integer",
      message: "Clear gem count must be a whole number."
    });
  } else {
    if (clearValue < 0) {
      issues.push({
        code: "clear_negative",
        message: "Clear gem count cannot be negative."
      });
    }

    if (clearValue > clearMax) {
      issues.push({
        code: "clear_cap_exceeded",
        message: `Clear cap exceeded (${clearValue}/${clearMax}).`
      });
    }
  }

  const colored = player?.colored;
  if (!isPlainObject(colored)) {
    issues.push({
      code: "colored_invalid",
      message: "Colored gem inventory is missing or invalid."
    });
    return issues;
  }

  let coloredTotal = 0;
  Object.entries(colored).forEach(([gemId, value]) => {
    if (!gemCatalog.has(gemId)) {
      issues.push({
        code: "unknown_gem",
        message: `Unknown gem id '${gemId}' found on this player.`
      });
    }

    if (!Number.isInteger(value)) {
      issues.push({
        code: "colored_non_integer",
        message: `Gem count for '${gemId}' must be a whole number.`
      });
      return;
    }

    if (value < 0) {
      issues.push({
        code: "colored_negative",
        message: `Gem count for '${gemId}' cannot be negative.`
      });
      return;
    }

    if (gemCatalog.has(gemId)) {
      coloredTotal += value;
    }
  });

  if (coloredTotal > coloredTotalMax) {
    issues.push({
      code: "colored_cap_exceeded",
      message: `Colored cap exceeded (${coloredTotal}/${coloredTotalMax}).`
    });
  }

  return issues;
}

export function validateLedgerEvent(event, playerMap, gemCatalog) {
  const issues = [];
  if (!isPlainObject(event)) {
    return [{ code: "ledger_event_invalid", message: "Ledger event is not an object." }];
  }

  if (!isIsoTimestamp(event.timestamp)) {
    issues.push({ code: "ledger_timestamp_invalid", message: `Ledger event '${event.id || "unknown"}' has invalid timestamp.` });
  }

  if (typeof event.playerUuid !== "string" || !event.playerUuid.trim()) {
    issues.push({ code: "ledger_player_missing", message: `Ledger event '${event.id || "unknown"}' is missing playerUuid.` });
  } else if (!playerMap.has(event.playerUuid)) {
    issues.push({ code: "ledger_player_unknown", message: `Ledger event '${event.id || "unknown"}' references unknown playerUuid '${event.playerUuid}'.` });
  }

  if (event.assetType !== "clear" && event.assetType !== "colored") {
    issues.push({ code: "ledger_asset_invalid", message: `Ledger event '${event.id || "unknown"}' has invalid assetType.` });
  }

  if (!Number.isInteger(event.delta) || event.delta === 0) {
    issues.push({ code: "ledger_delta_invalid", message: `Ledger event '${event.id || "unknown"}' must use a non-zero integer delta.` });
  }

  if (event.assetType === "clear" && event.gemId) {
    issues.push({ code: "ledger_clear_gemid", message: `Ledger event '${event.id || "unknown"}' should not include gemId for clear assetType.` });
  }

  if (event.assetType === "colored") {
    if (typeof event.gemId !== "string" || !event.gemId.trim()) {
      issues.push({ code: "ledger_colored_gem_missing", message: `Ledger event '${event.id || "unknown"}' requires gemId for colored assetType.` });
    } else if (!gemCatalog.has(event.gemId)) {
      issues.push({ code: "ledger_colored_gem_unknown", message: `Ledger event '${event.id || "unknown"}' references unknown gemId '${event.gemId}'.` });
    }
  }

  return issues;
}

export function validateLedger(ledger, players, gems) {
  if (!Array.isArray(ledger)) {
    return [{ code: "ledger_invalid", message: "Ledger is missing or invalid (expected an array)." }];
  }

  const issues = [];
  const playerMap = new Map((Array.isArray(players) ? players : []).map((player) => [player.uuid || player.id, player]));
  const gemCatalog = new Set((Array.isArray(gems) ? gems : []).map((gem) => gem.id));

  const seenIds = new Set();
  ledger.forEach((event, index) => {
    const eventIssues = validateLedgerEvent(event, playerMap, gemCatalog);
    issues.push(...eventIssues.map((issue) => ({ ...issue, index })));

    if (typeof event?.id === "string" && event.id.trim()) {
      if (seenIds.has(event.id)) {
        issues.push({ code: "ledger_event_duplicate", message: `Duplicate ledger event id '${event.id}'.`, index });
      }
      seenIds.add(event.id);
    }
  });

  return issues;
}
