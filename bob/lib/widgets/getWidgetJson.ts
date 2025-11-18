// Placeholder loader: resolves the widget JSON (single file today).
export async function getWidgetJson(widgetname: string): Promise<any> {
  // TODO: wire to Paris API when ready
  return { widgetName: widgetname, defaults: {} };
}

