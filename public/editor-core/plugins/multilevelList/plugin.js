tinymce.PluginManager.add("multilevelList", function (editor) {
  // 1️⃣ Register MS Word-like Icon
  editor.ui.registry.addIcon(
    "multilevelListIcon",
    `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <!-- Numbered lines -->
      <text x="2" y="6" font-size="1" font-family="Arial"></text>
      <rect x="8" y="4" width="10" height="2" rx="0.5"></rect>
      
      <text x="2" y="12" font-size="1" font-family="Arial"></text>
      <rect x="10" y="10" width="8" height="2" rx="0.5"></rect>
      
      <text x="2" y="18" font-size="1" font-family="Arial"></text>
      <rect x="12" y="16" width="6" height="2" rx="0.5"></rect>
    </svg>
    `
  );

  // 2️⃣ Define List Styles
  const listStyles = {
    "1. 1.1. 1.1.1.": ["1", "1.1", "1.1.1"],
    "A. A.1. A.1.a.": ["A", "A.1", "A.1.a"],
    "• ○ ▪": ["•", "○", "▪"],
  };

  // 3️⃣ Add Dropdown Button
  editor.ui.registry.addMenuButton("multilevelList", {
    icon: "multilevelListIcon",
    tooltip: "Multilevel List",
    fetch: (callback) => {
      const items = Object.keys(listStyles).map((key) => ({
        type: "menuitem",
        text: key,
        onAction: () => applyMultilevelList(key),
      }));
      callback(items);
    },
  });

  // 4️⃣ Function to Insert Nested Lists
  function applyMultilevelList(styleKey) {
    const isBulleted = styleKey.includes("•");
    const listTag = isBulleted ? "ul" : "ol";

    const html = `
      <${listTag} class="multilevel-list level-1">
        <li>${editor.selection.getContent() || "List Item 1"}
          <${listTag} class="level-2">
            <li>Sub Item 1</li>
            <li>Sub Item 2</li>
          </${listTag}>
        </li>
      </${listTag}>
    `;

    editor.insertContent(html);
  }

  // 5️⃣ Add Basic Styling
  editor.on("init", () => {
    editor.dom.addStyle(`
      .multilevel-list {
        margin: 0;
        padding-left: 20px;
      }
      .multilevel-list li {
        margin: 4px 0;
      }
      .multilevel-list.level-1 {
        list-style-type: decimal;
      }
      .multilevel-list.level-2 {
        list-style-type: lower-alpha;
      }
      .multilevel-list.level-3 {
        list-style-type: lower-roman;
      }
    `);
  });

  return {
    getMetadata: () => ({
      name: "Multilevel List Plugin",
      description: "Adds a Word-style multilevel list dropdown",
    }),
  };
});
