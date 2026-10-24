# Responsive: manual real-device checklist

Things Playwright cannot show (no IME, no cut-out, no WebView font scale, no real Android APK). Tick on a real device or the emulator. `tests/e2e/README.md` lists what is automated.

## Sizes (portrait unless noted)

- [ ] 320x568
- [ ] 360x640
- [ ] 390x844
- [ ] 412x915
- [ ] 430x932
- [ ] Landscape 844x390
- [ ] Landscape 915x412
- [ ] Foldable folded 344x882
- [ ] Foldable unfolded 673x841 (today this is the phone layout: TABLET_MIN is 700; confirm what you see)
- [ ] Tablet 768x1024
- [ ] Tablet 1024x768
- [ ] Tablet 1024x1366
- [ ] Laptop 1280x800

On each: buyer home, catalogue, an open design, cart/orders, owner hub, new product, sign-up. No sideways scroll, nothing under a bar, text readable.

## Font scale 200%

- [ ] Android: Settings > Display > Font size and display size, largest (and Display size largest). Walk the screens above. Rem-sized text grows; px-sized text does not (Phase 3 converts it).

## Keyboard (type in every field; the field must stay visible, Save reachable)

- [ ] Sign-up (all three steps, then the code box)
- [ ] Buyer sign-in: phone, then OTP
- [ ] New product (every field, long description)
- [ ] Order note
- [ ] Android 7-10 as well as 11+ (adjustResize in the APK)

## Rotation during an action

- [ ] During a photo crop (pan and zoom, then rotate both ways): photo stays on the same part of the frame
- [ ] During the buyer tour (rotate on step 3 and on a step that lights a bottom bar): same step, highlight follows the element
- [ ] With a design open, a cart, a half-filled sign-up, a typed OTP, a scrolled grid: all still there

## Android APK (built by the Antarixs app workflow; the Android agent could not run these)

- [ ] Run the "Antarixs app" workflow and install the APK
- [ ] EdgeToEdge is on the classpath (build succeeds, content draws behind the bars, insets respected)
- [ ] Splash colour on Android 12+ is the brand colour, not white or the icon on grey
- [ ] Keyboard on Android 7-10 (see above)
- [ ] Status bar colour and icon contrast match the screen on home, a design, the owner hub, dark and light
- [ ] Back button: closes a design, then the cart, then leaves

## Hardware cut-outs and the keyboard bars

- [ ] Landscape on a phone with a notch or punch-hole: header, tabs and buttons stay out of the cut-out side (both rotations)
- [ ] Tap Save (new product, order) while a text field is focused: the first tap saves (the bars come back 200ms after blur; check the tap is not lost or lands on the wrong control)

## Foldable (real device)

- [ ] Fold and unfold with a design open and the grid scrolled: same design, no jump to top
- [ ] Note: Capacitor has no fold-posture API, so only width changes apply (no tabletop or book-mode reaction)
