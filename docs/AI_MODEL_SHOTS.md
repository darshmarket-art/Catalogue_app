# AI model shots (necklace and ring recipes)

For NEW products only (Add design / Add collection upload). Existing photos and the AI Enhance button are untouched.

## Recipes
- **Black necklace** (`black-necklace`): neck pieces on a model, all-black low-key editorial, face not shown, jewellery in full contrast. Suggested when the collection tag is a neck piece (necklace, chain, pendant, haar, mangalsutra, choker, locket).
- **Ring on woman's / man's hand** (`ring-hand-women`, `ring-hand-men`): the same saved hand for every ring; only the ring changes. Suggested (woman's) when the tag is a ring; the owner can pick the man's hand instead.

## How it works
1. Per store and per shot (`neck-women`, `ring-women`, `ring-men`) the owner makes a **model shot once**: a hand or neck with no jewellery on pure black. Server: `POST /api/admin/photos/render {baseShot}` (text-only prompt `BASE_PROMPTS`, charged like a normal render at the `model-base` price, default Rs 12; refund/idempotency/monthly cap are the existing flow).
2. The owner sees it and chooses **Use this model** (`POST /api/admin/photos/model-shots {shot, ref}`) or **Draw another** (charged again). Approval only accepts a render made as that exact base shot in this store (`renders/<file>` metadata `baseShot`), so another store's or a product image cannot be approved. The pointer lives in the store's `modelShots/<shot>` document; blobs are never deleted, and the old shot stays in storage when it is changed (**Change model shot**).
3. Every product render with a recipe sends **two images** to the model: image 1 = the approved base shot (keep person, pose, skin, lighting, pure black background), image 2 = the product photo (the piece, identical design). `renderStudio(image, mime, prompt, extra[])` takes extra reference images; single-image calls are unchanged. Output stays at the 2K setting; the result is stored as is (no post-processing of the piece).
4. No approved shot yet: the server answers 409 `no-model-shot` before any charge, and the picker guides the owner to "Create model shot" first.

Prices: all recipe styles and `model-base` default to 12 credits; the console can override per style as before.

## Limits
- The model can still drift on tiny details (stone count, filigree) and may slightly change the hand. Test real renders on about 5 pieces before relying on it; the owner always sees a compare screen before accepting.
- Cost: 2 input images per recipe render (a little more than a single-image render).
- Not built: earrings and bracelet shots (add a `MODEL_SHOTS` entry, a `BASE_PROMPTS` entry, a recipe style and `SHOT_OF` mapping).
- No real Vertex AI call was made while building this; all tests fake the model.
