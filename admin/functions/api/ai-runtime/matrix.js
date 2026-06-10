import { handlePolicyMatrixRequest } from '../../_shared/policy-github.js';

export async function onRequest(context) {
  return handlePolicyMatrixRequest(context, 'aiRuntime');
}
