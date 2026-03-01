export const DATA_FILE_PATH = "./data/gemstone-tracker.json";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function fallbackUuid(index) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function deriveInitials(name, index) {
  if (typeof name === "string" && name.trim()) {
    const words = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return words[0].slice(0, 2).toUpperCase();
  }

  return `P${index + 1}`;
}

function normalizeGem(gemRaw, index, seenIds, issues) {
  if (!isPlainObject(gemRaw)) {
    issues.push(`gems[${index}] is not an object and was skipped.`);
    return null;
  }

  const fallbackId = `gem_${index + 1}`;
  let id = typeof gemRaw.id === "string" && gemRaw.id.trim() ? gemRaw.id.trim() : fallbackId;
  if (id === fallbackId) {
    issues.push(`gems[${index}].id is missing. Using '${fallbackId}'.`);
  }

  if (seenIds.has(id)) {
    const uniqueId = `${id}_${index + 1}`;
    issues.push(`Duplicate gem id '${id}' found. Renamed to '${uniqueId}'.`);
    id = uniqueId;
  }
  seenIds.add(id);

  const displayColorName =
    typeof gemRaw.displayColorName === "string" && gemRaw.displayColorName.trim()
      ? gemRaw.displayColorName.trim()
      : "Unknown Color";

  const validColorHex = typeof gemRaw.colorHex === "string" && /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(gemRaw.colorHex);
  const colorHex = validColorHex ? gemRaw.colorHex : "#9CA3AF";
  if (!validColorHex) {
    issues.push(`gems[${index}].colorHex is invalid. Using '#9CA3AF'.`);
  }

  const name = typeof gemRaw.name === "string" && gemRaw.name.trim() ? gemRaw.name.trim() : `Unnamed Gem ${index + 1}`;
  const cost = Number.isInteger(gemRaw.cost) && gemRaw.cost >= 0 ? gemRaw.cost : 0;
  if (!Number.isInteger(gemRaw.cost) || gemRaw.cost < 0) {
    issues.push(`gems[${index}].cost is invalid. Using 0.`);
  }

  const shortEffect = typeof gemRaw.shortEffect === "string" ? gemRaw.shortEffect : "";
  const fullEffect = typeof gemRaw.fullEffect === "string" ? gemRaw.fullEffect : shortEffect;

  return {
    id,
    displayColorName,
    colorHex,
    name,
    cost,
    shortEffect,
    fullEffect
  };
}

function normalizePlayer(playerRaw, index, gemIds, seenUuids, issues) {
  if (!isPlainObject(playerRaw)) {
    issues.push(`players[${index}] is not an object and was skipped.`);
    return null;
  }

  const legacyId = typeof playerRaw.id === "string" && playerRaw.id.trim() ? playerRaw.id.trim() : "";
  const rawUuid = typeof playerRaw.uuid === "string" && playerRaw.uuid.trim() ? playerRaw.uuid.trim() : "";
  let uuid = rawUuid || legacyId || fallbackUuid(index);

  if (!rawUuid && legacyId) {
    issues.push(`players[${index}] is using legacy id '${legacyId}'. Consider adding uuid.`);
  }
  if (!rawUuid && !legacyId) {
    issues.push(`players[${index}].uuid is missing. Using '${uuid}'.`);
  }

  if (seenUuids.has(uuid)) {
    const uniqueUuid = `${uuid}-${index + 1}`;
    issues.push(`Duplicate player uuid '${uuid}' found. Renamed to '${uniqueUuid}'.`);
    uuid = uniqueUuid;
  }
  seenUuids.add(uuid);

  const name = typeof playerRaw.name === "string" && playerRaw.name.trim() ? playerRaw.name.trim() : `Player ${index + 1}`;
  const initials =
    typeof playerRaw.initials === "string" && playerRaw.initials.trim()
      ? playerRaw.initials.trim().toUpperCase()
      : deriveInitials(name, index);

  if (!(typeof playerRaw.initials === "string" && playerRaw.initials.trim())) {
    issues.push(`players[${index}].initials is missing. Using '${initials}'.`);
  }

  if (!("clearGems" in playerRaw)) {
    issues.push(`players[${index}].clearGems is missing. Using 0.`);
  }
  const clearGems = "clearGems" in playerRaw ? playerRaw.clearGems : 0;

  const coloredInput = isPlainObject(playerRaw.colored) ? playerRaw.colored : {};
  if (!isPlainObject(playerRaw.colored)) {
    issues.push(`players[${index}].colored is missing or invalid. Using empty object.`);
  }

  const colored = { ...coloredInput };
  gemIds.forEach((gemId) => {
    if (!(gemId in colored)) {
      colored[gemId] = 0;
    }
  });

  const notes = typeof playerRaw.notes === "string" ? playerRaw.notes : "";

  return {
    uuid,
    id: legacyId || uuid,
    initials,
    name,
    clearGems,
    colored,
    notes
  };
}

function normalizeLedgerEvent(eventRaw, index, issues) {
  if (!isPlainObject(eventRaw)) {
    issues.push(`ledger[${index}] is not an object and was skipped.`);
    return null;
  }

  const fallbackId = `ledger_${String(index + 1).padStart(4, "0")}`;
  const id = typeof eventRaw.id === "string" && eventRaw.id.trim() ? eventRaw.id.trim() : fallbackId;
  if (id === fallbackId) {
    issues.push(`ledger[${index}].id is missing. Using '${fallbackId}'.`);
  }

  const timestamp = isIsoTimestamp(eventRaw.timestamp) ? eventRaw.timestamp : new Date(0).toISOString();
  if (!isIsoTimestamp(eventRaw.timestamp)) {
    issues.push(`ledger[${index}].timestamp is invalid. Using '${timestamp}'.`);
  }

  const playerUuid = typeof eventRaw.playerUuid === "string" ? eventRaw.playerUuid.trim() : "";
  const assetType = eventRaw.assetType === "clear" || eventRaw.assetType === "colored" ? eventRaw.assetType : "colored";
  if (assetType !== eventRaw.assetType) {
    issues.push(`ledger[${index}].assetType is invalid. Using 'colored'.`);
  }

  const gemId = typeof eventRaw.gemId === "string" && eventRaw.gemId.trim() ? eventRaw.gemId.trim() : undefined;

  const delta = Number.isInteger(eventRaw.delta) ? eventRaw.delta : 0;
  if (!Number.isInteger(eventRaw.delta)) {
    issues.push(`ledger[${index}].delta is invalid. Using 0.`);
  }

  const note = typeof eventRaw.note === "string" ? eventRaw.note : "";
  const source = typeof eventRaw.source === "string" ? eventRaw.source : "";

  return {
    id,
    timestamp,
    playerUuid,
    assetType,
    gemId,
    delta,
    note,
    source
  };
}

function normalizeLedger(rawLedger, issues) {
  if (rawLedger === undefined) {
    return [];
  }

  if (!Array.isArray(rawLedger)) {
    issues.push("ledger is invalid. Using empty ledger.");
    return [];
  }

  return rawLedger.map((entry, index) => normalizeLedgerEvent(entry, index, issues)).filter((entry) => entry !== null);
}

export function normalizeTrackerData(rawData) {
  const issues = [];

  if (!isPlainObject(rawData)) {
    return {
      data: {
        meta: {
          campaignName: "Gemstone Tracker",
          version: 2,
          updatedAt: null,
          capModel: {
            clearMax: 3,
            coloredTotalMax: 3
          }
        },
        gems: [],
        players: [],
        ledger: []
      },
      issues: ["Root JSON must be an object."]
    };
  }

  const metaRaw = isPlainObject(rawData.meta) ? rawData.meta : {};
  if (!isPlainObject(rawData.meta)) {
    issues.push("meta is missing or invalid. Using fallback metadata.");
  }

  const campaignName =
    typeof metaRaw.campaignName === "string" && metaRaw.campaignName.trim() ? metaRaw.campaignName.trim() : "Gemstone Tracker";
  const version = Number.isInteger(metaRaw.version) && metaRaw.version > 0 ? metaRaw.version : 2;

  let updatedAt = null;
  if (isIsoTimestamp(metaRaw.updatedAt)) {
    updatedAt = metaRaw.updatedAt;
  } else if (metaRaw.updatedAt !== undefined) {
    issues.push("meta.updatedAt is not a valid ISO timestamp.");
  }

  const capRaw = isPlainObject(metaRaw.capModel) ? metaRaw.capModel : {};
  const clearMax = Number.isInteger(capRaw.clearMax) && capRaw.clearMax >= 0 ? capRaw.clearMax : 3;
  const coloredTotalMax = Number.isInteger(capRaw.coloredTotalMax) && capRaw.coloredTotalMax >= 0 ? capRaw.coloredTotalMax : 3;

  if (!Number.isInteger(capRaw.clearMax) || capRaw.clearMax < 0) {
    issues.push("meta.capModel.clearMax is invalid. Using 3.");
  }
  if (!Number.isInteger(capRaw.coloredTotalMax) || capRaw.coloredTotalMax < 0) {
    issues.push("meta.capModel.coloredTotalMax is invalid. Using 3.");
  }

  const gemsRaw = Array.isArray(rawData.gems) ? rawData.gems : [];
  if (!Array.isArray(rawData.gems)) {
    issues.push("gems is missing or invalid. Using empty gem list.");
  }

  const seenGemIds = new Set();
  const gems = gemsRaw
    .map((gemRaw, index) => normalizeGem(gemRaw, index, seenGemIds, issues))
    .filter((gem) => gem !== null);

  const gemIds = gems.map((gem) => gem.id);

  const playersRaw = Array.isArray(rawData.players) ? rawData.players : [];
  if (!Array.isArray(rawData.players)) {
    issues.push("players is missing or invalid. Using empty player list.");
  }

  const seenUuids = new Set();
  const players = playersRaw
    .map((playerRaw, index) => normalizePlayer(playerRaw, index, gemIds, seenUuids, issues))
    .filter((player) => player !== null);

  const ledger = normalizeLedger(rawData.ledger, issues);

  if (players.length === 0) {
    issues.push("No players found in data. Add player records to render the tracker.");
  }

  return {
    data: {
      meta: {
        campaignName,
        version,
        updatedAt,
        capModel: {
          clearMax,
          coloredTotalMax
        }
      },
      gems,
      players,
      ledger
    },
    issues
  };
}

export async function loadTrackerData(filePath = DATA_FILE_PATH) {
  let response;

  try {
    response = await fetch(filePath, { cache: "no-store" });
  } catch (error) {
    throw new Error(
      `Could not fetch '${filePath}'. If you opened the file directly, run a local server (for example: python3 -m http.server).`
    );
  }

  if (!response.ok) {
    throw new Error(`Request failed for '${filePath}' with HTTP ${response.status}.`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`'${filePath}' is not valid JSON. Fix the syntax and reload.`);
  }
}
