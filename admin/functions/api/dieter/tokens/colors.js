import { handleDieterTokensRequest } from '../../../_shared/dieter-tokens.js';

export async function onRequest(context) {
  return handleDieterTokensRequest(context, 'colors');
}
