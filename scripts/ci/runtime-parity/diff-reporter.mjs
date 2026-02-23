function asComparableValue(value) {
  if (value == null) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(asComparableValue);
  const keys = Object.keys(value).sort();
  const out = {};
  for (const key of keys) {
    out[key] = asComparableValue(value[key]);
  }
  return out;
}

function valueEquals(a, b) {
  return JSON.stringify(asComparableValue(a)) === JSON.stringify(asComparableValue(b));
}

function normalizeScenarioFingerprint(name, fingerprint) {
  const normalized = asComparableValue(fingerprint || null);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return normalized;
  }

  const out = { ...normalized };

  // Probe public IDs are environment data, not runtime contract drift.
  if (name === 'bootstrap-parity') {
    delete out.probePublicId;
  }
  if (name === 'instance-open-parity') {
    delete out.publicId;
  }

  // Publish timing/timestamps are expected to differ across environments.
  if (name === 'publish-immediacy') {
    delete out.publicId;
    delete out.budgetMs;
    delete out.deltaMs;
    delete out.pointerShifted;
    delete out.publishOverall;
    delete out.rPointerUpdatedAt;
    delete out.ePointerUpdatedAt;
  }

  return out;
}

function mapScenarioFingerprints(report) {
  const map = new Map();
  const scenarios = Array.isArray(report?.scenarios) ? report.scenarios : [];
  for (const scenario of scenarios) {
    if (!scenario || typeof scenario !== 'object') continue;
    const name = typeof scenario.scenario === 'string' ? scenario.scenario : '';
    if (!name) continue;
    map.set(name, normalizeScenarioFingerprint(name, scenario.fingerprint || null));
  }
  return map;
}

export function buildParityDiff(currentReport, compareReport) {
  const currentMap = mapScenarioFingerprints(currentReport);
  const compareMap = mapScenarioFingerprints(compareReport);
  const scenarioNames = Array.from(new Set([...currentMap.keys(), ...compareMap.keys()])).sort((a, b) =>
    a.localeCompare(b),
  );

  const scenarios = scenarioNames.map((scenario) => {
    const current = currentMap.get(scenario);
    const compared = compareMap.get(scenario);
    const pass = valueEquals(current, compared);
    return {
      scenario,
      pass,
      current,
      compared,
    };
  });

  return {
    pass: scenarios.every((scenario) => scenario.pass),
    scenarios,
  };
}
