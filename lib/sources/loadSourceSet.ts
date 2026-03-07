import sourceMapRaw from "@/config/source-map.json";
import { CaseType, RouteType, SelectedSourceSet, SourceMapConfig } from "@/lib/legal/types";

const sourceMap = sourceMapRaw as SourceMapConfig;

export function getSourceMapConfig(): SourceMapConfig {
  return sourceMap;
}

export function loadSourceSet(caseType: CaseType, route: RouteType): SelectedSourceSet | null {
  const caseConfig = sourceMap.caseTypes[caseType];
  if (!caseConfig) {
    return null;
  }

  if (!caseConfig.routes.includes(route)) {
    return null;
  }

  return {
    caseType,
    route,
    allowedDomains: sourceMap.allowlistDomains,
    primarySources: caseConfig.primarySources.map((domain) => ({
      domain,
      url: `https://${domain}`,
      role: "primary" as const,
    })),
    useCaseLaw: caseConfig.useCaseLaw,
  };
}

export function isRouteAllowedForCase(caseType: CaseType, route: RouteType): boolean {
  const caseConfig = sourceMap.caseTypes[caseType];
  if (!caseConfig) return false;
  return caseConfig.routes.includes(route);
}
