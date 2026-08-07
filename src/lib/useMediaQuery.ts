import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** The breakpoint where the product stops being the web app and becomes the mobile
 *  subset: sidebar out, tab bar in, task detail a full route rather than a panel. §6.2 */
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
