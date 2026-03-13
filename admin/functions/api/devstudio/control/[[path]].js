export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname || '/api/devstudio/control';
  return new Response(
    JSON.stringify({
      error: {
        kind: 'NOT_IMPLEMENTED',
        reasonKey: 'coreui.errors.internalControl.sharedRuntimePending',
        detail: pathname,
      },
    }),
    {
      status: 501,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}
