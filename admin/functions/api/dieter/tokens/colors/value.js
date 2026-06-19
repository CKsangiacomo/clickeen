import { handleDieterTokenValueRequest } from '../../../../_shared/dieter-tokens.js';

export async function onRequest(context) {
  return handleDieterTokenValueRequest(context, 'colors');
}
