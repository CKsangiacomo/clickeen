declare const value: {
  events: {
    openEditor: string;
    sessionReady: string;
    ack: string;
    applied: string;
    failed: string;
  };
  timing: {
    ackRetryMs: number;
    maxAckAttempts: number;
    timeoutMs: number;
  };
};

export default value;
