import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ADAPTIVE_DP, ADAPTIVE_SIZES, adaptiveForeground, appIdFor, cornerColor, mainActivityJava, merchantFileFor, merchantFrom, nativeBuildValues, patchAndroidShell, patchManifest, patchStyles, safeColor } from '../scripts/storeApp';
import { PLATFORM_ICON_BOX_DP, platformForegroundSvg } from '../scripts/platformApp';

/** Extent of the non-transparent pixels of a square foreground layer, in dp of the 108dp canvas (1px of slack for antialiasing). */
async function extent(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, c = (w - 1) / 2, dp = ADAPTIVE_DP.canvas / w;
  let x0 = w, y0 = w, x1 = -1, y1 = -1, far = 0;
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); far = Math.max(far, Math.hypot(x - c, y - c)); }
  return { width: (x1 - x0 + 1) * dp, height: (y1 - y0 + 1) * dp, far: far * dp, slack: dp };
}

describe('store app generator', () => {
  it('sanitises app ids', () => {
    expect(appIdFor('acme-jewels')).toBe('com.antarixs.acmejewels');
    expect(appIdFor('Shop_9')).toBe('com.antarixs.shop9');
    expect(appIdFor('9lives')).toBe('com.antarixs.s9lives');
    expect(() => appIdFor('--')).toThrow();
  });
  it('reads live, export and bare shapes', () => {
    const m = { brand: { name: 'Acme' } };
    for (const j of [{ data: m }, { store: { merchant: m } }, m]) expect(merchantFrom(j)).toBe(m);
    expect(() => merchantFrom({})).toThrow();
  });
  it('produces build values and the merchant file', () => {
    const m = { brand: { name: 'Acme', logoUrl: 'https://x/l.png' }, theme: { colors: { surface: '#111111' } } };
    const v = nativeBuildValues('acme', m, 'https://api.example.com/');
    expect(v).toMatchObject({ appId: 'com.antarixs.acme', appName: 'Acme', themeColor: '#111111', env: { MERCHANT: 'acme', VITE_STORE: 'acme', VITE_API_BASE: 'https://api.example.com' } });
    expect(merchantFileFor('acme', m).android.packageName).toBe('com.antarixs.acme');
    expect(() => nativeBuildValues('A!', m, '')).toThrow();
  });
});

describe('adaptive launcher icon safe zone', () => {
  const solid = (w: number, h: number, background: string | { r: number; g: number; b: number; alpha: number }) => sharp({ create: { width: w, height: h, channels: 4, background } }).png().toBuffer();

  it('keeps any store logo inside the centre 66dp at every density', async () => {
    const logos = [await solid(512, 512, '#c0392b'), await solid(1200, 300, '#2e86c1'), await solid(64, 64, '#ffffff')]; // square tile, wide wordmark, small
    for (const logo of logos)
      for (const px of Object.values(ADAPTIVE_SIZES)) {
        const e = await extent(await adaptiveForeground(logo, px));
        expect(e.width).toBeLessThanOrEqual(ADAPTIVE_DP.safe + e.slack);
        expect(e.height).toBeLessThanOrEqual(ADAPTIVE_DP.safe + e.slack);
      }
  });

  it('keeps the Antarixs mark inside the 66dp box and the 33dp circle every mask shape leaves visible', async () => {
    for (const px of Object.values(ADAPTIVE_SIZES)) {
      const e = await extent(await adaptiveForeground(Buffer.from(platformForegroundSvg()), px, PLATFORM_ICON_BOX_DP));
      expect(e.width).toBeLessThanOrEqual(ADAPTIVE_DP.safe + e.slack);
      expect(e.height).toBeLessThanOrEqual(ADAPTIVE_DP.safe + e.slack);
      expect(e.far).toBeLessThanOrEqual(ADAPTIVE_DP.safe / 2 + e.slack);
    }
  });

  it('writes 108dp layers per density', () => {
    expect(ADAPTIVE_SIZES).toEqual({ mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 });
  });

  it('takes the background from the logo corner, white when the corner is see-through', async () => {
    expect(await cornerColor(await solid(8, 8, '#c0392b'))).toBe('#c0392b');
    expect(await cornerColor(await solid(8, 8, { r: 0, g: 0, b: 0, alpha: 0 }))).toBe('#ffffff');
  });
});

describe('Android shell patches', () => {
  const manifest = '<activity\n            android:configChanges="orientation|screenSize"\n            android:name=".MainActivity"\n            android:label="@string/title_activity_main">';
  const styles = '<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:background">@null</item>\n    </style>\n    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">\n        <item name="android:background">@drawable/splash</item>\n    </style>';

  it('sets adjustResize once', () => {
    const once = patchManifest(manifest);
    expect(once).toContain('android:windowSoftInputMode="adjustResize"');
    expect(patchManifest(once)).toBe(once);
  });

  it('colours the window and the launch screen from splash_bg once', () => {
    const once = patchStyles(styles);
    expect(once).toContain('<item name="android:windowBackground">@color/splash_bg</item>');
    expect(once).toContain('<item name="android:background">@color/splash_bg</item>');
    expect(once).toContain('<item name="windowSplashScreenBackground">@color/splash_bg</item>');
    expect(once).not.toContain('@drawable/splash');
    expect(patchStyles(once)).toBe(once);
  });

  it('turns edge to edge on before the bridge starts', () => {
    const java = mainActivityJava('com.antarixs.acme');
    expect(java).toContain('package com.antarixs.acme;');
    expect(java.indexOf('EdgeToEdge.enable(this);')).toBeGreaterThan(0);
    expect(java.indexOf('EdgeToEdge.enable(this);')).toBeLessThan(java.indexOf('super.onCreate'));
  });

  it('only lets plain hex colours into the XML', () => {
    expect(safeColor('#F7F1E8', '#000')).toBe('#F7F1E8');
    expect(safeColor('</color><x/>', '#000')).toBe('#000');
    expect(safeColor('rgb(1,2,3)', '#000')).toBe('#000');
    expect(safeColor(undefined, '#000')).toBe('#000');
  });

  it('patches a generated project and a second run changes nothing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'android-shell-'));
    try {
      const main = path.join(dir, 'app/src/main');
      const write = (f: string, s: string) => { fs.mkdirSync(path.dirname(path.join(main, f)), { recursive: true }); fs.writeFileSync(path.join(main, f), s); };
      write('AndroidManifest.xml', manifest);
      write('res/values/styles.xml', styles);
      write('res/drawable/splash.png', 'x');
      write('res/drawable-port-hdpi/splash.png', 'x');
      write('java/com/antarixs/acme/MainActivity.java', 'package com.antarixs.acme;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n');
      const snapshot = () => ['AndroidManifest.xml', 'res/values/styles.xml', 'res/values/splash_bg.xml', 'res/values-night/splash_bg.xml', 'java/com/antarixs/acme/MainActivity.java'].map((f) => fs.readFileSync(path.join(main, f), 'utf8'));
      patchAndroidShell(dir, '#f7f1e8');
      const first = snapshot();
      patchAndroidShell(dir, '#f7f1e8');
      expect(snapshot()).toEqual(first);
      expect(first[2]).toContain('#f7f1e8');
      expect(first[3]).toContain('#180e14');
      expect(first[4]).toContain('EdgeToEdge.enable');
      expect(fs.existsSync(path.join(main, 'res/drawable/splash.png'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
