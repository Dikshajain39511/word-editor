(function () {
  // =========================================
  // 📏 BASIC CONSTANTS & HELPER FUNCTIONS
  // =========================================

  // Conversion constants
  const PX_PER_MM = 3.78; // Each millimeter equals ~3.78 screen pixels
  const MIN_GAP_MM = 5; // Minimum distance between markers (in mm)
  const MIN_GAP_PX = MIN_GAP_MM * PX_PER_MM; // Convert that to pixels
  const PAGINATE_CONTENT_PADDING_LEFT = 64; // Default page padding on left side

  // Tags that represent "block" elements (paragraphs, headings, etc.)
  const BLOCK_TAGS = [
    "P",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "BLOCKQUOTE",
  ];

  // Convert between mm and px
  const pxFromMm = (mm) => Math.round(mm * PX_PER_MM);
  const pxToMm = (px) => px / PX_PER_MM;

  // Find the top-level "block" element for a given DOM node
  function getBlockElement(node) {
    let el = node;
    while (el && el.nodeType === 1) {
      if (BLOCK_TAGS.includes(el.nodeName)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Get the usable width of the content area (in pixels)
  function getContentWidthPx(editor) {
    const doc = editor.getDoc();
    const content = doc.body.querySelector(".paginate-page");
    if (!content) return doc.documentElement.clientWidth - 40;

    const style = window.getComputedStyle(content);
    const pl = parseFloat(style.paddingLeft || PAGINATE_CONTENT_PADDING_LEFT);
    const pr = parseFloat(style.paddingRight || PAGINATE_CONTENT_PADDING_LEFT);
    return Math.max(0, content.clientWidth - pl - pr);
  }

  // =========================================
  // 🧩 TINYMCE PLUGIN DEFINITION
  // =========================================
  tinymce.PluginManager.add("ruler", function (editor) {
    let horRulerEl, canvas, leftMarker, rightMarker, indentMarker, rafId;

    // ---------------------------------------------------
    // 🏗️ STEP 1: Create the horizontal ruler and markers
    // ---------------------------------------------------
    function createRulers() {
      const doc = editor.getDoc();
      if (!doc || horRulerEl?.isConnected) return;

      // Create the top ruler bar
      horRulerEl = doc.createElement("div");
      horRulerEl.className = "ruler-bar fixed-top";

      // Create a canvas to draw scale lines (like centimeter marks)
      canvas = doc.createElement("canvas");
      canvas.className = "ruler-canvas";
      horRulerEl.appendChild(canvas);

      // Create three draggable markers:
      // Left Margin, Right Margin, and First-Line Indent
      leftMarker = createMarker(doc, "left", "Left margin");
      rightMarker = createMarker(doc, "right", "Right margin");
      indentMarker = createMarker(doc, "indent", "First line indent");

      horRulerEl.append(leftMarker, rightMarker, indentMarker);
      doc.documentElement.insertBefore(horRulerEl, doc.body);

      // Initialize positions and enable dragging
      initializeMarkerPositions(editor);
      makeMarkerDraggable(leftMarker, "left");
      makeMarkerDraggable(rightMarker, "right", true);
      makeMarkerDraggable(indentMarker, "indent");

      // Start redrawing the ruler continuously
      startLoop();
    }

    // Create a draggable marker element
    function createMarker(doc, className, title) {
      const marker = doc.createElement("div");
      marker.className = `ruler-marker ${className}-marker`;
      marker.title = title;
      return marker;
    }

    // Set initial marker positions if they aren’t already set
    function initializeMarkerPositions(editor) {
      const width = getContentWidthPx(editor);
      if (!leftMarker.style.left)
        leftMarker.style.left = PAGINATE_CONTENT_PADDING_LEFT + "px";
      if (!rightMarker.style.right)
        rightMarker.style.right = PAGINATE_CONTENT_PADDING_LEFT + "px";

      // Default indent = 10mm to the right of left margin
      if (!indentMarker.style.left) {
        const defaultIndentPx =
          parseFloat(leftMarker.style.left) + pxFromMm(10);
        indentMarker.style.left =
          Math.min(
            defaultIndentPx,
            width - (parseFloat(rightMarker.style.right || 0) + MIN_GAP_PX)
          ) + "px";
      }
    }

    // ---------------------------------------------------
    // 📐 STEP 2: Draw the ruler scale (lines for cm/mm)
    // ---------------------------------------------------
    function drawScale() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = Math.max(200, getContentWidthPx(editor));
      canvas.width = Math.round(width);
      canvas.height = 24;

      ctx.clearRect(0, 0, width, canvas.height);
      ctx.strokeStyle = "#888";
      ctx.beginPath();

      // Draw vertical tick marks for each millimeter
      const pxPerCm = PX_PER_MM * 10;
      for (let x = 0; x < width; x += pxPerCm / 10) {
        const isCm = Math.round(x) % Math.round(pxPerCm) === 0;
        ctx.moveTo(x + 0.5, canvas.height);
        ctx.lineTo(x + 0.5, canvas.height - (isCm ? 12 : 6));
      }
      ctx.stroke();
    }

    // ---------------------------------------------------
    // 📄 STEP 3: Apply margins (left/right) to content
    // ---------------------------------------------------
    function applyMargins(forceFullAlign = false) {
      const doc = editor.getDoc();
      const contentEls = doc.body.querySelectorAll(".paginate-page-main");
      const leftPx =
        parseFloat(leftMarker.style.left) || PAGINATE_CONTENT_PADDING_LEFT;
      const rightPx =
        parseFloat(rightMarker.style.right) || PAGINATE_CONTENT_PADDING_LEFT;

      contentEls.forEach((content) => {
        // Update page-level left and right padding
        content.style.paddingLeft = leftPx + "px";
        content.style.paddingRight = rightPx + "px";

        // If full alignment is not forced → stop here
        if (!forceFullAlign) return;

        // Otherwise, reset all paragraph-level offsets
        const blocks = content.querySelectorAll(
          "p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote"
        );
        blocks.forEach((block) => {
          block.style.marginLeft = "0px";
          block.style.marginRight = "0px";
          block.style.paddingLeft = "0px";
          block.style.textIndent = "0px";
        });

        // Also fix list numbering/bullet alignment
        content.querySelectorAll("ul, ol").forEach((list) => {
          list.style.marginLeft = "0px";
          list.style.paddingLeft = "0px";
          list.style.listStylePosition = "inside";
        });
      });
    }

    // ---------------------------------------------------
    // 🧾 STEP 4: Handle first-line indent logic
    // ---------------------------------------------------
    function applyIndent(forceFullAlign = false) {
      const doc = editor.getDoc();
      const leftPx = parseFloat(leftMarker.style.left) || 0;
      const indentPx = parseFloat(indentMarker.style.left) || 0;
      const diff = indentPx - leftPx;

      // If left margin was moved → align all content left
      if (forceFullAlign || diff <= 2) {
        const blocks = doc.body.querySelectorAll(
          ".paginate-page-main p, .paginate-page-main div, .paginate-page-main li, .paginate-page-main blockquote"
        );
        blocks.forEach((block) => {
          block.style.textIndent = "0px";
          block.style.paddingLeft = "0px";
          block.style.marginLeft = "0px";
        });
        return;
      }

      // Otherwise, only apply indent to current or selected blocks
      const selRange = editor.selection.getRng();
      const selector = BLOCK_TAGS.join(",");
      const blocks = Array.from(doc.body.querySelectorAll(selector));

      const applyToBlock = (block) => {
        if (diff >= 0) {
          // Normal first-line indent
          block.style.textIndent = pxToMm(diff) + "mm";
          block.style.paddingLeft = "";
        } else {
          // Hanging indent (used for bullet lists, etc.)
          const hang = Math.abs(diff);
          block.style.textIndent = pxToMm(-hang) + "mm";
          block.style.paddingLeft = pxToMm(hang) + "mm";
        }
      };

      if (selRange && !selRange.collapsed) {
        blocks.forEach((b) => {
          try {
            if (selRange.intersectsNode(b)) applyToBlock(b);
          } catch (_) {}
        });
      } else {
        const node = editor.selection.getNode();
        const block = getBlockElement(node);
        if (block) applyToBlock(block);
      }
    }

    // ---------------------------------------------------
    // 🖱️ STEP 5: Enable dragging of ruler markers
    // ---------------------------------------------------
    function makeMarkerDraggable(marker, type, anchorRight = false) {
      const win = editor.getWin();
      let startPos = 0,
        startOffset = 0;

      // When user starts dragging a marker
      const onDown = (evt) => {
        evt.preventDefault();
        const e = evt.touches ? evt.touches[0] : evt;
        startPos = e.clientX;
        startOffset = anchorRight
          ? parseFloat(marker.style.right) || 0
          : parseFloat(marker.style.left) || 0;

        // Listen for movement and release
        win.addEventListener("mousemove", onMove);
        win.addEventListener("mouseup", onUp);
        win.addEventListener("touchmove", onMove, { passive: false });
        win.addEventListener("touchend", onUp);
      };

      // When user moves the marker
      const onMove = (evt) => {
        const e = evt.touches ? evt.touches[0] : evt;
        const delta = e.clientX - startPos;
        const width = getContentWidthPx(editor);

        if (type === "left") {
          // Adjust left margin position
          const newLeft = Math.min(
            width - parseFloat(rightMarker.style.right || 0) - MIN_GAP_PX,
            Math.max(0, startOffset + delta)
          );
          marker.style.left = newLeft + "px";

          // Prevent indent marker from going inside margin
          if (parseFloat(indentMarker.style.left || 0) < newLeft + MIN_GAP_PX)
            indentMarker.style.left = newLeft + MIN_GAP_PX + "px";

          // Align all text when left margin changes
          applyMargins(true);
          applyIndent(true);
        } else if (type === "right") {
          // Adjust right margin position
          const newRight = Math.min(
            width - parseFloat(leftMarker.style.left || 0) - MIN_GAP_PX,
            Math.max(MIN_GAP_PX, startOffset - delta)
          );
          marker.style.right = newRight + "px";
        } else if (type === "indent") {
          // Move first-line indent marker
          const newIndent = Math.min(
            width - parseFloat(rightMarker.style.right || 0) - MIN_GAP_PX,
            Math.max(0, startOffset + delta)
          );
          marker.style.left = newIndent + "px";
          applyIndent(); // only affect current selection or paragraph
        }

        applyMargins(); // keep layout synced during drag
      };

      // When user releases the marker
      const onUp = () => {
        win.removeEventListener("mousemove", onMove);
        win.removeEventListener("mouseup", onUp);
        win.removeEventListener("touchmove", onMove);
        win.removeEventListener("touchend", onUp);
      };

      marker.addEventListener("mousedown", onDown);
      marker.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          onDown(e);
        },
        { passive: false }
      );
    }

    // ---------------------------------------------------
    // 🔁 STEP 6: Continuously update ruler visuals
    // ---------------------------------------------------
    function startLoop() {
      const loop = () => {
        drawScale(); // redraw ruler scale
        applyMargins(); // keep margins synced visually
        rafId = editor.getWin().requestAnimationFrame(loop);
      };
      rafId = editor.getWin().requestAnimationFrame(loop);
    }

    // ---------------------------------------------------
    // 🧹 STEP 7: Setup and cleanup
    // ---------------------------------------------------
    editor.on("init", createRulers);
    editor.on("remove", () => {
      horRulerEl?.remove();
      cancelAnimationFrame(rafId);
    });
  });
})();
