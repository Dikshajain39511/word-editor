"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import mammoth from "mammoth";
import { saveAs } from "file-saver";
import htmlDocx from "html-docx-js/dist/html-docx";
import Editor from "./Editor";
import PageSizeSelector from "./PageSizeSelector";

export default function EditorToolbar() {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [currentDoc, setCurrentDoc] = useState(null);

  // -----------------------------
  // States
  // -----------------------------
  const [content, setContent] = useState(
    "<p>Upload a .docx to start editing...</p>"
  );
  const [mergeFields, setMergeFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [pageSize, setPageSize] = useState({
    name: "A4",
    width: 210,
    height: 297,
  });

  // -----------------------------
  // Load content & merge fields from LocalStorage
  // -----------------------------
  useEffect(() => {
    const savedContent = localStorage.getItem("bankFormContent");
    if (savedContent) setContent(savedContent);

    const savedFields = localStorage.getItem("bankMergeFields");
    if (savedFields) setMergeFields(JSON.parse(savedFields));
  }, []);

  useEffect(() => {
    localStorage.setItem("bankMergeFields", JSON.stringify(mergeFields));
  }, [mergeFields]);

  // -----------------------------
  // Load dummy merge fields JSON (simulate backend)
  // -----------------------------
  // -----------------------------
  // Load merge fields from backend
  // -----------------------------
  useEffect(() => {
    const fetchMergeFields = async () => {
      try {
        const res = await fetch("api/merge-fields");
        if (!res.ok) throw new Error("Failed to fetch merge fields");

        const data = await res.json();

        // Combine backend fields + locally added fields
        const combined = Array.from(
          new Set([...mergeFields, ...(data.mergeFields || [])])
        );

        setMergeFields(combined);
        localStorage.setItem("bankMergeFields", JSON.stringify(combined));
      } catch (err) {
        console.error("Error fetching merge fields:", err);
      }
    };

    fetchMergeFields();
  }, []);

  // -----------------------------
  // File Upload
  // -----------------------------
  const triggerUpload = () => fileInputRef.current.click();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (
      file.type !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      alert("Please upload a valid .docx file");
      return;
    }

    let fileName = file.name || "Untitled.docx";
    setCurrentDoc(fileName);

    // ✅ Normalize keys
    const editedKey = `html_${fileName}`;
    const originalKey = `html_${fileName
      .replace("-edited", "")
      .replace(/\.docx$/i, ".docx")}`;

    // 1️⃣ Try to load edited version cache first
    const editedHTML = localStorage.getItem(editedKey);
    if (editedHTML) {
      setContent(editedHTML);
      return;
    }

    // 2️⃣ If no edited version, try original version
    const originalHTML = localStorage.getItem(originalKey);
    if (originalHTML) {
      setContent(originalHTML);
      return;
    }

    // 3️⃣ Else convert new file
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setContent(result.value);

      // Save as edited or original based on name
      const keyToSave = fileName.includes("-edited") ? editedKey : originalKey;

      localStorage.setItem(keyToSave, result.value);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to load document");
    }
  };

  // -----------------------------
  // Export to Word
  // -----------------------------
  const handleExport = () => {
    if (!editorRef.current) return;

    const html = editorRef.current.getContent();
    const styledHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Exported Document</title>
        <style>
          @page { size: A4; margin: 25mm; }
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            margin: 25mm;
            color: #000;
          }
          .ruler-bar, .vertical-ruler, .ruler-marker, .v-marker {
            display: none !important;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

    const converted = htmlDocx.asBlob(styledHtml);

    const safeName = currentDoc || "Untitled.docx";
    const baseName = safeName.replace(/\.docx$/i, "");
    const exportName = baseName.includes("-edited")
      ? `${baseName}.docx`
      : `${baseName}-edited.docx`;

    saveAs(converted, exportName);

    // ✅ Cache updated HTML under edited version
    const key = `html_${exportName}`;
    localStorage.setItem(key, html);
  };

  // -----------------------------
  // Clear Storage
  // -----------------------------
  const handleClear = () => {
    if (
      confirm("Are you sure you want to clear saved content and merge fields?")
    ) {
      localStorage.removeItem("bankFormContent");
      localStorage.removeItem("bankMergeFields");
      setContent("");
      setMergeFields([]);
      editorRef.current.setContent("");
    }
  };

  // -----------------------------
  // Merge Fields Functions
  // -----------------------------
  const handleAddField = () => {
    const field = newFieldName.trim();
    if (!field) return alert("Field name cannot be empty!");
    if (!/^[a-zA-Z0-9_]+$/.test(field))
      return alert("Only letters, numbers, and underscores allowed!");
    if (mergeFields.includes(field)) return alert("Field already exists!");

    setMergeFields([...mergeFields, field]);
    setNewFieldName("");
  };

  const handleDeleteField = (field) => {
    if (confirm(`Are you sure you want to delete the field "{{${field}}}"?`)) {
      // Remove from state
      const updatedFields = mergeFields.filter((f) => f !== field);
      setMergeFields(updatedFields);
      localStorage.setItem("bankMergeFields", JSON.stringify(updatedFields));

      // Remove all instances from editor
      if (editorRef.current) {
        const editor = editorRef.current;
        const spans = editor.dom.select("span.merge-field");

        spans.forEach((span) => {
          if (span.textContent.trim() === `{{${field}}}`) {
            span.remove();
          }
        });

        const updatedContent = editor.getContent();
        setContent(updatedContent);
        localStorage.setItem("bankFormContent", updatedContent);
      }
    }
  };

  const handleInsertField = (field) => {
    if (!editorRef.current) return;

    const formattedField = `<span class="merge-field" contenteditable="false">{{${field}}}</span>`;
    editorRef.current.insertContent(formattedField);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: Sidebar */}
      <div className="w-1/6 p-4 border-r bg-gray-100 flex flex-col space-y-2 ">
        <input
          type="file"
          ref={fileInputRef}
          accept=".docx"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          onClick={triggerUpload}
        >
          Upload & Load
        </button>
        <button
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          onClick={handleExport}
        >
          Export to Word
        </button>
        <button
          className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
          onClick={handleClear}
        >
          Clear Storage
        </button>
      </div>

      {/* Center: Editor */}
      <div className="flex-1 p-4">
        <Editor
          value={content}
          editorRef={editorRef} // pass ref to parent
          onChange={(newContent) => {
            setContent(newContent);
            if (currentDoc) {
              const key = `html_${currentDoc}`;
              localStorage.setItem(key, newContent);
            }
          }}
          fileName={currentDoc}
        />
      </div>

      {/* <div className="flex-1 p-4 flex flex-col">
        <PageSizeSelector
          current={pageSize.name}
          onChange={(name, size) => setPageSize({ name, ...size })}
        />

        <div className="flex justify-center overflow-auto bg-gray-200 p-8 rounded-lg shadow-inner">
          <div
            className="page bg-white shadow-lg border border-gray-300"
            style={{
              width: `${pageSize.width}mm`,
              height: `${pageSize.height}mm`,
              padding: "20mm",
              overflowY: "auto",
              overflowX: "hidden",
              position: "relative",
            }}
          >
            <Editor
              value={content}
              editorRef={editorRef}
              onChange={(newContent) => {
                setContent(newContent);
                localStorage.setItem("bankFormContent", newContent);
              }}
            />
          </div>
        </div>
      </div> */}

      {/* Right: Merge Fields Sidebar */}
      <div className="w-80 bg-gray-100 p-4 border-l">
        <h2 className="text-lg font-medium mb-2">Merge Fields</h2>

        {/* Add Field */}
        <div className="flex mb-4">
          <input
            type="text"
            placeholder="Enter field name..."
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="flex-1 p-2 border rounded-l"
          />
          <button
            onClick={handleAddField}
            className="px-3 bg-blue-600 text-white rounded-r hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        {/* List of Merge Fields */}
        <div className="space-y-2">
          {mergeFields.length === 0 && (
            <p className="text-gray-500 text-sm">No merge fields yet.</p>
          )}
          {mergeFields.map((field) => (
            <div
              key={field}
              className="flex justify-between items-center bg-white p-2 rounded shadow-sm"
            >
              <span
                className="cursor-pointer text-blue-700 font-medium"
                onClick={() => handleInsertField(field)}
              >
                {`{{${field}}}`}
              </span>
              <button
                onClick={() => handleDeleteField(field)}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tailwind Styling for merge fields */}
      <style jsx>{`
        .merge-field {
          background-color: #fff7d6;
          color: #b45309;
          border-radius: 4px;
          padding: 2px 6px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
