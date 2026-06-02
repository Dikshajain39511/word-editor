/* global tinymce, html2canvas, jspdf */

tinymce.PluginManager.add("customPDFExport", function (editor) {
  // ✅ Add a toolbar button
  editor.ui.registry.addButton("customPDFExport", {
    text: "Export PDF",
    icon: "export",
    tooltip: "Export document as PDF",
    onAction: async function () {
      const content = editor.getContent();
      const header = editor.getParam("pdf_header", "");
      const footer = editor.getParam("pdf_footer", "");

      // Create temp DOM for rendering
      const temp = document.createElement("div");
      temp.innerHTML = `
        <div style="padding: 40px; font-family: Arial;">
          <div style="text-align:center; font-weight:bold; margin-bottom:20px;">
            ${header}
          </div>
          ${content}
          <div style="text-align:center; margin-top:30px; font-size:12px; color:#777;">
            ${footer}
          </div>
        </div>`;
      document.body.appendChild(temp);

      const { jsPDF } = window.jspdf;
      try {
        const canvas = await html2canvas(temp, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "a4");

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        // Page numbers
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.text(
            `Page ${i} of ${pageCount}`,
            pdf.internal.pageSize.getWidth() - 70,
            pdf.internal.pageSize.getHeight() - 20
          );
        }

        pdf.save("Bank_Document.pdf");
      } catch (err) {
        console.error("PDF Export failed:", err);
        editor.windowManager.alert("Error generating PDF. Check console.");
      } finally {
        temp.remove();
      }
    },
  });

  // ✅ Metadata (optional)
  return {
    getMetadata: () => ({
      name: "Custom PDF Export",
      url: "https://yourbank.in",
    }),
  };
});
