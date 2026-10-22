import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { UserError } from './bugReport';

/**
 * Saves a file to the device instead of opening it, on phones and desktop alike. A PDF blob link opens in the browser's viewer tab,
 * so the download is made from a blob typed as a plain binary file, which browsers always save.
 * Inside the Android/iOS app a web page cannot download, so the file is written to the app's cache and the phone's share sheet opens
 * (Save to Files, WhatsApp, Drive, Print).
 */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // An app installed before file saving was added: the live site is newer than the app on the phone.
    if (!Capacitor.isPluginAvailable('Filesystem') || !Capacitor.isPluginAvailable('Share')) throw new UserError('Please update the app to save files. Install the latest version, then try again.');
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: name, files: [uri] }).catch(() => {}); // closing the share sheet is not an error
    return;
  }
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
