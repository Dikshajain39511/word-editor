"use client";

import { useRef, useState } from "react";
import Editor from "./Editor";
import PageSizeSelector from "./PageSizeSelector";

export default function EditorToolbar2() {
  const editorRef = useRef(null);

  // Default page size = A4
  const [pageSize, setPageSize] = useState({
    name: "A4",
    width: 210,
    height: 297,
  });

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar (if you have one, keep as-is) */}

      {/* Main Editor Area */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Page Size Selector */}
        <PageSizeSelector
          current={pageSize.name}
          onChange={(name, size) => setPageSize({ name, ...size })}
        />

        {/* Page Preview Container */}
        <div className="flex justify-center overflow-auto bg-gray-200 p-8 rounded-lg shadow-inner">
          <div
            className="page bg-white shadow-lg border border-gray-300"
            style={{
              width: `${pageSize.width}mm`,
              height: `${pageSize.height}mm`,
              padding: "20mm",
              overflowY: "auto",
              overflowX: "hidden",
              boxShadow: "0 0 5px rgba(0,0,0,0.3)",
              position: "relative",
            }}
          >
            <Editor editorRef={editorRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
