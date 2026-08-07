let counter = 0;

/** Client-generated ids so a write never waits on a round trip. §2.2 */
export function newId(prefix = 'id'): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}
