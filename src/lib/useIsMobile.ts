import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 768px)';

function readMatches(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(readMatches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
