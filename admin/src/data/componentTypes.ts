export interface ComponentSource {
  name: string;
  title: string;
  spec: any;
  template?: string;
  css?: string;
  paths: {
    spec: string;
    template?: string;
    css?: string;
  };
}
