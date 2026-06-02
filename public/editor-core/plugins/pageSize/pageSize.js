// pageSize.js
(function () {
  // Convert mm → px @96dpi
  const mmToPx = (mm) => Math.round((mm / 25.4) * 96);

  const PAGE_SIZES = {
    A3: { width: mmToPx(297), height: mmToPx(420) },
    A4: { width: mmToPx(210), height: mmToPx(297) },
    A5: { width: mmToPx(148), height: mmToPx(210) },
    Letter: { width: mmToPx(216), height: mmToPx(279) },
    Legal: { width: mmToPx(216), height: mmToPx(356) },
    Tabloid: { width: mmToPx(279), height: mmToPx(432) },
    Executive: { width: mmToPx(184), height: mmToPx(267) },
  };

  tinymce.PluginManager.add("pageSize", function (editor) {
    const styleId = "paginate-size-style";
    let currentSizeName = "A4"; // Default selected size

    /** Inject / update style for paginate pages */
    function applyPageSize(name, size) {
      const doc = editor.getDoc();
      if (!doc) return;

      let styleTag = doc.getElementById(styleId);
      if (!styleTag) {
        styleTag = doc.createElement("style");
        styleTag.id = styleId;
        doc.head.appendChild(styleTag);
      }

      styleTag.innerHTML = `
        .paginate-page {
          width: ${size.width}px !important;
          height: ${size.height}px !important;
        }
 
        .paginate-content {
          height: 100%;
          overflow: visible;
          padding: 48px 64px;
          box-sizing: border-box;
        }
 
        @page {
          size: ${size.width}px ${size.height}px;
          margin: 0;
        }
      `;

      currentSizeName = name;

      // Fire event (optional: to trigger re-pagination)
      const evt = new CustomEvent("pageSizeChanged", {
        detail: { name, width: size.width, height: size.height },
      });
      doc.dispatchEvent(evt);

      editor.notificationManager.open({
        text: `📄 Page size set to ${name} (${size.width} × ${size.height})`,
        type: "info",
        timeout: 2000,
      });
    }

    /** Toolbar dropdown with active highlight */
    editor.ui.registry.addMenuButton("pageSize", {
      icon: "page-break",
      tooltip: "Change Page Size",
      fetch: (callback) => {
        const items = Object.entries(PAGE_SIZES).map(([name, size]) => ({
          type: "menuitem",
          text:
            name === currentSizeName
              ? `✅ ${name} (${size.width} × ${size.height})`
              : `${name} (${size.width} × ${size.height})`,
          onAction: () => applyPageSize(name, size),
        }));
        callback(items);
      },
      onSetup: (api) => {
        // Update menu when size changes
        const doc = editor.getDoc();
        const listener = () => api.setActive(true);
        doc.addEventListener("pageSizeChanged", listener);
        return () => doc.removeEventListener("pageSizeChanged", listener);
      },
    });

    /** Apply default A4 size on init */
    editor.on("init", () => {
      applyPageSize("A4", PAGE_SIZES.A4);
    });

    /** Metadata */
    return {
      getMetadata: () => ({
        name: "Page Size Plugin",
        description: "Change page size for paginate layout (A3, A4, A5, etc.)",
        author: "YourName",
        version: "1.0.1",
      }),
    };
  });
})();
