/**
 * customimage plugin for TinyMCE
 *
 * Drop-in: external_plugins: { customimage: '/tinymce/plugins/customimage/plugin.js' }
 *
 * Features:
 * - Insert local images with drag/resize
 * - Float/inline modes
 * - Layout options menu with close (cross) button
 * - Safe and persistent event handling
 * - Responsive layout menu
 * - Touch support
 */

(function () {
  tinymce.PluginManager.add("customimage", function (editor) {
    const MIN_SIZE = 24;
    const STYLE_ID = "customimage-style";
    const BIND_FLAG = "_ciBound_v6";
    const OBS_DEBOUNCE_MS = 30;

    // ---------- utilities ----------
    function log(...args) {
      if (window.__CUSTOMIMAGE_DEBUG) console.log("[customimage]", ...args);
    }
    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }
    function toDataURL(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }

    // ---------- menu helpers ----------
    function getMenus(doc) {
      try {
        return Array.from(doc.querySelectorAll(".ci-menu"));
      } catch (e) {
        return [];
      }
    }
    function hideMenu(docRef) {
      try {
        getMenus(docRef).forEach((m) => m.remove());
      } catch (e) {
        log("hideMenu err", e);
      }
    }

    // ---------- HTML for wrapper ----------
    function makeWrapperHTML(dataUrl) {
      return `
        <div class="ci-wrapper" data-customimage="1" style="display:inline-block; position:relative; margin:6px;">
          <img src="${dataUrl}" draggable="false" style="display:block; max-width:100%; height:auto; user-select:none; -webkit-user-drag:none;" />
          <div class="ci-handle ci-tl" aria-hidden="true"></div>
          <div class="ci-handle ci-tr" aria-hidden="true"></div>
          <div class="ci-handle ci-bl" aria-hidden="true"></div>
          <div class="ci-handle ci-br" aria-hidden="true"></div>
          <button class="ci-layout-btn" aria-label="Layout options" title="Layout options">☰</button>
        </div>
      `;
    }

    // ---------- inject styles ----------
    function injectStyles(doc) {
      if (!doc || doc.getElementById(STYLE_ID)) return;
      const s = doc.createElement("style");
      s.id = STYLE_ID;
      s.textContent = `
        .ci-wrapper { user-select:none; position:relative; }
        .ci-wrapper.float { position:absolute; cursor:move !important; z-index:1000; }
        .ci-wrapper.inline { display:inline-block; position:relative; cursor:default !important; }
        .ci-wrapper.active { outline:2px solid #2b8cff; box-shadow:0 0 8px rgba(43,140,255,0.14); }

        .ci-wrapper img { pointer-events:none; user-select:none; -webkit-user-drag:none; }

        .ci-handle { width:10px; height:10px; background:#2b8cff; border-radius:50%; position:absolute; display:none; z-index:1001; pointer-events:auto !important; }
        .ci-wrapper.active .ci-handle { display:block; }
        .ci-handle.ci-tl { top:-5px; left:-5px; cursor:nwse-resize; }
        .ci-handle.ci-tr { top:-5px; right:-5px; cursor:nesw-resize; }
        .ci-handle.ci-bl { bottom:-5px; left:-5px; cursor:nesw-resize; }
        .ci-handle.ci-br { bottom:-5px; right:-5px; cursor:nwse-resize; }

        .ci-layout-btn {
          display:none; position:absolute; top:-30px; right:0;
          background:#fff; border:1px solid #dcdcdc; border-radius:4px;
          padding:2px 6px; cursor:pointer; font-size:12px; z-index:1002;
          transition:background 0.2s;
        }
        .ci-layout-btn:hover { background:#f3f6fb; }
        .ci-wrapper.active .ci-layout-btn { display:block; }

        .ci-menu {
          position:absolute; background:#fff; border:1px solid #ccc;
          border-radius:6px; box-shadow:0 4px 14px rgba(0,0,0,0.12);
          padding:6px; z-index:99999; width:auto; max-width:220px; min-width:150px;
          opacity:0; transform:translateY(-5px); animation:ciFadeIn 0.15s forwards;
        }
        @keyframes ciFadeIn { to { opacity:1; transform:translateY(0); } }
        .ci-menu button {
          display:block; width:100%; text-align:left; border:none;
          background:none; padding:6px; cursor:pointer; border-radius:4px;
        }
        .ci-menu button:hover { background:#f3f6fb; }
        .ci-menu .ci-menu-close {
          color:#f44336; font-weight:bold; font-size:14px; text-align:right;
          margin-bottom:4px; background:none; border:none; cursor:pointer;
        }

        html, body, .mce-content-body * { cursor:auto !important; }
      `;
      doc.head.appendChild(s);
    }

    // ---------- toolbar button ----------
    editor.ui.registry.addButton("customimage", {
      icon: "image",
      tooltip: "Insert image (local)",
      onAction: function () {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if (!file) return;
          const url = await toDataURL(file);
          editor.insertContent(makeWrapperHTML(url));
          setTimeout(() => attachAll(true), 80);
        };
        input.click();
      },
    });

    // ---------- global observer ----------
    let globalBound = false;
    let observer = null;
    let obsTimer = null;

    function attachAll(forceInject) {
      const doc = editor.getDoc();
      const win = editor.getWin();
      if (!doc || !win) return;
      if (forceInject) injectStyles(doc);

      if (!globalBound) {
        globalBound = true;

        // deselect wrappers on outside click
        doc.addEventListener(
          "mousedown",
          (ev) => {
            try {
              if (
                !ev.target.closest(".ci-wrapper") &&
                !ev.target.closest(".ci-menu")
              ) {
                Array.from(doc.querySelectorAll(".ci-wrapper")).forEach((w) =>
                  w.classList.remove("active")
                );
                hideMenu(doc);
              }
            } catch (e) {
              log("global mousedown err", e);
            }
          },
          true
        );

        // mutation observer
        observer = new MutationObserver(() => {
          clearTimeout(obsTimer);
          obsTimer = setTimeout(() => attachAll(false), OBS_DEBOUNCE_MS);
        });
        observer.observe(doc.body, { childList: true, subtree: true });

        editor.on("remove", () => {
          try {
            if (observer) observer.disconnect();
          } catch {}
          globalBound = false;
          observer = null;
        });
      }

      const wrappers = Array.from(doc.querySelectorAll(".ci-wrapper"));
      wrappers.forEach((w) => {
        try {
          attachOne(w, doc, win);
        } catch (e) {
          log("attachOne error", e);
        }
      });
    }

    // ---------- attachOne ----------
    function attachOne(wrapper, doc, win) {
      if (!wrapper || wrapper[BIND_FLAG] === "1") return;
      wrapper[BIND_FLAG] = "1";

      const img = wrapper.querySelector("img");
      const handles = {
        tl: wrapper.querySelector(".ci-handle.ci-tl"),
        tr: wrapper.querySelector(".ci-handle.ci-tr"),
        bl: wrapper.querySelector(".ci-handle.ci-bl"),
        br: wrapper.querySelector(".ci-handle.ci-br"),
      };
      const layoutBtn = wrapper.querySelector(".ci-layout-btn");

      if (!wrapper.style.left) wrapper.style.left = "0px";
      if (!wrapper.style.top) wrapper.style.top = "0px";

      // ---------- activate wrapper ----------
      wrapper.addEventListener("mousedown", (ev) => {
        if (ev.target.classList.contains("ci-handle")) return;
        ev.preventDefault();
        ev.stopPropagation();
        Array.from(doc.querySelectorAll(".ci-wrapper")).forEach((w) =>
          w.classList.remove("active")
        );
        wrapper.classList.add("active");
      });

      // ---------- RESIZE ----------
      let resizing = false;
      let rStartX = 0,
        rStartY = 0,
        rStartW = 0,
        rStartH = 0,
        rCorner = null,
        resizeRaf = null;

      function startResize(e, corner) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        rCorner = corner;
        const r = img.getBoundingClientRect();
        rStartX = e.clientX;
        rStartY = e.clientY;
        rStartW = r.width;
        rStartH = r.height;
        doc.body.style.userSelect = "none";
        win.addEventListener("mousemove", onResize, true);
        win.addEventListener("mouseup", stopResize, true);
      }

      function onResize(ev) {
        if (!resizing) return;
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = null;
          const dx = ev.clientX - rStartX;
          const dy = ev.clientY - rStartY;
          let nw = rStartW,
            nh = rStartH;
          if (rCorner === "br") {
            nw = rStartW + dx;
            nh = rStartH + dy;
          } else if (rCorner === "bl") {
            nw = rStartW - dx;
            nh = rStartH + dy;
          } else if (rCorner === "tr") {
            nw = rStartW + dx;
            nh = rStartH - dy;
          } else if (rCorner === "tl") {
            nw = rStartW - dx;
            nh = rStartH - dy;
          }
          nw = Math.max(MIN_SIZE, Math.round(nw));
          nh = Math.max(MIN_SIZE, Math.round(nh));
          img.style.width = nw + "px";
          img.style.height = nh + "px";
        });
      }

      function stopResize() {
        if (!resizing) return;
        resizing = false;
        win.removeEventListener("mousemove", onResize, true);
        win.removeEventListener("mouseup", stopResize, true);
        doc.body.style.userSelect = "";
        if (resizeRaf) {
          cancelAnimationFrame(resizeRaf);
          resizeRaf = null;
        }
        const r = img.getBoundingClientRect();
        img.setAttribute("width", Math.round(r.width));
        img.setAttribute("height", Math.round(r.height));
      }

      Object.entries(handles).forEach(([k, h]) => {
        if (!h) return;
        h.addEventListener("mousedown", (ev) => startResize(ev, k), false);
        h.addEventListener(
          "touchstart",
          (tev) => {
            const t = tev.touches[0];
            if (!t) return;
            startResize(
              {
                clientX: t.clientX,
                clientY: t.clientY,
                preventDefault() {},
                stopPropagation() {},
              },
              k
            );
            tev.preventDefault();
          },
          { passive: false }
        );
      });

      // ---------- DRAG ----------
      let dragging = false,
        dStartX = 0,
        dStartY = 0,
        dBaseLeft = 0,
        dBaseTop = 0,
        dragRaf = null;

      function startDrag(ev) {
        if (ev.target.classList.contains("ci-handle")) return;
        if (!wrapper.classList.contains("float")) return;
        ev.preventDefault();
        ev.stopPropagation();
        dragging = true;
        const rect = wrapper.getBoundingClientRect();
        const bodyRect = doc.body.getBoundingClientRect();
        dBaseLeft = rect.left - bodyRect.left;
        dBaseTop = rect.top - bodyRect.top;
        dStartX = ev.clientX;
        dStartY = ev.clientY;
        doc.body.style.userSelect = "none";
        win.addEventListener("mousemove", onDrag, true);
        win.addEventListener("mouseup", stopDrag, true);
      }

      function onDrag(ev) {
        if (!dragging) return;
        if (dragRaf) return;
        dragRaf = requestAnimationFrame(() => {
          dragRaf = null;
          const dx = ev.clientX - dStartX;
          const dy = ev.clientY - dStartY;
          const bodyW = doc.body.clientWidth;
          const bodyH = Math.max(doc.body.scrollHeight, doc.body.clientHeight);
          const wRect = wrapper.getBoundingClientRect();
          const maxLeft = Math.max(0, bodyW - wRect.width);
          const maxTop = Math.max(0, bodyH - wRect.height);
          let newLeft = clamp(dBaseLeft + dx, 0, maxLeft);
          let newTop = clamp(dBaseTop + dy, 0, maxTop);
          wrapper.style.position = "absolute";
          wrapper.style.left = newLeft + "px";
          wrapper.style.top = newTop + "px";
        });
      }

      function stopDrag() {
        if (!dragging) return;
        dragging = false;
        win.removeEventListener("mousemove", onDrag, true);
        win.removeEventListener("mouseup", stopDrag, true);
        doc.body.style.userSelect = "";
        if (dragRaf) cancelAnimationFrame(dragRaf);
      }

      wrapper.addEventListener("mousedown", startDrag, false);

      // ---------- LAYOUT MENU ----------
      function showLayoutMenu(originBtn) {
        try {
          hideMenu(doc);
          const menu = doc.createElement("div");
          menu.className = "ci-menu";
          menu.innerHTML = `
            <button class="ci-menu-close" title="Close">×</button>
            <button data-mode="inline">In Line with Text</button>
            <button data-mode="float">With Text Wrapping (Float)</button>
          `;
          doc.body.appendChild(menu);

          const bRect = originBtn.getBoundingClientRect();
          const bodyRect = doc.body.getBoundingClientRect();
          menu.style.left =
            Math.min(
              Math.max(4, bRect.left - bodyRect.left),
              doc.body.clientWidth - menu.offsetWidth
            ) + "px";
          menu.style.top =
            Math.min(
              Math.max(4, bRect.bottom - bodyRect.top + 6),
              doc.body.clientHeight - menu.offsetHeight
            ) + "px";

          menu
            .querySelector(".ci-menu-close")
            .addEventListener("click", () => hideMenu(doc));
          menu.querySelectorAll("button[data-mode]").forEach((btn) => {
            btn.addEventListener(
              "click",
              (ev) => {
                ev.stopPropagation();
                const mode = btn.dataset.mode;
                wrapper.classList.remove("inline", "float");
                wrapper.classList.add(mode === "float" ? "float" : "inline");
                if (mode === "float") {
                  const rect = wrapper.getBoundingClientRect();
                  const bodyRect2 = doc.body.getBoundingClientRect();
                  wrapper.style.position = "absolute";
                  wrapper.style.left =
                    Math.round(rect.left - bodyRect2.left) + "px";
                  wrapper.style.top =
                    Math.round(rect.top - bodyRect2.top) + "px";
                } else {
                  wrapper.style.position = "";
                  wrapper.style.left = "";
                  wrapper.style.top = "";
                }
                hideMenu(doc);
              },
              false
            );
          });

          menu.addEventListener("mousedown", (e) => e.stopPropagation(), true);
        } catch (e) {
          log("showLayoutMenu err", e);
        }
      }

      if (layoutBtn) {
        layoutBtn.addEventListener(
          "click",
          (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            const alreadyOpen = !!doc.querySelector(".ci-menu");
            if (!alreadyOpen) showLayoutMenu(layoutBtn);
            else hideMenu(doc);
          },
          false
        );
      }
    }

    // ---------- lifecycle ----------
    editor.on("init", () => attachAll(true));
    editor.on("SetContent", () => attachAll(false));
    editor.on("NodeChange", () => attachAll(false));
    setTimeout(() => attachAll(false), 200);
  });
})();
