const PCS_BASE_URL = "https://www.procyclingstats.com";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PCS_FETCH_RIDER") {
    return false;
  }

  fetchRiderStats(message?.payload || {})
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Onbekende fout" }));

  return true;
});

async function fetchRiderStats(payload) {
  const riderName = normalizeSpaces(payload?.riderName || "");
  const providedSlug = sanitizeSlug(payload?.riderSlug || "");

  if (!riderName && !providedSlug) {
    throw new Error("Geen rennernaam gevonden in de klik.");
  }

  const candidateSlugs = buildCandidateSlugs(riderName, providedSlug);

  for (const slug of candidateSlugs) {
    const url = `${PCS_BASE_URL}/rider/${slug}`;
    const profile = await tryFetchProfile(url);
    if (profile) {
      return profile;
    }
  }

  if (riderName) {
    const discoveredSlug = await searchRiderSlug(riderName);
    if (discoveredSlug) {
      const profile = await tryFetchProfile(`${PCS_BASE_URL}/rider/${discoveredSlug}`);
      if (profile) {
        return profile;
      }
    }
  }

  throw new Error(`Geen PCS-profiel gevonden voor "${riderName || providedSlug}".`);
}

async function tryFetchProfile(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  if (!html) {
    return null;
  }

  return parseRiderPage(html, url);
}

async function searchRiderSlug(riderName) {
  const url = `${PCS_BASE_URL}/search.php?term=${encodeURIComponent(riderName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const href =
    extractFirstMatch(html, /<a[^>]*href=["']([^"']*(?:\/|^)rider\/[^"']+)["'][^>]*>/i) || "";
  const slugMatch = href.match(/(?:\/|^)rider\/([^/?#]+)/i);
  return slugMatch ? sanitizeSlug(slugMatch[1]) : null;
}

function parseRiderPage(html, requestedUrl) {
  const pageTitle = cleanText(extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || "");
  if (/page not found|not found|404/i.test(pageTitle)) {
    return null;
  }

  const canonicalHref =
    extractFirstMatch(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) || requestedUrl;
  const canonicalUrl = canonicalHref.startsWith("http") ? canonicalHref : `${PCS_BASE_URL}${canonicalHref}`;
  const riderSlug = extractSlugFromUrl(canonicalUrl) || extractSlugFromUrl(requestedUrl);

  const fullName = cleanText(extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || "");
  const quickInfo = extractQuickInfo(html);
  const infoList = extractInfoList(html);
  const photoUrl = extractRiderPhotoUrl(html);
  const specialties = extractSpecialties(html);
  const socialLinks = extractSocialLinks(html);
  const topResults = extractTopResults(html);
  const rankingBadges = extractRankingBadges(html);
  const visits = extractLabeledValueFromText(cleanText(html), "Visits");

  const rank = quickInfo["PCS Rank"] || quickInfo["UCI Rank"] || "";
  const points = quickInfo["PCS Points"] || quickInfo["UCI Points"] || "";

  if (!fullName && !Object.keys(infoList).length && !Object.keys(quickInfo).length) {
    return null;
  }

  return {
    name: fullName || "",
    slug: riderSlug || "",
    url: canonicalUrl,
    team: infoList["Team"] || "",
    nationality: infoList["Nationality"] || "",
    age: infoList["Age"] || "",
    dateOfBirth: infoList["Date of birth"] || "",
    weight: infoList["Weight"] || "",
    height: infoList["Height"] || "",
    placeOfBirth: infoList["Place of birth"] || "",
    rank,
    points,
    photoUrl,
    specialties,
    socialLinks,
    topResults,
    allTimeRank: rankingBadges["All time"] || "",
    pcsRanking: rankingBadges["PCS Ranking"] || rank || "",
    visits
  };
}

function extractQuickInfo(html) {
  const output = {};
  const quickInfoBlock = extractFirstMatch(
    html,
    /<ul[^>]*class=["'][^"']*rdrquickinfo[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!quickInfoBlock) {
    return output;
  }

  const liMatches = quickInfoBlock.match(/<li\b[\s\S]*?<\/li>/gi) || [];
  liMatches.forEach((liHtml) => {
    const divMatches = liHtml.match(/<div\b[\s\S]*?<\/div>/gi) || [];
    if (divMatches.length < 2) {
      return;
    }
    const key = cleanText(divMatches[0]);
    const value = cleanText(divMatches[divMatches.length - 1]);
    if (key && value) {
      output[key] = value;
    }
  });

  if (Object.keys(output).length === 0) {
    const pairRegex = /<li[^>]*>\s*<div[^>]*>\s*(PCS Rank|UCI Rank|PCS Points|UCI Points)\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/li>/gi;
    let match;
    while ((match = pairRegex.exec(html))) {
      const key = cleanText(match[1]);
      const value = cleanText(match[2]);
      if (key && value) {
        output[key] = value;
      }
    }
  }

  return output;
}

function extractInfoList(html) {
  const output = {};
  const wantedLabels = ["Team", "Name", "Nationality", "Age", "Date of birth", "Weight", "Height", "Place of birth"];
  const plainText = cleanText(html);
  wantedLabels.forEach((label) => {
    const value = extractLabeledValueFromText(plainText, label, wantedLabels);
    if (value) {
      output[label] = value;
    }
  });

  return output;
}

function extractRiderPhotoUrl(html) {
  const img = extractFirstMatch(
    html,
    /<a[^>]*href=["'][^"']*rider\/[^"']*\/statistics[^"']*["'][^>]*>\s*<img[^>]*src=["']([^"']+)["'][^>]*>/i
  );
  if (img) {
    return toAbsoluteUrl(img);
  }

  const fallbackImg = extractFirstMatch(
    html,
    /<img[^>]*class=["'][^"']*(?:rdr|rider)[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/i
  );
  return fallbackImg ? toAbsoluteUrl(fallbackImg) : "";
}

function extractSpecialties(html) {
  const block = extractFirstMatch(
    html,
    /<ul[^>]*class=["'][^"']*\bpps\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!block) {
    return [];
  }

  const out = [];
  const liMatches = block.match(/<li\b[\s\S]*?<\/li>/gi) || [];
  liMatches.forEach((liHtml) => {
    const label = cleanText(extractFirstMatch(liHtml, /<div[^>]*class=["'][^"']*\bxtitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i));
    const value = cleanText(extractFirstMatch(liHtml, /<div[^>]*class=["'][^"']*\bxvalue\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i));
    const widthClass = extractFirstMatch(liHtml, /<div[^>]*class=["'][^"']*\bw(\d{1,3})\b[^"']*["'][^>]*>/i);
    if (!label || !value) {
      return;
    }
    out.push({
      label,
      value,
      width: widthClass ? Number(widthClass) : null
    });
  });
  return out;
}

function extractSocialLinks(html) {
  const links = [];
  const regex = /<a[^>]*target=["']_blank["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const href = toAbsoluteUrl(match[1]);
    const text = cleanText(match[2]);
    if (!/^https?:\/\//i.test(href)) {
      continue;
    }
    links.push({
      href,
      label: text || detectSocialLabel(href)
    });
  }
  return uniqueBy(links, (x) => x.href).slice(0, 8);
}

function extractTopResults(html) {
  const block = extractFirstMatch(
    html,
    /<ul[^>]*class=["'][^"']*\btopresults\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!block) {
    return [];
  }

  const out = [];
  const liMatches = block.match(/<li\b[\s\S]*?<\/li>/gi) || [];
  liMatches.forEach((liHtml) => {
    const raceHref = extractFirstMatch(liHtml, /<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    const raceName = cleanText(extractFirstMatch(liHtml, /<a[^>]*>([\s\S]*?)<\/a>/i));
    const type = cleanText(extractFirstMatch(liHtml, /<span[^>]*class=["'][^"']*\bblue\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
    const year = cleanText(extractFirstMatch(liHtml, /<span[^>]*class=["'][^"']*fs11[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
    const count = cleanText(extractFirstMatch(liHtml, /<div[^>]*class=["'][^"']*\bnrs\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i));
    if (!raceName) {
      return;
    }
    out.push({
      raceName,
      href: toAbsoluteUrl(raceHref),
      type,
      year,
      count
    });
  });
  return out.slice(0, 12);
}

function extractRankingBadges(html) {
  const out = {};
  const regex = /<li[^>]*>\s*<div[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/li>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const label = cleanText(match[1]);
    const value = cleanText(match[2]).replace(/[^\d]/g, "");
    if (!label || !value) {
      continue;
    }
    out[label] = value;
  }
  return out;
}

function extractFirstMatch(html, regex) {
  const match = String(html || "").match(regex);
  return match ? match[1] : "";
}

function buildCandidateSlugs(riderName, providedSlug) {
  const candidates = new Set();
  if (providedSlug) {
    candidates.add(providedSlug);
  }
  if (riderName) {
    candidates.add(slugifyRiderName(riderName));
  }
  return Array.from(candidates).filter(Boolean);
}

function slugifyRiderName(name) {
  return sanitizeSlug(
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’`]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
  );
}

function sanitizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^rider\//, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function extractSlugFromUrl(url) {
  const match = String(url || "").match(/\/rider\/([^/?#]+)/i);
  return match ? sanitizeSlug(match[1]) : "";
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  return normalizeSpaces(
    decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
  );
}

function extractLabeledValueFromText(text, label, allLabels = []) {
  const labels = allLabels.length ? allLabels : [label];
  const alternatives = labels.map((x) => escapeRegex(x)).join("|");
  const regex = new RegExp(
    `${escapeRegex(label)}\\s*:\\s*([\\s\\S]{1,120}?)(?=\\s*(?:${alternatives})\\s*:|$)`,
    "i"
  );
  const match = String(text || "").match(regex);
  if (!match) {
    return "";
  }
  return normalizeSpaces(match[1]);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function detectSocialLabel(href) {
  const lower = String(href || "").toLowerCase();
  if (lower.includes("x.com") || lower.includes("twitter.com")) return "X";
  if (lower.includes("instagram.com")) return "INSTA";
  if (lower.includes("facebook.com")) return "FB";
  if (lower.includes("strava.com")) return "STRAVA";
  if (lower.includes("wikipedia.org")) return "WIKI";
  return "LINK";
}

function toAbsoluteUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  if (/^https?:\/\//i.test(input)) return input;
  return `${PCS_BASE_URL}/${input.replace(/^\/+/, "")}`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}
