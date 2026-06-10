export type ComponentSpec = Record<string, unknown> & {
  defaults?: unknown;
  previews?: unknown;
};

export interface ComponentSource {
  name: string;
  title: string;
  spec: ComponentSpec;
  template?: string;
  css?: string;
  paths: {
    spec: string;
    template?: string;
    css?: string;
  };
}
