/** Phones with file sharing get the share sheet (Save to Files, WhatsApp...); everything else downloads. */
export const chooseSave = (isTouch: boolean, canShareFiles: boolean): 'share' | 'download' => (isTouch && canShareFiles ? 'share' : 'download');

const isTouchDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

/**
 * Saves a file instead of opening it. A PDF blob link opens in the browser's viewer tab, so the download is made from a blob typed
 * as a plain binary file, which browsers always save. Returns what happened.
 */
export async function saveFile(blob: Blob, name: string, title = name): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  if (chooseSave(isTouchDevice(), Boolean(navigator.canShare?.({ files: [file] }))) === 'share') {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled'; // closing the share sheet is not an error
    }
  }
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
