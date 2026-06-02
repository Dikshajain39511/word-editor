"use client";

import { useState, useEffect } from "react";

export default function MergeFieldTester({ editorRef }) {
  const [mergeFields, setMergeFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch merge fields from backend
  useEffect(() => {
    const fetchMergeFields = async () => {
      try {
        const res = await fetch("/api/merge-fields");
        if (!res.ok) throw new Error("Failed to fetch merge fields");
        const data = await res.json();
        setMergeFields(data.mergeFields || []);
      } catch (err) {
        console.error("Error fetching merge fields:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMergeFields();
  }, []);

  const handleApply = () => {
    if (!editorRef.current) return;

    let updatedContent = editorRef.current.getContent();

    Object.keys(formData).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      updatedContent = updatedContent.replace(regex, formData[key]);
    });

    editorRef.current.setContent(updatedContent);
    alert("Merge fields updated in editor!");
  };

  if (loading) return <p>Loading merge fields...</p>;

  return (
    <div className="mt-4 p-4 bg-gray-50 border rounded w-full max-w-md">
      <h3 className="font-medium mb-2">Temporary Merge Field Tester</h3>

      {mergeFields.length === 0 && (
        <p className="text-gray-500 text-sm">No merge fields available</p>
      )}

      {mergeFields.map((field) => (
        <input
          key={field}
          placeholder={field}
          value={formData[field] || ""}
          onChange={(e) =>
            setFormData({ ...formData, [field]: e.target.value })
          }
          className="w-full mb-2 p-2 border rounded"
        />
      ))}

      <button
        onClick={handleApply}
        className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
      >
        Apply Test Values
      </button>
    </div>
  );
}
