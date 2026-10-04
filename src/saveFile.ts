/**
 * Saves a file to the device instead of opening it, on phones and desktop alike. A PDF blob link opens in the browser's viewer tab,
 * so the download is made from a blob typed as a plain binary file, which browsers always save.
 */
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
