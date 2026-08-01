export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}

  let element: HTMLTextAreaElement | null = null;
  try {
    element = document.createElement('textarea');
    element.value = text;
    element.setAttribute('readonly', 'true');
    element.style.position = 'fixed';
    element.style.top = '-1000px';
    element.style.left = '-1000px';
    document.body.appendChild(element);
    element.select();
    const copied = document.execCommand('copy');
    return copied;
  } catch {
    return false;
  } finally {
    element?.remove();
  }
}
