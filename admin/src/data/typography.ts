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

const generatedSections = generated as Record<string, Array<{ className: string; sample?: string }>>;

export const typographySections: TypographySection[] = Object.entries(generatedSections).map(([title, entries]) => ({
  title,
  samples: entries.map((entry) => ({
    name: nameFromClass(entry.className),
    className: entry.className,
    sample: entry.sample ?? defaultSample,
  })),
}));

export const typographyRoleCount = typographySections.reduce((count, section) => count + section.samples.length, 0);

export const typographyTokenClasses: TypographySample[] = typographySections.flatMap((section) =>
  section.samples.map((sample) => ({
    name: sample.name,
    className: sample.className,
    sample: sample.sample,
  })),
);

export function getTypographySampleText(sample?: string): string {
  return sample ?? defaultSample;
}
