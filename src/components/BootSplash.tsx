/** The loading screen. index.html paints the same markup before any script runs, so opening the app shows one steady screen until the store fades in. */
export const BootSplash = () => (
  <div className="boot-splash" role="status" aria-label="Loading">
    <span />
  </div>
);
