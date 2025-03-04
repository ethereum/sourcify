/**
 * Checks whether the provided object contains any keys or not.
 * @param obj The object whose emptiness is tested.
 * @returns true if any keys present; false otherwise
 */
export function isEmpty(obj: object): boolean {
  return !Object.keys(obj).length && obj.constructor === Object;
}
