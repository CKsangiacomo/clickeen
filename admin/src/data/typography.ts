import generated from './typography.generated.json';

const defaultSample = 'The quick brown fox jumps over the lazy dog';

export interface TypographySample {
  name: string;
  className: string;
  sample?: string;
}

export interface TypographySection {
  title: string;
  samples: TypographySample[];
}

const nameFromClass = (className: string): string =>
  className.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const BODY_SCALE = [
  'body-xxs',
  'body-xs',
  'body-s',
  'body-m',
  'body-l',
  'body-xl',
  'body-xxl',
];

const WEBSITE_BODY_SCALE = ['body-website', 'body-website-large', 'body-website-xlarge'];

const LABEL_SCALE = [
  'label-xxs',
  'label-xs',
  'label-s',
  'label-m',
  'label-l',
  'label-xl',
  'label-xxl',
  'caption',
  'caption-small',
  'overline',
  'overline-small',
];

const SECTION_FILTER: Record<string, Set<string> | undefined> = {
  Body: new Set(BODY_SCALE),
  'Labels & Captions': new Set(LABEL_SCALE),
};

const SECTION_ORDER: Record<string, string[] | undefined> = {
  Body: BODY_SCALE,
  'Labels & Captions': LABEL_SCALE,
};

const flatLookup = Object.values(generated)
  .flat()
  .reduce<Record<string, string>>((acc, entry) => {
    acc[entry.className] = entry.sample ?? defaultSample;
    return acc;
  }, {});

const buildScale = (classes: string[]): TypographySample[] =>
  classes.map((className) => ({
    name: nameFromClass(className),
    className,
    sample: flatLookup[className] ?? defaultSample,
  }));

export const typographySections: TypographySection[] = [
  {
    title: 'Marketing Display',
    samples: (generated['Marketing Display'] ?? []).map((entry) => ({
      name: nameFromClass(entry.className),
      className: entry.className,
      sample: entry.sample ?? defaultSample,
    })),
  },
  {
    title: 'Headings',
    samples: generated['Headings'].map((entry) => ({
      name: nameFromClass(entry.className),
      className: entry.className,
      sample: entry.sample ?? defaultSample,
    })),
  },
  {
    title: 'Body',
    samples: buildScale(BODY_SCALE),
  },
  {
    title: 'Website Body',
    samples: buildScale(WEBSITE_BODY_SCALE),
  },
  {
    title: 'Labels & Captions',
    samples: buildScale(LABEL_SCALE),
  },
];

export function getTypographySampleText(sample?: string): string {
  return sample ?? defaultSample;
}
