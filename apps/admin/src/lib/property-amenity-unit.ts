// Sentinel <select> value for the "Property Amenity" choice (income not tied to a unit).
// Not a UUID, so it never collides with a real unit id; the dialog maps it to unitId: null.
export const PROPERTY_AMENITY_UNIT_VALUE = "__property_amenity__";

export function isPropertyAmenityUnit(unitId: string): boolean {
  return unitId === PROPERTY_AMENITY_UNIT_VALUE;
}
