export type PlatformKey = "cycling" | "f1" | "football";
export type HeaderMenuKey =
  | "news"
  | "games"
  | "riderPoints"
  | "forum"
  | "chat"
  | "myGames"
  | "footballPredictions"
  | "footballKnockout"
  | "footballStandings"
  | "admin";

export interface PlatformConfig {
  key: PlatformKey;
  label: string;
  hostPrefixes: string[];
  primaryHostPrefix: string;
  internalBasePath: string | null;
  rootEntryPath: string;
  publicEntryPath: string;
  authenticatedEntryPath: string;
  accountPath: string;
  headerMenuItems: HeaderMenuKey[];
  authImages: {
    login: string;
    register: string;
    resetPassword: string;
    verifyEmail: string;
  };
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    key: "cycling",
    label: "Cycling",
    hostPrefixes: ["cycling"],
    primaryHostPrefix: "cycling",
    internalBasePath: null,
    rootEntryPath: "/account",
    publicEntryPath: "/preview/wielerspellen",
    authenticatedEntryPath: "/account",
    accountPath: "/account",
    headerMenuItems: ["news", "games", "chat", "forum", "admin"],
    authImages: {
      login: "/homepage_picture_5.jpg",
      register: "/homepage_picture_1.jpg",
      resetPassword: "/homepage_picture_2.jpg",
      verifyEmail: "/homepage_picture_3.jpg",
    },
  },
  {
    key: "f1",
    label: "Formula 1",
    hostPrefixes: ["f1"],
    primaryHostPrefix: "f1",
    internalBasePath: "/f1",
    rootEntryPath: "/f1",
    publicEntryPath: "/preview/f1",
    authenticatedEntryPath: "/f1",
    accountPath: "/f1/account",
    headerMenuItems: ["admin"],
    authImages: {
      login: "/homepage_picture_f1.webp",
      register: "/homepage_picture_f1.webp",
      resetPassword: "/homepage_picture_f1.webp",
      verifyEmail: "/homepage_picture_f1.webp",
    },
  },
  {
    key: "football",
    label: "Football",
    hostPrefixes: ["footbal", "football"],
    primaryHostPrefix: "football",
    internalBasePath: "/wk-2026",
    rootEntryPath: "/login",
    publicEntryPath: "/preview/wk-2026",
    authenticatedEntryPath: "/wk-2026/predictions",
    accountPath: "/wk-2026/account",
    headerMenuItems: ["footballPredictions", "footballKnockout", "footballStandings", "admin"],
    authImages: {
      login: "/homepage_picture_wk.webp",
      register: "/homepage_picture_wk.webp",
      resetPassword: "/homepage_picture_wk.webp",
      verifyEmail: "/homepage_picture_wk.webp",
    },
  },
];

export interface ResolvedPlatform {
  platform: PlatformConfig;
  isMatchedSubdomain: boolean;
}

function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

function extractSubdomain(host: string | null | undefined): string | null {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost || normalizedHost === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) {
    return null;
  }

  const [firstPart] = normalizedHost.split(".");
  return firstPart || null;
}

export function getPlatformFromHost(host: string | null | undefined): PlatformKey {
  return resolvePlatformFromHost(host).platform.key;
}

export function getPlatformConfig(platform: PlatformKey): PlatformConfig {
  return PLATFORM_CONFIGS.find((config) => config.key === platform) ?? PLATFORM_CONFIGS[0];
}

export function getPlatformConfigFromHost(host: string | null | undefined): PlatformConfig {
  return getPlatformConfig(getPlatformFromHost(host));
}

export function getAllPlatformConfigs(): PlatformConfig[] {
  return PLATFORM_CONFIGS;
}

export function getForeignPlatformPathPrefixes(currentPlatformKey: PlatformKey): string[] {
  const prefixes = new Set<string>();

  for (const platform of PLATFORM_CONFIGS) {
    if (platform.key === currentPlatformKey) {
      continue;
    }

    if (platform.internalBasePath) {
      prefixes.add(platform.internalBasePath);
    }

    if (platform.publicEntryPath !== "/") {
      prefixes.add(platform.publicEntryPath);
    }
  }

  return Array.from(prefixes);
}

export function resolvePlatformFromHost(host: string | null | undefined): ResolvedPlatform {
  const subdomain = extractSubdomain(host);

  if (!subdomain) {
    return {
      platform: getPlatformConfig("cycling"),
      isMatchedSubdomain: false,
    };
  }

  const matchedPlatform = PLATFORM_CONFIGS.find((platform) =>
    platform.hostPrefixes.includes(subdomain),
  );

  if (!matchedPlatform) {
    return {
      platform: getPlatformConfig("cycling"),
      isMatchedSubdomain: false,
    };
  }

  return {
    platform: matchedPlatform,
    isMatchedSubdomain: true,
  };
}

export function buildPlatformUrl(currentHost: string, targetPlatform: PlatformConfig, pathname = "/"): string {
  const normalizedHost = normalizeHost(currentHost);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const protocol = normalizedHost.includes(".online") ? "https" : "http";

  if (!normalizedHost) {
    return path;
  }

  if (normalizedHost === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) {
    const port = currentHost.includes(":") ? currentHost.split(":")[1] : "";
    return `http://${targetPlatform.primaryHostPrefix}.oracle-games.local${port ? `:${port}` : ""}${path}`;
  }

  const [hostname, port] = currentHost.split(":");

  if (hostname.endsWith(".oracle-games.online")) {
    return `https://${targetPlatform.primaryHostPrefix}.oracle-games.online${path}`;
  }

  if (hostname === "oracle-games.online") {
    return `https://${targetPlatform.primaryHostPrefix}.oracle-games.online${path}`;
  }

  if (hostname.endsWith(".oracle-games.local")) {
    return `http://${targetPlatform.primaryHostPrefix}.oracle-games.local${port ? `:${port}` : ""}${path}`;
  }

  if (hostname === "oracle-games.local") {
    return `http://${targetPlatform.primaryHostPrefix}.oracle-games.local${port ? `:${port}` : ""}${path}`;
  }

  const hostParts = hostname.split(".");
  if (hostParts.length > 2) {
    hostParts[0] = targetPlatform.primaryHostPrefix;
    return `${protocol}://${hostParts.join(".")}${port ? `:${port}` : ""}${path}`;
  }

  return `${protocol}://${hostname}${port ? `:${port}` : ""}${path}`;
}
