type SSRSafeLocation = Pick<Location, 'pathname' | 'origin' | 'search' | 'hash'>

export const ssrSafeDocument = typeof document === 'undefined' ? undefined : document;
export const ssrSafeWindow = typeof window === 'undefined' ? undefined : window;
export const ssrSafeHistory = typeof history === 'undefined' ? undefined : history;

export const ssrSafeLocation: SSRSafeLocation = typeof location === 'undefined' ? {pathname: '', origin: '', search: '', hash: ''} : location;


export function setLocation(url: string) {
  const parsedURL: SSRSafeLocation = new URL(url);
  const {pathname, origin, search, hash} = parsedURL;

  Object.assign(ssrSafeLocation, {pathname, origin, search, hash});
}
