import { defineToolbarApp } from "astro/toolbar";
import type { EnvPayload, EnvVar } from "./types.js";

export default defineToolbarApp({
  init(canvas, app, server) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let payload: EnvPayload | null = null;
    let searchQuery = "";
    let revealedKeys = new Set<string>();
    let revealAll = false;

    // Keep a reference to the list container so we can update it
    // without rebuilding the whole panel — preserves scroll position
    let listWrap: HTMLDivElement | null = null;
    let panelBuilt = false;

    // -----------------------------------------------------------------------
    // Request env data from server
    // -----------------------------------------------------------------------
    server.send("astro-env-inspector:request", {});

    server.on<EnvPayload>("astro-env-inspector:data", (data) => {
      payload = data;
      if ((data as any).revealByDefault) {
        revealAll = true;
      }
      buildPanel();
    });

    // -----------------------------------------------------------------------
    // Re-render when toggled open
    // -----------------------------------------------------------------------
    app.onToggled(({ state }) => {
      if (state && payload) buildPanel();
    });

    // -----------------------------------------------------------------------
    // Build the full panel — only called once (or on first open)
    // After that, only the list is refreshed
    // -----------------------------------------------------------------------
    function buildPanel() {
      if (panelBuilt && listWrap) {
        // Panel already exists — just refresh the list contents
        refreshList();
        return;
      }

      canvas.innerHTML = "";
      panelBuilt = false;

      const root = document.createElement("div");
      root.style.cssText = `
        position: fixed;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        width: 640px;
        max-width: calc(100vw - 32px);
        max-height: 70vh;
        background: #1a1a2e;
        border: 1px solid #2d2d4e;
        border-radius: 12px;
        font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
        font-size: 13px;
        color: #e2e2f0;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 9999;
      `;

      // ── Header ─────────────────────────────────────────────────────────────
      const header = document.createElement("div");
      header.style.cssText = `
        padding: 14px 16px 12px;
        border-bottom: 1px solid #2d2d4e;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      `;

      const titleWrap = document.createElement("div");
      titleWrap.style.cssText = "display:flex;align-items:center;gap:10px";

      const title = document.createElement("span");
      title.style.cssText =
        "font-size:14px;font-weight:600;color:#fff;font-family:ui-sans-serif,system-ui,sans-serif";
      title.textContent = "ENV Inspector";

      const badgesEl = document.createElement("div");
      badgesEl.style.cssText = "display:flex;gap:6px";

      if (payload) {
        if (payload.leakingCount > 0) {
          badgesEl.appendChild(
            makeBadge(
              `⚠ ${payload.leakingCount} leaking`,
              "#7c3a00",
              "#f97316",
            ),
          );
        }
        if (payload.missingCount > 0) {
          badgesEl.appendChild(
            makeBadge(
              `✗ ${payload.missingCount} missing`,
              "#3b1a1a",
              "#f87171",
            ),
          );
        }
        badgesEl.appendChild(
          makeBadge(`${payload.totalCount} vars`, "#1e293b", "#94a3b8"),
        );
      }

      titleWrap.appendChild(title);
      titleWrap.appendChild(badgesEl);

      // Reveal all toggle — updates label in place, then refreshes list only
      const revealBtn = document.createElement("button");
      revealBtn.style.cssText = `
        background: #2d2d4e;
        border: 1px solid #3d3d6e;
        border-radius: 6px;
        color: #a5b4fc;
        font-size: 11px;
        padding: 4px 10px;
        cursor: pointer;
        font-family: ui-sans-serif,system-ui,sans-serif;
      `;
      revealBtn.textContent = revealAll ? "🙈 Hide all" : "👁 Reveal all";
      revealBtn.onclick = () => {
        revealAll = !revealAll;
        if (revealAll) {
          payload?.vars.forEach((v) => revealedKeys.add(v.key));
        } else {
          revealedKeys.clear();
        }
        revealBtn.textContent = revealAll ? "🙈 Hide all" : "👁 Reveal all";
        refreshList(); // ← only refresh list, not the whole panel
      };

      header.appendChild(titleWrap);
      header.appendChild(revealBtn);

      // ── Search ──────────────────────────────────────────────────────────────
      const searchWrap = document.createElement("div");
      searchWrap.style.cssText =
        "padding:10px 16px;border-bottom:1px solid #2d2d4e;flex-shrink:0";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search variables...";
      searchInput.value = searchQuery;
      searchInput.style.cssText = `
        width: 100%;
        background: #0f0f1e;
        border: 1px solid #2d2d4e;
        border-radius: 6px;
        color: #e2e2f0;
        font-size: 12px;
        font-family: ui-monospace,'Cascadia Code',monospace;
        padding: 7px 10px;
        outline: none;
        box-sizing: border-box;
      `;
      searchInput.oninput = (e) => {
        searchQuery = (e.target as HTMLInputElement).value;
        refreshList(); // ← search also only refreshes list
      };
      searchWrap.appendChild(searchInput);

      // ── Stats bar ───────────────────────────────────────────────────────────
      const statsBar = document.createElement("div");
      statsBar.style.cssText = `
        padding: 8px 16px;
        border-bottom: 1px solid #2d2d4e;
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: #64748b;
        font-family: ui-sans-serif,system-ui,sans-serif;
        flex-shrink: 0;
      `;
      if (payload) {
        statsBar.innerHTML = `
          <span style="color:#34d399">PUBLIC: ${payload.publicCount}</span>
          <span style="color:#f472b6">PRIVATE: ${payload.privateCount}</span>
          <span style="color:#a5b4fc">ASTRO: ${payload.vars.filter((v) => v.group === "astro").length}</span>
        `;
      }

      // ── List container ──────────────────────────────────────────────────────
      listWrap = document.createElement("div");
      listWrap.style.cssText = "overflow-y:auto;flex:1;padding:8px 0";

      root.appendChild(header);
      root.appendChild(searchWrap);
      root.appendChild(statsBar);
      root.appendChild(listWrap);
      canvas.appendChild(root);

      panelBuilt = true;

      // Populate the list
      refreshList();

      // Focus search
      setTimeout(() => searchInput.focus(), 50);
    }

    // -----------------------------------------------------------------------
    // Refresh only the list contents — scroll position is preserved
    // -----------------------------------------------------------------------
    function refreshList() {
      if (!listWrap || !payload) return;

      // Save scroll position before wiping contents
      const savedScroll = listWrap.scrollTop;

      listWrap.innerHTML = "";

      const filtered = payload.vars.filter(
        (v) =>
          v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (v.value ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      );

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText =
          "text-align:center;color:#475569;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif";
        empty.textContent = "No variables match your search.";
        listWrap.appendChild(empty);
        return;
      }

      let lastGroup = "";
      for (const v of filtered) {
        if (v.group !== lastGroup) {
          lastGroup = v.group;
          const groupHeader = document.createElement("div");
          groupHeader.style.cssText = `
            padding: 6px 16px 4px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: ${groupColor(v.group)};
            font-family: ui-sans-serif,system-ui,sans-serif;
          `;
          groupHeader.textContent = groupLabel(v.group);
          listWrap.appendChild(groupHeader);
        }
        listWrap.appendChild(makeRow(v));
      }

      // Restore scroll position after DOM update
      listWrap.scrollTop = savedScroll;
    }

    // -----------------------------------------------------------------------
    // Build a single variable row
    // -----------------------------------------------------------------------
    function makeRow(v: EnvVar): HTMLElement {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 16px;
        cursor: default;
        transition: background 0.1s;
      `;
      row.onmouseenter = () => (row.style.background = "#1e1e3a");
      row.onmouseleave = () => (row.style.background = "transparent");

      // Status dot
      const dot = document.createElement("span");
      dot.style.cssText = `
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        background: ${v.isLeaking ? "#f97316" : v.isSet ? "#34d399" : "#f87171"};
      `;

      // Key
      const key = document.createElement("span");
      key.style.cssText = `
        color: ${v.isLeaking ? "#f97316" : "#c4b5fd"};
        min-width: 220px;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 0;
      `;
      key.textContent = v.key;
      if (v.isLeaking) {
        key.title = "⚠ PUBLIC_ variable may contain a sensitive value";
      }

      // Value area
      const valueWrap = document.createElement("div");
      valueWrap.style.cssText =
        "flex:1;display:flex;align-items:center;gap:8px;min-width:0";

      const isRevealed = revealedKeys.has(v.key) || revealAll;
      const displayValue = !v.isSet
        ? "not set"
        : v.isSensitive && !isRevealed
          ? "••••••••"
          : (v.value ?? "");

      const valueEl = document.createElement("span");
      valueEl.style.cssText = `
        color: ${!v.isSet ? "#475569" : "#94a3b8"};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        font-style: ${!v.isSet ? "italic" : "normal"};
      `;
      valueEl.textContent = displayValue;
      valueWrap.appendChild(valueEl);

      // Per-key reveal toggle
      if (v.isSensitive && v.isSet) {
        const toggleBtn = document.createElement("button");
        toggleBtn.style.cssText = `
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 0;
          font-size: 12px;
          flex-shrink: 0;
        `;
        toggleBtn.textContent = isRevealed ? "🙈" : "👁";
        toggleBtn.title = isRevealed ? "Hide" : "Reveal";
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          if (revealedKeys.has(v.key)) {
            revealedKeys.delete(v.key);
          } else {
            revealedKeys.add(v.key);
          }
          // Only refresh the list — scroll position is saved inside refreshList()
          refreshList();
        };
        valueWrap.appendChild(toggleBtn);
      }

      // Copy button
      if (v.isSet) {
        const copyBtn = document.createElement("button");
        copyBtn.style.cssText = `
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 0;
          font-size: 11px;
          flex-shrink: 0;
        `;
        copyBtn.textContent = "📋";
        copyBtn.title = "Copy value";
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(v.value ?? "").then(() => {
            copyBtn.textContent = "✓";
            setTimeout(() => {
              copyBtn.textContent = "📋";
            }, 1200);
          });
        };
        valueWrap.appendChild(copyBtn);
      }

      row.appendChild(dot);
      row.appendChild(key);
      row.appendChild(valueWrap);

      return row;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    function makeBadge(text: string, bg: string, color: string): HTMLElement {
      const b = document.createElement("span");
      b.style.cssText = `
        background: ${bg};
        color: ${color};
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        font-family: ui-sans-serif,system-ui,sans-serif;
      `;
      b.textContent = text;
      return b;
    }

    function groupLabel(group: string): string {
      switch (group) {
        case "public":
          return "🌐 Public (PUBLIC_*)";
        case "private":
          return "🔒 Private / Server-only";
        case "astro":
          return "🚀 Astro Built-ins";
        default:
          return "📦 Other";
      }
    }

    function groupColor(group: string): string {
      switch (group) {
        case "public":
          return "#34d399";
        case "private":
          return "#f472b6";
        case "astro":
          return "#a5b4fc";
        default:
          return "#64748b";
      }
    }
  },
});
