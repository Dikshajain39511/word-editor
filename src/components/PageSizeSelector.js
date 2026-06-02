"use client";
import React from "react";

const PAGE_SIZES = {
  A4: { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
};

export default function PageSizeSelector({ current, onChange }) {
  return (
    <div className="flex items-center space-x-2 mb-4">
      <label className="font-medium">Page Size:</label>
      <select
        value={current}
        onChange={(e) => {
          const name = e.target.value;
          onChange(name, PAGE_SIZES[name]);
        }}
        className="border p-2 rounded bg-white"
      >
        {Object.keys(PAGE_SIZES).map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}
