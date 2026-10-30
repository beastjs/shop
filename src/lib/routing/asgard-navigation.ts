import { asgardRoutePrefix, supportsAsgardSubdomain, toAsgardSubdomainHostname } from './asgard-console'
import { getAppRootHostname } from './console-host'

/** Builds the Asgard URL for its own host, or its path fallback when needed. */
export function buildAsgardNavigationUrl(currentUrl: URL): URL {
  const appHostname = getAppRootHostname(currentUrl.hostname)
  const useSubdomain = supportsAsgardSubdomain(appHostname)
  const targetUrl = new URL(currentUrl)

  targetUrl.hostname = useSubdomain ? toAsgardSubdomainHostname(appHostname) : appHostname
  targetUrl.pathname = useSubdomain ? '/' : asgardRoutePrefix
  targetUrl.search = ''
  targetUrl.hash = ''

  return targetUrl
}
