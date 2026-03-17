declare global {
  interface CloudflareEnv {
    TOKYO_ASSET_CONTROL: {
      fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
    };
    TOKYO_PRODUCT_CONTROL: {
      fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
    };
  }
}

export {};
