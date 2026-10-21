/**
 * Looks up product details for a barcode using the free, open, keyless
 * Open Food Facts API (https://world.openfoodfacts.org). This is a
 * community-run open database — no paid API, no signup, no rate-limit key.
 *
 * Coverage is strongest for packaged grocery/FMCG products, but even for
 * matched products, many regional/local items have sparse data (empty
 * category/quantity/ingredient fields) — that's a real gap in the free
 * source data, not a bug. We pull from several fields and fall back
 * gracefully so we get *something* whenever the underlying data allows it.
 */
const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';

/**
 * @param {string} barcode - an EAN-13 (or compatible) barcode
 * @returns {Promise<{name: string, description: string, categoryGuess: string|null, imageUrl: string|null} | null>}
 *   `categoryGuess` is a raw category name string (e.g. "Snacks") for the
 *   caller to fuzzy-match against its own category list — Open Food Facts
 *   categories never line up 1:1 with any app's internal category IDs, so
 *   matching has to happen on the caller's side.
 *   Resolves to null if no match was found, rather than throwing — a "not
 *   found" barcode is an expected, normal outcome, not an error.
 */
export async function lookupProductByBarcode(barcode) {
  const fields = [
    'product_name',
    'generic_name',
    'brands',
    'categories',
    'categories_tags',
    'image_url',
    'quantity',
    'ingredients_text_en',
    'ingredients_text',
  ].join(',');
  const url = `${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(barcode)}.json?fields=${fields}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Product lookup service responded with ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 1 || !data.product) {
    return null; // Not found — a normal, expected outcome for many barcodes.
  }

  const p = data.product;
  const name = [p.product_name || p.generic_name, p.brands].filter(Boolean).join(' — ') || null;
  if (!name) return null; // Some entries exist but have no usable name; treat as not found.

  // Try several fields, in order, for a usable description — many regional
  // products only have one or two of these populated, rarely all of them.
  const descriptionParts = [];
  if (p.quantity) descriptionParts.push(p.quantity);
  if (p.categories) {
    descriptionParts.push(p.categories.split(',')[0].trim());
  } else if (p.categories_tags?.length) {
    descriptionParts.push(p.categories_tags[0].replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
  }
  const ingredientsText = p.ingredients_text_en || p.ingredients_text;
  if (descriptionParts.length === 0 && ingredientsText) {
    descriptionParts.push(ingredientsText.slice(0, 100));
  }

  // Raw category guess for the caller to fuzzy-match against its own list.
  let categoryGuess = null;
  if (p.categories) {
    categoryGuess = p.categories.split(',')[0].trim();
  } else if (p.categories_tags?.length) {
    categoryGuess = p.categories_tags[0].replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
  }

  return {
    name,
    description: descriptionParts.join(' · ') || '',
    categoryGuess,
    imageUrl: p.image_url || null,
  };
}

/**
 * Best-effort match between an online category guess (free text, from
 * Open Food Facts) and the app's own category list. Case-insensitive
 * substring match in both directions, since neither source's naming lines
 * up exactly (e.g. "Snacks" vs "snacks and crisps").
 *
 * @param {string|null} categoryGuess
 * @param {Array<{id: number, name: string}>} categories
 * @returns {number|string} matching category id, or '' if no confident match
 */
export function matchCategory(categoryGuess, categories) {
  if (!categoryGuess || !categories?.length) return '';
  const guess = categoryGuess.toLowerCase();
  const match = categories.find(
    (c) => guess.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(guess)
  );
  return match ? match.id : '';
}
