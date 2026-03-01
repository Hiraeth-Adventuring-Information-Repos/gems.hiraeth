function normalizeSignedDelta(delta) {
  if (!Number.isInteger(delta) || delta === 0) {
    return 0;
  }
  return delta;
}

function emptyTotals() {
  return {
    gained: 0,
    spent: 0,
    net: 0
  };
}

function applyDelta(totals, delta) {
  if (delta > 0) {
    totals.gained += delta;
  } else if (delta < 0) {
    totals.spent += Math.abs(delta);
  }
  totals.net += delta;
}

export function groupHistoryByPlayer(ledger) {
  const grouped = new Map();
  const events = Array.isArray(ledger) ? ledger : [];

  events.forEach((event) => {
    const playerUuid = typeof event.playerUuid === "string" ? event.playerUuid : "";
    if (!playerUuid) {
      return;
    }

    if (!grouped.has(playerUuid)) {
      grouped.set(playerUuid, []);
    }

    grouped.get(playerUuid).push(event);
  });

  grouped.forEach((playerEvents) => {
    playerEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  return grouped;
}

export function getRecentEventsForPlayer(ledger, playerUuid, limit = 5) {
  if (!playerUuid || !Array.isArray(ledger)) {
    return [];
  }

  const events = ledger
    .filter((event) => event.playerUuid === playerUuid)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, Math.max(0, limit));
}

export function computePlayerTotals(ledger, playerUuid, gems) {
  const gemCatalog = new Set((Array.isArray(gems) ? gems : []).map((gem) => gem.id));
  const events = Array.isArray(ledger) ? ledger : [];

  const totals = {
    clear: emptyTotals(),
    colored: emptyTotals(),
    overall: emptyTotals(),
    byGem: {}
  };

  events.forEach((event) => {
    if (event.playerUuid !== playerUuid) {
      return;
    }

    const delta = normalizeSignedDelta(event.delta);
    if (!delta) {
      return;
    }

    applyDelta(totals.overall, delta);

    if (event.assetType === "clear") {
      applyDelta(totals.clear, delta);
      return;
    }

    if (event.assetType === "colored") {
      applyDelta(totals.colored, delta);
      if (typeof event.gemId === "string" && gemCatalog.has(event.gemId)) {
        if (!totals.byGem[event.gemId]) {
          totals.byGem[event.gemId] = emptyTotals();
        }
        applyDelta(totals.byGem[event.gemId], delta);
      }
    }
  });

  return totals;
}

export function computeGlobalTotals(ledger, gems) {
  const gemCatalog = new Set((Array.isArray(gems) ? gems : []).map((gem) => gem.id));
  const events = Array.isArray(ledger) ? ledger : [];

  const totals = {
    clear: emptyTotals(),
    colored: emptyTotals(),
    overall: emptyTotals(),
    byGem: {}
  };

  events.forEach((event) => {
    const delta = normalizeSignedDelta(event.delta);
    if (!delta) {
      return;
    }

    applyDelta(totals.overall, delta);

    if (event.assetType === "clear") {
      applyDelta(totals.clear, delta);
      return;
    }

    if (event.assetType === "colored") {
      applyDelta(totals.colored, delta);
      if (typeof event.gemId === "string" && gemCatalog.has(event.gemId)) {
        if (!totals.byGem[event.gemId]) {
          totals.byGem[event.gemId] = emptyTotals();
        }
        applyDelta(totals.byGem[event.gemId], delta);
      }
    }
  });

  return totals;
}
