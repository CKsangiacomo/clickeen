const COLOR_LITERAL_PATTERN = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;
const TYPOGRAPHY_VALUE_PATTERN =
  /^(?:-?\d+(?:\.\d+)?(?:rem|em|px|%)?|-?\d+(?:\.\d+)?|clamp\(-?\d+(?:\.\d+)?(?:rem|em|px|%)?,\s*-?\d+(?:\.\d+)?(?:rem|em|px|%)?\s*\+\s*-?\d+(?:\.\d+)?vw,\s*-?\d+(?:\.\d+)?(?:rem|em|px|%)?\))$/;
const FOUNDATION_TOKEN_PATTERN =
  /^--(?:space-\d+|vertspace-\d+|layout-(?:left-nav-width|left-nav-padding|page-padding|compact-left-nav-width)|control-size-[a-z0-9-]+|control-padding-inline|control-inline-gap-[a-z0-9-]+|control-radius-[a-z0-9-]+|shadow-[a-z0-9-]+|duration-[a-z0-9-]+|easing-standard)$/;
const LENGTH_VALUE_PATTERN = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:rem|em|px))$/;
const LENGTH_TOKEN_REFERENCE_PATTERN =
  /^var\((--(?:space-\d+|vertspace-\d+|layout-(?:left-nav-width|left-nav-padding|page-padding|compact-left-nav-width)|control-size-[a-z0-9-]+|control-padding-inline|control-inline-gap-[a-z0-9-]+|control-radius-[a-z0-9-]+|icon-size-\d+))\)$/;
const DURATION_VALUE_PATTERN = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s))$/;
const EASING_KEYWORD_PATTERN = /^(?:linear|ease|ease-in|ease-out|ease-in-out)$/;
const CUBIC_BEZIER_PATTERN =
  /^cubic-bezier\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/;
const SHADOW_LENGTH = String.raw`(?:0|-?(?:\d+(?:\.\d+)?|\.\d+)(?:rem|em|px))`;
const SHADOW_COLOR = String.raw`(?:var\(--(?:color|role)-[a-z0-9-]+\)|color-mix\(in oklab, var\(--(?:color|role)-[a-z0-9-]+\), transparent (?:0|[1-9]\d?|100)%\))`;
const SHADOW_LAYER = String.raw`(?:inset\s+)?${SHADOW_LENGTH}\s+${SHADOW_LENGTH}(?:\s+${SHADOW_LENGTH}){0,2}\s+${SHADOW_COLOR}`;
const SHADOW_VALUE_PATTERN = new RegExp(`^${SHADOW_LAYER}(?:,\\s*${SHADOW_LAYER})*$`);
const SHADOW_REFERENCE_PATTERN = /var\((--(?:color|role)-[a-z0-9-]+)\)/g;

function maskCssComments(input) {
  return input.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, ' '));
}

export function parseDieterTokenDeclarations(css) {
  const source = String(css);
  const masked = maskCssComments(source);
  const declarations = [];
  const declarationRegex = /(^|\n)([ \t]*)(--[a-zA-Z0-9_-]+)(\s*:\s*)([^;{}]+);/g;
  let match;
  while ((match = declarationRegex.exec(masked))) {
    const valueStart =
      match.index + match[1].length + match[2].length + match[3].length + match[4].length;
    const valueEnd = valueStart + match[5].length;
    declarations.push({
      name: match[3],
      value: match[5].trim(),
      valueStart,
      valueEnd,
    });
  }
  return declarations;
}

function uniqueSourceValues(declarations) {
  const counts = new Map();
  for (const declaration of declarations) {
    counts.set(declaration.name, (counts.get(declaration.name) ?? 0) + 1);
  }
  const values = new Map();
  for (const declaration of declarations) {
    if (counts.get(declaration.name) === 1) values.set(declaration.name, declaration.value);
  }
  return { counts, values };
}

function createValidationContext(raw, dependencySources = []) {
  const declarations = parseDieterTokenDeclarations(raw);
  const source = uniqueSourceValues(declarations);
  const dependency = uniqueSourceValues(
    dependencySources.flatMap((dependencyRaw) => parseDieterTokenDeclarations(dependencyRaw)),
  );
  return {
    declarations,
    counts: source.counts,
    sourceValues: source.values,
    referenceTokens: new Set([...source.values.keys(), ...dependency.values.keys()]),
  };
}

function resolvesLengthReference(token, sourceValues, seen = new Set()) {
  if (seen.has(token)) return false;
  const value = sourceValues.get(token);
  if (!value) return false;
  if (LENGTH_VALUE_PATTERN.test(value)) return true;
  const referencedToken = value.match(LENGTH_TOKEN_REFERENCE_PATTERN)?.[1];
  if (!referencedToken) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(token);
  return resolvesLengthReference(referencedToken, sourceValues, nextSeen);
}

function isSafeShadowValue(value, referenceTokens) {
  if (value === 'none') return true;
  if (value.length > 500 || !SHADOW_VALUE_PATTERN.test(value)) return false;
  const references = [...value.matchAll(SHADOW_REFERENCE_PATTERN)].map((match) => match[1]);
  return references.length > 0 && references.every((token) => referenceTokens?.has(token));
}

function isValidEasingValue(value) {
  if (EASING_KEYWORD_PATTERN.test(value)) return true;
  const match = value.match(CUBIC_BEZIER_PATTERN);
  if (!match) return false;
  const x1 = Number(match[1]);
  const x2 = Number(match[3]);
  return x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1;
}

function isValidFoundationValue(token, value, context) {
  if (token.startsWith('--shadow-')) return isSafeShadowValue(value, context?.referenceTokens);
  if (token.startsWith('--duration-')) return DURATION_VALUE_PATTERN.test(value);
  if (token === '--easing-standard') return isValidEasingValue(value);
  if (LENGTH_VALUE_PATTERN.test(value)) return true;
  const referencedToken = value.match(LENGTH_TOKEN_REFERENCE_PATTERN)?.[1];
  if (!referencedToken || referencedToken === token || !context?.sourceValues) return false;
  const candidateValues = new Map(context.sourceValues);
  candidateValues.set(token, value);
  return resolvesLengthReference(token, candidateValues);
}

export const TOKEN_FILES = {
  colors: {
    path: 'dieter/tokens/dieter-color-tokens.css',
    tokenPattern: /^--color-/,
    valuePattern: COLOR_LITERAL_PATTERN,
    reasonKey: 'devstudio.errors.dieterTokens.colorInvalid',
  },
  foundation: {
    path: 'dieter/tokens/dieter-foundation-tokens.css',
    tokenPattern: FOUNDATION_TOKEN_PATTERN,
    valueValidator: isValidFoundationValue,
    reasonKey: 'devstudio.errors.dieterTokens.foundationInvalid',
  },
  typography: {
    path: 'dieter/tokens/dieter-typography.css',
    tokenPattern: /^--(?:fs|lh)-/,
    valuePattern: TYPOGRAPHY_VALUE_PATTERN,
    reasonKey: 'devstudio.errors.dieterTokens.typographyInvalid',
  },
};

export function isEditableDieterToken(file, token, value, context) {
  if (!file.tokenPattern.test(token)) return false;
  if (file.valuePattern) return file.valuePattern.test(value);
  return file.valueValidator(token, value, context);
}

export function parseEditableDieterTokens(raw, file, dependencySources = []) {
  const context = createValidationContext(raw, dependencySources);
  return context.declarations
    .filter((declaration) => file.tokenPattern.test(declaration.name))
    .map((declaration) => ({
      token: declaration.name,
      value: declaration.value,
      editable:
        context.counts.get(declaration.name) === 1 &&
        isEditableDieterToken(file, declaration.name, declaration.value, context),
    }));
}

export function replaceDieterTokenValue(raw, file, token, value, dependencySources = []) {
  if (!file.tokenPattern.test(token)) {
    return { ok: false, reasonKey: 'devstudio.errors.dieterTokens.tokenNotEditable' };
  }

  const context = createValidationContext(raw, dependencySources);
  const matches = context.declarations.filter((declaration) => declaration.name === token);
  if (matches.length !== 1) {
    return {
      ok: false,
      reasonKey:
        matches.length === 0
          ? 'devstudio.errors.dieterTokens.tokenNotFound'
          : 'devstudio.errors.dieterTokens.tokenNotEditable',
    };
  }
  if (
    file.valueValidator &&
    context.declarations
      .filter((declaration) => file.tokenPattern.test(declaration.name))
      .some(
        (declaration) =>
          context.counts.get(declaration.name) !== 1 ||
          !isEditableDieterToken(file, declaration.name, declaration.value, context),
      )
  ) {
    return { ok: false, reasonKey: file.reasonKey };
  }
  const current = matches[0];
  if (
    !isEditableDieterToken(file, token, current.value, context) ||
    !isEditableDieterToken(file, token, value, context)
  ) {
    return { ok: false, reasonKey: file.reasonKey };
  }

  return {
    ok: true,
    raw: `${raw.slice(0, current.valueStart)}${value}${raw.slice(current.valueEnd)}`,
  };
}
