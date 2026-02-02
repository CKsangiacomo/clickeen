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
  }
}

export {};
