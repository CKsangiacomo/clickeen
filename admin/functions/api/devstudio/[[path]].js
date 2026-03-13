export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname || '/api/devstudio';
  return new Response(
    JSON.stringify({
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.route.notFound',
        detail: pathname,
      },
    }),
    {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}
