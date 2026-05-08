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
    __CK_ENTITLEMENTS_META__?: typeof import('@clickeen/ck-policy').ENTITLEMENT_META;
    __CK_AI_ACCESS__?: {
      providers?: Array<{ provider: import('@clickeen/ck-contracts/ai').AiProvider; label: string }>;
      models?: Array<import('@clickeen/ck-contracts/ai').AiModelCatalogEntry>;
      agents?: Array<{
        agentId: string;
        description: string;
        category: 'copilot' | 'system_agent';
        taskClass: string;
        executionSurface: import('@clickeen/ck-contracts/ai').AiExecutionSurface;
        requiredEntitlements: string[];
        supportedProviders: Array<{ provider: import('@clickeen/ck-contracts/ai').AiProvider; label: string }>;
        byTier: Partial<
          Record<
            import('@clickeen/ck-policy').PolicyProfile,
            {
              policyProfile: import('@clickeen/ck-policy').PolicyProfile;
              enabled: boolean;
              deniedEntitlement: string | null;
              allowModelPicker: boolean;
              defaultProvider: import('@clickeen/ck-contracts/ai').AiProvider | '';
              defaultProviderLabel: string;
              modelOptions: Array<{
                provider: import('@clickeen/ck-contracts/ai').AiProvider;
                model: string;
                label: string;
              }>;
              providers: Array<{
                provider: import('@clickeen/ck-contracts/ai').AiProvider;
                label: string;
                defaultModel: string;
                defaultModelLabel: string;
                models: Array<{ model: string; label: string }>;
              }>;
            }
          >
        >;
      }>;
      copilots?: Window['__CK_AI_ACCESS__']['agents'];
      systemAgents?: Window['__CK_AI_ACCESS__']['agents'];
    };
  }
}

export {};
