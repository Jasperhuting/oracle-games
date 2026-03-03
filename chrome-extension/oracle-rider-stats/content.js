(function initOracleRiderStats() {
  if (window.__oracleRiderStatsInitialized) {
    return;
  }
  window.__oracleRiderStatsInitialized = true;
  if (!isExtensionAlive()) {
    return;
  }

  const panel = createPanel();
  document.body.appendChild(panel.root);

  decorateRiderTargets(panel);

  const observer = new MutationObserver(() => {
    if (!isExtensionAlive()) {
      observer.disconnect();
      return;
    }
    decorateRiderTargets(panel);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

function decorateRiderTargets(panel) {
  const elements = document.querySelectorAll("[data-rider-name], [data-og-rider-name]");
  elements.forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const target = resolveTargetContainer(element);
    if (!target || target.dataset.ogPcsDecorated === "1") {
      return;
    }

    const riderId = normalizeSpaces(
      target.getAttribute("data-rider-id") ||
      target.getAttribute("data-og-rider-id") ||
      element.getAttribute("data-rider-id") ||
      element.getAttribute("data-og-rider-id") ||
      ""
    );
    const riderName = normalizeSpaces(
      target.getAttribute("data-rider-name") ||
      target.getAttribute("data-og-rider-name") ||
      element.getAttribute("data-rider-name") ||
      element.getAttribute("data-og-rider-name") ||
      element.textContent ||
      ""
    );
    if (!riderName && !riderId) {
      return;
    }

    const anchor = resolveAnchor(target, element);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "og-pcs-inline-btn";
    button.textContent = "PCS stats";
    button.setAttribute("data-og-rider-id", riderId);
    button.setAttribute("data-og-rider-name", riderName);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      loadRiderStats(panel, {
        riderSlug: riderId,
        riderName
      });
    });

    anchor.appendChild(button);
    target.dataset.ogPcsDecorated = "1";
  });
}

function resolveTargetContainer(element) {
  const row = element.closest("tr[data-rider-name], tr[data-og-rider-name]");
  if (row instanceof HTMLElement) {
    return row;
  }
  const block = element.closest("[data-rider-id][data-rider-name], [data-og-rider-id][data-og-rider-name]");
  if (block instanceof HTMLElement) {
    return block;
  }
  return element instanceof HTMLElement ? element : null;
}

function resolveAnchor(target, source) {
  if (target.tagName === "TR") {
    return target.querySelector("td:nth-child(2)") || target;
  }
  return source instanceof HTMLElement ? source : target;
}

function loadRiderStats(panel, rider) {
  panel.showLoading(rider.riderName || rider.riderSlug || "renner");
  sendMessageSafe(
    {
      type: "PCS_FETCH_RIDER",
      payload: rider
    },
    (response) => {
      if (!response?.ok) {
        panel.showError(response?.error || "Kon geen gegevens ophalen.");
        return;
      }
      panel.showData(response.data);
    }
  );
}

function createPanel() {
  const root = document.createElement("aside");
  root.className = "og-rider-stats-panel og-hidden";
  root.innerHTML = `
    <div class="og-rider-stats-header">
      <strong>Rider Stats</strong>
      <button type="button" class="og-rider-stats-close" aria-label="Sluiten">×</button>
    </div>
    <div class="og-rider-stats-body">
      <p class="og-rider-stats-hint">Klik op 'PCS stats' bij een renner.</p>
    </div>
  `;

  const closeButton = root.querySelector(".og-rider-stats-close");
  closeButton?.addEventListener("click", () => {
    root.classList.add("og-hidden");
  });

  const body = root.querySelector(".og-rider-stats-body");

  return {
    root,
    showLoading(riderName) {
      root.classList.remove("og-hidden");
      body.innerHTML = `<p class="og-rider-stats-status">Laden: <strong>${escapeHtml(riderName)}</strong></p>`;
    },
    showError(message) {
      root.classList.remove("og-hidden");
      body.innerHTML = `<p class="og-rider-stats-error">${escapeHtml(message)}</p>`;
    },
    showData(data) {
      root.classList.remove("og-hidden");
      body.innerHTML = renderStats(data);
    }
  };
}

function renderStats(data) {
  const rows = [
    ["Team", data.team],
    ["Nationaliteit", data.nationality],
    ["Leeftijd", data.age],
    ["Geboortedatum", data.dateOfBirth],
    ["Gewicht", data.weight],
    ["Lengte", data.height],
    ["Geboorteplaats", data.placeOfBirth],
    ["PCS/UCI Rank", data.rank],
    ["PCS/UCI Punten", data.points]
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<div class="og-col"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`
    )
    .join("");

  const photo = data.photoUrl
    ? `<div class="og-rider-photo-wrap"><img class="og-rider-photo" src="${escapeAttribute(
        data.photoUrl
      )}" alt="${escapeAttribute(data.name || "Rider")}" /></div>`
    : "";

  const specialties = Array.isArray(data.specialties) ? data.specialties : [];
  const specialtiesMarkup = specialties.length
    ? `
      <section class="og-section">
        <h4 class="og-section-title">Specialties</h4>
        <div class="og-specialties">
          ${specialties
            .map((item) => {
              const width = Math.max(1, Math.min(100, Number(item.width) || 1));
              return `
                <div class="og-spec-row">
                  <div class="og-spec-bar"><div class="og-spec-fill" style="width:${width}%"></div></div>
                  <span class="og-spec-value">${escapeHtml(String(item.value || ""))}</span>
                  <span class="og-spec-label">${escapeHtml(String(item.label || ""))}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    `
    : "";

  const badges = [
    data.allTimeRank ? `<span class="og-chip">All time <strong>${escapeHtml(String(data.allTimeRank))}</strong></span>` : "",
    data.pcsRanking ? `<span class="og-chip">PCS Ranking <strong>${escapeHtml(String(data.pcsRanking))}</strong></span>` : ""
  ]
    .filter(Boolean)
    .join("");
  const badgesMarkup = badges ? `<section class="og-section"><div class="og-chips">${badges}</div></section>` : "";

  const visitsMarkup = data.visits
    ? `<section class="og-section"><p class="og-rider-stats-status"><strong>Visits:</strong> ${escapeHtml(
        String(data.visits)
      )}</p></section>`
    : "";

  const topResults = Array.isArray(data.topResults) ? data.topResults : [];
  const topResultsMarkup = topResults.length
    ? `
      <section class="og-section">
        <h4 class="og-section-title">Top results</h4>
        <ul class="og-top-results">
          ${topResults
            .map((res) => {
              const type = res.type ? `<span class="og-result-type">${escapeHtml(String(res.type))}</span>` : "";
              const count = res.count ? `<span class="og-result-count">${escapeHtml(String(res.count))}</span>` : "";
              const year = res.year ? `<span class="og-result-year">${escapeHtml(String(res.year))}</span>` : "";
              const race = res.href
                ? `<a href="${escapeAttribute(res.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                    String(res.raceName || "")
                  )}</a>`
                : escapeHtml(String(res.raceName || ""));
              return `<li>${count}${type}${race}${year}</li>`;
            })
            .join("")}
        </ul>
      </section>
    `
    : "";

  const title = data.name || "Onbekende renner";
  const riderUrl = data.url || "";
  const urlMarkup = riderUrl
    ? `<a href="${escapeAttribute(riderUrl)}" target="_blank" rel="noopener noreferrer">Open op ProCyclingStats</a>`
    : "";

  return `
    <h3 class="og-rider-stats-title">${escapeHtml(title)}</h3>
    <div class="og-rider-summary">
      ${photo}
      <div class="og-rider-stats-grid">
        ${rows || '<p class="og-rider-stats-status">Geen extra stats gevonden.</p>'}
      </div>
    </div>
    ${specialtiesMarkup}
    ${badgesMarkup}
    ${visitsMarkup}
    ${topResultsMarkup}
    <div class="og-rider-stats-footer">${urlMarkup}</div>
  `;
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function isExtensionAlive() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function getRuntimeLastErrorMessage() {
  try {
    return chrome?.runtime?.lastError?.message || "";
  } catch {
    return "Extension context invalidated. Herlaad de pagina.";
  }
}

function sendMessageSafe(message, onResult) {
  if (!isExtensionAlive()) {
    onResult({ ok: false, error: "Extension context invalidated. Herlaad de pagina." });
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      const errorMessage = getRuntimeLastErrorMessage();
      if (errorMessage) {
        onResult({ ok: false, error: errorMessage });
        return;
      }
      onResult(response || { ok: false, error: "Geen antwoord van extensie." });
    });
  } catch (error) {
    onResult({
      ok: false,
      error: error instanceof Error ? error.message : "Extension context invalidated. Herlaad de pagina."
    });
  }
}
