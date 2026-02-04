declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare module '*.css?raw' {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    __CK_ENTITLEMENTS__?: import('@clickeen/ck-policy').EntitlementsMatrix;
    __CK_ENTITLEMENTS_META__?: typeof import('@clickeen/ck-policy').CAPABILITY_META;
    __CK_AI_ACCESS__?: {
      providers?: Array<{ provider: import('@clickeen/ck-policy').AiProvider; label: string }>;
      byTier: Partial<
        Record<
          import('@clickeen/ck-policy').PolicyProfile,
          {
            policyProfile: import('@clickeen/ck-policy').PolicyProfile;
            aiProfile: import('@clickeen/ck-policy').AiProfile;
            defaultProvider: import('@clickeen/ck-policy').AiProvider;
            defaultProviderLabel: string;
            providers: Array<{
              provider: import('@clickeen/ck-policy').AiProvider;
              label: string;
              defaultModel: string;
              defaultModelLabel: string;
              models: Array<{ model: string; label: string }>;
            }>;
          }
        >
      >;
    };
  }
}

export {};
