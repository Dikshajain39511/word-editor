(function () {
  const A4_HEIGHT = 1122; // px
  const A4_WIDTH = 794; // px
  const DEFAULT_GUTTER = 40; // left/right inner padding
  const DEFAULT_TOP = 40; // minimal top when no header
  const DEFAULT_BOTTOM = 40; // minimal bottom when no footer
  const GAP = 8; // small breathing gap between HF and content
  const DEBOUNCE_MS = 700;

  let scheduleTimer = null;
  let suppress = false;

  // Create a page with header/main/footer
  function createPage(doc, headerHTML = "", footerHTML = "") {
    const page = doc.createElement("div");
    page.className = "paginate-page";

    const header = doc.createElement("div");
    header.className = "page-header";
    header.setAttribute("contenteditable", "true");
    header.style.display = headerHTML && headerHTML.trim() ? "" : "none";
    header.innerHTML = headerHTML || "";

    const main = doc.createElement("div");
    main.className = "paginate-page-main";
    main.setAttribute("contenteditable", "true");

    const footer = doc.createElement("div");
    footer.className = "page-footer";
    footer.setAttribute("contenteditable", "true");
    footer.style.display = footerHTML && footerHTML.trim() ? "" : "none";
    footer.innerHTML = footerHTML || "";

    page.appendChild(header);
    page.appendChild(main);
    page.appendChild(footer);

    // CSS vars store measured heights
    page.style.setProperty("--header-height", "0px");
    page.style.setProperty("--footer-height", "0px");

    return { page, main, header, footer };
  }

  // Flatten current pages into a single flow and capture first page HF HTML
  function flattenPages(editor) {
    const body = editor.getBody();
    if (!body) return { headerHTML: "", footerHTML: "" };

    const pages = Array.from(body.querySelectorAll(".paginate-page"));
    if (!pages.length) return { headerHTML: "", footerHTML: "" };

    const first = pages[0];
    const fh = first.querySelector(".page-header");
    const ff = first.querySelector(".page-footer");
    const headerHTML = fh && fh.style.display !== "none" ? fh.innerHTML : "";
    const footerHTML = ff && ff.style.display !== "none" ? ff.innerHTML : "";

    const nodes = [];
    pages.forEach((p) => {
      const main = p.querySelector(".paginate-page-main");
      if (!main) return;
      Array.from(main.childNodes).forEach((n) => nodes.push(n.cloneNode(true)));
    });

    body.innerHTML = "";
    nodes.forEach((n) => body.appendChild(n));
    return { headerHTML, footerHTML };
  }

  // Hidden measurer for accurate height calc
  function createMeasurer(doc, body) {
    const measurer = doc.createElement("div");
    measurer.style.position = "absolute";
    measurer.style.visibility = "hidden";
    measurer.style.left = "0";
    measurer.style.top = "0";
    measurer.style.width = `${A4_WIDTH - DEFAULT_GUTTER * 2}px`;
    measurer.style.boxSizing = "border-box";

    try {
      const bs = window.getComputedStyle(body);
      measurer.style.fontFamily = bs.fontFamily;
      measurer.style.fontSize = bs.fontSize;
      measurer.style.lineHeight = bs.lineHeight;
    } catch {}

    doc.body.appendChild(measurer);
    return measurer;
  }

  // Measure header/footer and update top/bottom bounds of main
  function updatePageVars(editor) {
    const body = editor.getBody();
    if (!body) return;

    const pages = Array.from(body.querySelectorAll(".paginate-page"));
    pages.forEach((p) => {
      const h = p.querySelector(".page-header");
      const f = p.querySelector(".page-footer");
      const main = p.querySelector(".paginate-page-main");

      const hh =
        h && h.style.display !== "none"
          ? Math.ceil(h.getBoundingClientRect().height)
          : 0;
      const fh =
        f && f.style.display !== "none"
          ? Math.ceil(f.getBoundingClientRect().height)
          : 0;

      p.style.setProperty("--header-height", `${hh}px`);
      p.style.setProperty("--footer-height", `${fh}px`);

      if (main) {
        main.style.left = `${DEFAULT_GUTTER}px`;
        main.style.right = `${DEFAULT_GUTTER}px`;
        main.style.top = `${hh > 0 ? hh + GAP : DEFAULT_TOP}px`;
        // bottom = only footer height + tiny gap, NOT + DEFAULT_BOTTOM again
        main.style.bottom = `${fh > 0 ? fh + 8 : 24}px`;
      }
    });
  }

  function computeAvailableHeight(pageEl) {
    const hh = parseInt(pageEl.style.getPropertyValue("--header-height")) || 0;
    const fh = parseInt(pageEl.style.getPropertyValue("--footer-height")) || 0;
    const topReserve = hh > 0 ? hh + 8 : 40;
    const bottomReserve = fh > 0 ? fh + 8 : 24;
    // Use exactly the fixed page height; no extra padding to avoid bottom gap
    return Math.max(0, A4_HEIGHT - topReserve - bottomReserve);
  }

  tinymce.PluginManager.add("paginate", function (editor) {
    let lastHeader = "";
    let lastFooter = "";

    function paginate() {
      if (suppress) return;
      suppress = true;

      try {
        const doc = editor.getDoc();
        const body = editor.getBody();
        if (!doc || !body) return;

        // save cursor
        let bookmark = null;
        try {
          if (editor.selection?.getBookmark) {
            bookmark = editor.selection.getBookmark(2, true);
          }
        } catch {}

        // flatten and capture header/footer
        const { headerHTML, footerHTML } = flattenPages(editor);
        lastHeader = headerHTML || "";
        lastFooter = footerHTML || "";

        // gather nodes
        const nodes = Array.from(body.childNodes).filter(
          (n) =>
            n.nodeType === 1 ||
            (n.nodeType === 3 &&
              n.textContent &&
              n.textContent.trim().length > 0)
        );

        // clear and prepare measurer
        body.innerHTML = "";
        const measurer = createMeasurer(doc, body);

        // first page
        let { page, main, header, footer } = createPage(
          doc,
          lastHeader,
          lastFooter
        );
        body.appendChild(page);
        updatePageVars(editor);
        let available = computeAvailableHeight(page);
        let consumed = 0;

        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];

          // manual page break
          if (
            node.nodeType === 1 &&
            node.classList?.contains("paginate-page-break")
          ) {
            const note = doc.createElement("div");
            note.className = "paginate-break-note";
            note.textContent = "— Page ends here —";
            main.appendChild(note);

            const nxt = createPage(doc, lastHeader, lastFooter);
            body.appendChild(nxt.page);
            page = nxt.page;
            main = nxt.main;
            header = nxt.header;
            footer = nxt.footer;

            updatePageVars(editor);
            available = computeAvailableHeight(page);
            consumed = 0;
            continue;
          }

          // measure
          measurer.innerHTML = "";
          try {
            measurer.appendChild(node.cloneNode(true));
          } catch {
            measurer.innerHTML = node.outerHTML || node.textContent || "";
          }
          const nodeH = measurer.scrollHeight || 0;

          // overflow -> new page
          if (consumed > 0 && consumed + nodeH > available) {
            const nxt = createPage(doc, lastHeader, lastFooter);
            body.appendChild(nxt.page);
            page = nxt.page;
            main = nxt.main;
            header = nxt.header;
            footer = nxt.footer;

            updatePageVars(editor);
            available = computeAvailableHeight(page);
            consumed = 0;
          }

          main.appendChild(node);
          consumed += nodeH;
        }

        measurer.remove();

        if (!body.querySelector(".paginate-page")) {
          const p = createPage(doc, lastHeader, lastFooter);
          body.appendChild(p.page);
          updatePageVars(editor);
        }

        // restore cursor
        if (bookmark && editor.selection?.moveToBookmark) {
          try {
            editor.selection.moveToBookmark(bookmark);
          } catch {}
        }

        // let headerfooter plugin know
        try {
          body.dispatchEvent(
            new CustomEvent("paginate-done", { bubbles: true })
          );
        } catch {}
      } finally {
        setTimeout(() => (suppress = false), 120);
      }
    }

    function schedule(ms = DEBOUNCE_MS) {
      clearTimeout(scheduleTimer);
      scheduleTimer = setTimeout(paginate, ms);
    }

    function getPages() {
      const body = editor.getBody();
      return body ? Array.from(body.querySelectorAll(".paginate-page")) : [];
    }

    function setHeader(h) {
      lastHeader = h || "";
      const pages = getPages();
      pages.forEach((p) => {
        const el = p.querySelector(".page-header");
        if (el) {
          el.innerHTML = lastHeader;
          el.style.display = lastHeader ? "" : "none";
        }
      });
      updatePageVars(editor);
      schedule(60);
    }

    function setFooter(f) {
      lastFooter = f || "";
      const pages = getPages();
      pages.forEach((p) => {
        const el = p.querySelector(".page-footer");
        if (el) {
          el.innerHTML = lastFooter;
          el.style.display = lastFooter ? "" : "none";
        }
      });
      updatePageVars(editor);
      schedule(60);
    }

    // UI (you can keep your existing buttons as-is)
    editor.ui.registry.addButton("pageBreak", {
      text: "Page Break",
      tooltip: "Insert manual page break",
      onAction: function () {
        editor.insertContent(
          '<div class="paginate-page-break" contenteditable="false"></div>'
        );
        schedule(120);
      },
    });
    editor.ui.registry.addButton("autoPaginate", {
      text: "Auto Paginate",
      tooltip: "Reflow pages",
      onAction: function () {
        paginate();
      },
    });

    editor.on("init", () => {
      // Add editor surface background
      editor.dom.addStyle(`
        body.mce-content-body{
          background:#f3f4f6;
          padding:36px 0;
          display:flex;
          flex-direction:column;
          align-items:center;
        }
      `);
    });

    editor.on("SetContent", () => {
      setTimeout(() => {
        // Reset templates on import; new HF is captured from flattened content if present
        setHeader("");
        setFooter("");
        paginate();
      }, 250);
    });

    editor.on("keyup paste change NodeChange", () => schedule(DEBOUNCE_MS));

    editor.on("BeforeExecCommand", (e) => {
      if (["mcePrint", "exportWord", "exportPDF"].includes(e.command)) {
        const body = editor.getBody();
        if (!body) return;
        const markers = Array.from(
          body.querySelectorAll(".paginate-page-break, .paginate-break-note")
        );
        markers.forEach((m) => (m.dataset._display = m.style.display || ""));
        markers.forEach((m) => (m.style.display = "none"));
        setTimeout(
          () =>
            markers.forEach(
              (m) => (m.style.display = m.dataset._display || "")
            ),
          800
        );
      }
    });

    // Expose API for headerfooter plugin
    editor._paginate = editor._paginate || {};
    editor._paginate.paginate = paginate;
    editor._paginate.schedule = schedule;
    editor._paginate.getPages = getPages;
    editor._paginate.updateVars = () => updatePageVars(editor);
    editor._paginate.setHeader = setHeader;
    editor._paginate.setFooter = setFooter;

    return {
      getMetadata() {
        return { name: "Paginate (A4 visual) — final" };
      },
    };
  });
})();
