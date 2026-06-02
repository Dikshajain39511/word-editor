import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import xml2js from "xml2js"; // For parsing XML content

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, file.name);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    fs.writeFileSync(tempPath, buffer);

    // Load the DOCX file as a ZIP archive
    const zip = await JSZip.loadAsync(buffer);

    // Extract the main document XML
    const documentXml = await zip.file("word/document.xml").async("text");
    const stylesXml = await zip.file("word/styles.xml").async("text");

    // Parse the XML content
    const parser = new xml2js.Parser();
    const docXml = await parser.parseStringPromise(documentXml);
    const stylesXmlData = await parser.parseStringPromise(stylesXml);

    // Create HTML
    let htmlContent = "<html><head><style>";

    // Extract styles from styles.xml
    if (stylesXmlData["w:styles"] && stylesXmlData["w:styles"]["w:style"]) {
      stylesXmlData["w:styles"]["w:style"].forEach((style) => {
        if (style["w:name"][0] === "Normal") {
          htmlContent += `
            p {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
            }
          `;
        }
        // Add more styles based on style name (you can extract and map more styles)
      });
    }

    htmlContent += "</style></head><body>";

    // Extract paragraphs and text from document.xml
    const body = docXml["w:document"]["w:body"][0]["w:p"];

    body.forEach((paragraph) => {
      let paragraphHtml = "<p>";

      // Extract runs (text portions)
      const runs = paragraph["w:r"];
      if (runs) {
        runs.forEach((run) => {
          // Check if run has a text value
          const text = run["w:t"] ? run["w:t"][0] : "";
          paragraphHtml += text; // Ensure we only append string text
        });
      }

      paragraphHtml += "</p>";
      htmlContent += paragraphHtml;
    });

    htmlContent += "</body></html>";

    fs.unlinkSync(tempPath);

    return NextResponse.json({ html: htmlContent });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error processing the file" },
      { status: 500 }
    );
  }
}
