tinymce.PluginManager.add("customPrint", function (editor) {
  const printDoc = () => {
    const iframeDoc = editor.getDoc();
    if (!iframeDoc) return;

    // ✅ Extract computed ruler-based margins and indent
    const body = iframeDoc.body;
    const styles = iframeDoc.defaultView.getComputedStyle(body);

    const leftMargin = styles.marginLeft || "20mm";
    const rightMargin = styles.marginRight || "20mm";
    const topMargin = styles.marginTop || "20mm";
    const bottomMargin = styles.marginBottom || "20mm";

    // ✅ Detect first-line indent (if set via your ruler)
    const firstLineIndent = styles.textIndent || "0";

    // ✅ Create a hidden iframe clone for printing
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const printDoc = printFrame.contentWindow.document;

    // ✅ Begin writing cloned HTML content
    printDoc.open();
    printDoc.write("<!DOCTYPE html><html><head>");
    printDoc.write(iframeDoc.head.innerHTML);

    // ✅ Add ruler-aware print CSS
    printDoc.write(`
      <style>
        @media print {
          @page {
            size: A4;
            margin-top: ${topMargin};
            margin-right: ${rightMargin};
            margin-bottom: ${bottomMargin};
            margin-left: ${leftMargin};
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 12px;
              color: #444;
            }
          }

          body {
            margin: ${topMargin} ${rightMargin} ${bottomMargin} ${leftMargin};
            text-indent: ${firstLineIndent};
            box-sizing: border-box;
            font-family: inherit;
            font-size: inherit;
          }

          /* Hide rulers, markers, and editor UI */
          .ruler-bar,
          .vertical-ruler,
          .ruler-marker,
          .v-marker {
            display: none !important;
          }
        }

        html, body {
          width: 100%;
          height: 100%;
          padding: 0;
        }
      </style>
    `);

    printDoc.write("</head><body>");
    printDoc.write(iframeDoc.body.innerHTML);
    printDoc.write("</body></html>");
    printDoc.close();

    // ✅ Wait for content + styles to load before printing
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();

    // ✅ Cleanup after print
    setTimeout(() => document.body.removeChild(printFrame), 2000);
  };

  // Register toolbar button
  editor.ui.registry.addButton("customPrintBtn", {
    icon: "print",
    tooltip: "Print Document with Ruler Margins",
    onAction: printDoc,
  });

  return {
    getMetadata: () => ({
      name: "Custom Print Plugin with Ruler Margin Support",
      url: "https://yourdomain.com/docs/customPrint",
    }),
  };
});
