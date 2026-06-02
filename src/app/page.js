"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import mammoth from "mammoth";
import EditorToolbar from "@/components/Toolbar";
import EditorToolbar2 from "@/components/EditorToolbar";

export default function EditorPage() {
  const editorRef = useRef(null);
  const [content, setContent] = useState(
    "<p>Upload a .docx to start editing...</p>"
  );

  // Handle DOCX file upload
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

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setContent(result.value);
      alert("Document loaded successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to load document. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-4 shadow-md flex justify-center items-center">
        <h1 className="text-xl font-semibold">BankBenchers Word Editor</h1>
      </header>

      <div>
        <EditorToolbar
          editorRef={editorRef}
          content={content}
          setContent={setContent}
        />
      </div>
    </div>
  );
}
