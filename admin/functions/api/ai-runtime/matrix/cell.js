import { handlePolicyCellRequest } from '../../../_shared/policy-github.js';

export async function onRequest(context) {
  return handlePolicyCellRequest(context, 'aiRuntime');
}
