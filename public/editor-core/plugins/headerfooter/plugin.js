// public/editor-core/plugins/headerfooter/plugin.js
tinymce.PluginManager.add("headerfooter", function (editor) {
  const HEADER_CLASS = "page-header";
  const FOOTER_CLASS = "page-footer";
  const SHARED_ATTR = "data-hf-shared";
  const DEBOUNCE_MS = 120;

  // simple debounce
  function debounce(fn, t = DEBOUNCE_MS) {
    let id = null;
    return function (...args) {
      clearTimeout(id);
      id = setTimeout(() => fn.apply(this, args), t);
    };
  }

  function getBody() {
    try {
      return editor.getBody();
    } catch (e) {
      return null;
    }
  }

  function getPages() {
    const b = getBody();
    if (!b) return [];
    return Array.from(b.querySelectorAll(".paginate-page"));
  }

  // Ensure header/footer elements exist (inline editable, transparent, expandable)
  function ensureHFForPage(page, type) {
    if (!page) return null;
    const cls = type === "header" ? HEADER_CLASS : FOOTER_CLASS;
    let el = page.querySelector("." + cls);
    if (!el) {
      el = editor.getDoc().createElement("div");
      el.className = cls;
      el.setAttribute("contenteditable", "true");
      el.setAttribute(SHARED_ATTR, "true");
      el.innerHTML = "<p><br></p>";
      el.style.cssText = [
        "width: calc(100% - 2px)",
        "background: transparent",
        "box-sizing: border-box",
        "padding: 4px 8px",
        "min-height: 1.2em",
        "overflow: visible",
        "user-select: text",
        "outline: none",
        "display: block",
      ].join("; ");
      if (type === "header") page.insertBefore(el, page.firstChild);
      else page.appendChild(el);
    }
    return el;
  }

  // Add header/footer to all pages and focus the first one for edit
  function addHF(type) {
    const pages = getPages();
    if (!pages.length) {
      editor.notificationManager.open({
        text: "No pages — run Auto Paginate first.",
        type: "warning",
      });
      return;
    }
    let first = null;
    pages.forEach((p) => {
      const el = ensureHFForPage(p, type);
      if (!el.innerHTML.trim()) el.innerHTML = "<p><br></p>";
      el.style.display = "";
      if (!first) first = el;
    });
    // copy content from first to all pages
    syncHF(type);
    // request paginate reflow
    requestReflow();
    // focus first editable header/footer
    if (first) {
      try {
        editor.selection.select(first);
        editor.selection.collapse(true);
      } catch {
        first.focus && first.focus();
      }
    }
  }

  // Remove HF from pages
  function removeHF(type) {
    const cls = type === "header" ? HEADER_CLASS : FOOTER_CLASS;
    const pages = getPages();
    let removed = false;
    pages.forEach((p) => {
      const el = p.querySelector("." + cls);
      if (el) {
        el.remove();
        removed = true;
      }
    });
    if (removed) requestReflow();
  }

  // Sync content across pages: canonical = first page's HF, or provided source element
  function syncHF(type, sourceEl = null) {
    const cls = type === "header" ? HEADER_CLASS : FOOTER_CLASS;
    const pages = getPages();
    if (!pages.length) return;
    let html = null;
    if (sourceEl) html = sourceEl.innerHTML;
    else {
      const first = pages[0].querySelector("." + cls);
      if (first && first.innerHTML.trim()) html = first.innerHTML;
    }
    pages.forEach((p) => {
      const el = ensureHFForPage(p, type);
      if (html && html.trim()) {
        if (el.innerHTML !== html) el.innerHTML = html;
        el.style.display = "";
      } else {
        // hide empty shared hf elements (so they don't reserve space)
        if (!el.textContent.trim()) {
          el.style.display = "none";
          el.innerHTML = "";
        }
      }
    });
    // tell paginate to update page vars/heights
    delayedUpdatePageVars();
  }

  // request the paginate plugin to reflow (uses editor._paginate if available)
  function requestReflow(ms = 60) {
    try {
      if (editor._paginate) {
        if (typeof editor._paginate.schedule === "function") {
          return editor._paginate.schedule(ms || 60);
        }
        if (typeof editor._paginate.paginate === "function") {
          return editor._paginate.paginate();
        }
      }
    } catch (e) {}
    // fallback: dispatch event that paginate plugin might listen to
    try {
      const b = getBody();
      if (b)
        b.dispatchEvent(new CustomEvent("paginate-request", { bubbles: true }));
    } catch (e) {}
  }

  // Ask paginate plugin to recompute page CSS vars and reflow
  function updateAndReflow() {
    try {
      if (
        editor._paginate &&
        typeof editor._paginate.updateVars === "function"
      ) {
        editor._paginate.updateVars();
      }
    } catch (e) {}
    requestReflow();
  }
  const delayedUpdatePageVars = debounce(updateAndReflow, 120);

  // Auto-hide HF when emptied by the user (but keep them removable via UI)
  function cleanupEmptyHF() {
    const pages = getPages();
    let changed = false;
    pages.forEach((p) => {
      const h = p.querySelector("." + HEADER_CLASS);
      const f = p.querySelector("." + FOOTER_CLASS);
      if (
        h &&
        h.getAttribute(SHARED_ATTR) === "true" &&
        !h.textContent.trim()
      ) {
        h.style.display = "none";
        h.innerHTML = "";
        changed = true;
      }
      if (
        f &&
        f.getAttribute(SHARED_ATTR) === "true" &&
        !f.textContent.trim()
      ) {
        f.style.display = "none";
        f.innerHTML = "";
        changed = true;
      }
    });
    if (changed) requestReflow();
  }

  // Input handler: while editing header/footer, sync across pages
  function onInput(e) {
    const t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains(HEADER_CLASS)) syncHF("header", t);
    else if (t.classList.contains(FOOTER_CLASS)) syncHF("footer", t);
    else {
      // normal content edits -> ensure header/footer heights kept updated
      delayedUpdatePageVars();
    }
  }

  // Blur handler: hide empty HF after small delay
  function onBlur(e) {
    const t = e.target;
    if (!t || !t.classList) return;
    if (
      t.classList.contains(HEADER_CLASS) ||
      t.classList.contains(FOOTER_CLASS)
    ) {
      setTimeout(cleanupEmptyHF, 80);
    }
  }

  // Wire UI and events
  editor.on("init", function () {
    // Buttons (no modals)
    editor.ui.registry.addButton("headerBtn", {
      text: "Header",
      tooltip: "Add inline header to all pages",
      onAction: function () {
        addHF("header");
      },
    });
    editor.ui.registry.addButton("footerBtn", {
      text: "Footer",
      tooltip: "Add inline footer to all pages",
      onAction: function () {
        addHF("footer");
      },
    });
    editor.ui.registry.addButton("removeHeader", {
      text: "Remove Header",
      onAction: function () {
        removeHF("header");
      },
    });
    editor.ui.registry.addButton("removeFooter", {
      text: "Remove Footer",
      onAction: function () {
        removeHF("footer");
      },
    });

    // Events
    editor.on("input", onInput);
    editor.on("blur", onBlur);
    // NodeChange & SetContent -> resync after paginate runs
    editor.on("NodeChange", delayedUpdatePageVars);
    editor.on("SetContent", function () {
      // small delay to allow paginate plugin to create pages then sync HF
      setTimeout(function () {
        syncHF("header");
        syncHF("footer");
        delayedUpdatePageVars();
      }, 300);
    });

    // Listen for paginate completion if paginate plugin dispatches it
    try {
      const b = getBody();
      if (b && b.addEventListener) {
        b.addEventListener("paginate-done", function () {
          // when paginate completes, make sure HF elements exist and are synced
          syncHF("header");
          syncHF("footer");
          delayedUpdatePageVars();
        });
      }
    } catch (e) {}
  });

  // small public API
  editor.headerFooter = editor.headerFooter || {};
  editor.headerFooter.sync = function () {
    syncHF("header");
    syncHF("footer");
    delayedUpdatePageVars();
  };
  editor.headerFooter.addHeader = () => addHF("header");
  editor.headerFooter.addFooter = () => addHF("footer");
  editor.headerFooter.removeHeader = () => removeHF("header");
  editor.headerFooter.removeFooter = () => removeHF("footer");

  return {
    getMetadata() {
      return {
        name: "Header & Footer - inline final",
        url: "https://example.com/headerfooter",
      };
    },
  };
});
