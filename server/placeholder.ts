const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">' +
  '<rect width="600" height="600" fill="#e5e2de"/>' +
  '<text x="300" y="310" font-family="Arial, sans-serif" font-size="28" fill="#7f7666" text-anchor="middle">No photo yet</text>' +
  '</svg>';

/** Shown for products and categories that have no photo, instead of someone else's stock image. */
export const PLACEHOLDER_IMAGE = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`;
