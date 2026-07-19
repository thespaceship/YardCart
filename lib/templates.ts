/** Product templates offered during onboarding, priced at common market ranges (owner edits). */
export const PRODUCT_TEMPLATES: {
  category: string;
  name: string;
  unit: string;
  priceCents: number;
  description: string;
}[] = [
  { category: "mulch", name: "Double-Shredded Hardwood Mulch", unit: "cubic_yard", priceCents: 3800, description: "Aged double-ground hardwood. Our most popular mulch." },
  { category: "mulch", name: "Black Dyed Mulch", unit: "cubic_yard", priceCents: 4200, description: "Color-enhanced black mulch. Holds color all season." },
  { category: "mulch", name: "Brown Dyed Mulch", unit: "cubic_yard", priceCents: 4200, description: "Color-enhanced brown mulch." },
  { category: "mulch", name: "Red Dyed Mulch", unit: "cubic_yard", priceCents: 4200, description: "Color-enhanced red mulch." },
  { category: "mulch", name: "Cedar Mulch", unit: "cubic_yard", priceCents: 5200, description: "Aromatic cedar. Natural insect deterrent." },
  { category: "mulch", name: "Playground Certified Mulch", unit: "cubic_yard", priceCents: 4600, description: "IPEMA-style certified playground surfacing." },
  { category: "soil", name: "Screened Topsoil", unit: "cubic_yard", priceCents: 3400, description: "3/8\" screened topsoil for lawns and beds." },
  { category: "soil", name: "Garden Mix (Topsoil/Compost Blend)", unit: "cubic_yard", priceCents: 4400, description: "60/40 topsoil-compost blend for planting beds." },
  { category: "soil", name: "Fill Dirt", unit: "cubic_yard", priceCents: 1800, description: "Unscreened fill for grading and holes." },
  { category: "compost", name: "Leaf Compost", unit: "cubic_yard", priceCents: 3600, description: "Fully composted leaf humus." },
  { category: "compost", name: "Mushroom Compost", unit: "cubic_yard", priceCents: 4000, description: "Nutrient-rich spent mushroom substrate." },
  { category: "firewood", name: "Seasoned Hardwood Firewood", unit: "face_cord", priceCents: 14500, description: "Mixed seasoned hardwood, 16\" splits." },
  { category: "firewood", name: "Seasoned Hardwood Firewood (Full Cord)", unit: "cord", priceCents: 39500, description: "Full cord, mixed seasoned hardwood." },
];
