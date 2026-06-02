// app/editor/components/FileUpload.js
"use client";

import React, { useRef } from "react";

/**
 * FileUpload
 * Props:
 *  - onFileLoaded(arrayBuffer, filename, originalFile) => Promise/void
 *  - existingSavedExists (boolean) - if true we will ask user before replacing
 * Behavior for Replace behavior B:
 *  - If a saved doc exists, show a confirm dialog offering Replace vs Save as New.
 *     - OK => Replace (parent should pass replaceLast=true when saving)
 *     - Cancel => Save as New (parent saves as new)
 *
 * Note: for simplicity we use window.confirm. For production, replace with a nicer modal.
 */

export default function FileUpload({ onFileLoaded, existingSavedExists }) {
  const inputRef = useRef(null);

  async function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".docx")) {
      alert(
        "Only .docx files are supported in-browser. Convert .doc to .docx first."
      );
      e.target.value = "";
      return;
    }

    // Ask user what to do if saved exists
    let replaceLast = false;
    if (existingSavedExists) {
      // Simple UX: OK = Replace last saved doc, Cancel = Save as new
      const ok = window.confirm(
        "A previously saved document exists in local storage.\n\nPress OK to REPLACE the last saved document.\nPress Cancel to SAVE AS NEW (keeps existing saved doc)."
      );
      replaceLast = ok === true;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Send arrayBuffer + filename + original File to parent
      onFileLoaded(arrayBuffer, file.name, file, replaceLast);
    } catch (err) {
      console.error("File read error:", err);
      alert("Failed to read the file. See console for details.");
    } finally {
      // reset input so same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mb-4">
      <label className="block mb-2 font-medium">Upload .docx</label>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleChange}
        className="border p-2 rounded"
      />
      <p className="text-sm text-gray-500 mt-2">
        The editor supports <strong>.docx</strong>. If a saved document exists,
        you will be asked whether to replace it or save the new file as
        separate.
      </p>
    </div>
  );
}
