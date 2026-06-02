"use client";

import { useEffect, useRef, useState } from "react";

export default function Editor({
  value = "",
  onChange,
  editorRef: outerRef,
  fileName = "bankFormContent",
}) {
  const internalRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initTinyMCE = async () => {
      const tinymceModule = await import("tinymce/tinymce");
      const tinymce = tinymceModule.default || tinymceModule;

      // Load icons, theme, and required plugins
      await import("tinymce/icons/default");
      await import("tinymce/themes/silver");

      const plugins = [
        "advlist",
        "autolink",
        "lists",
        "link",
        "image",
        "table",
        "code",
        "help",
        "pagebreak",
        "preview",
        "wordcount",
        "nonbreaking",
        "insertdatetime",
        "searchreplace",
        "fullscreen",
        "visualblocks",
        "visualchars",
      ];

      await Promise.all(plugins.map((p) => import(`tinymce/plugins/${p}`)));

      if (internalRef.current && !tinymce.get(internalRef.current.id)) {
        tinymce.init({
          target: internalRef.current,
          base_url: "/editor-core", // self-hosted TinyMCE path
          suffix: ".min",
          skin_url: "/editor-core/skins/ui/oxide",
          content_css: [
            "/editor-core/skins/content/default/content.css",
            "/editor-core/plugins/ruler/ruler.css",
            "/editor-core/plugins/paginate/paginate.css",
            "/editor-core/plugins/headerfooter/headerfooter.css",
            "/editor-styles.css",
          ],
          height: "calc(100vh - 100px)",
          menubar: true,
          branding: false,
          promotion: false,
          statusbar: true,
          license_key: "gpl",
          plugins: [
            ...plugins,
            "headerfooter",
            "customPrint",
            "multilevelList",
            "ruler",
            "pageSize",
            "paginate",
          ].join(" "),
          external_plugins: {
            headerfooter: "/editor-core/plugins/headerfooter/plugin.js",
            customPrint: "/editor-core/plugins/customPrint/plugin.js",
            multilevelList: "/editor-core/plugins/multilevelList/plugin.js",
            ruler: "/editor-core/plugins/ruler/plugin.js",
            pageSize: "/editor-core/plugins/pageSize/pageSize.js",
            paginate: "/editor-core/plugins/paginate/plugin.js",
          },
          toolbar:
            "undo redo | rulerBtn | formatselect | bold italic underline | " +
            "alignleft aligncenter alignright alignjustify | " +
            "bullist numlist multilevelList outdent indent  |  autoPaginate headerBtn footerBtn removeHeader removeFooter pageSize pageBreak | link image table | customPrintBtn | help",
          setup: (editor) => {
            editorInstanceRef.current = editor;
            if (outerRef) outerRef.current = editor;

            editor.on("change keyup paste", () => {
              const html = editor.getContent();
              onChange?.(html);

              if (!fileName) return;
              const key = `html_${fileName}`;
              localStorage.setItem(key, html);
            });
          },
          init_instance_callback: (editor) => {
            if (!fileName) return;

            const key = `html_${fileName}`;
            const saved = localStorage.getItem(key);

            if (saved) {
              editor.setContent(saved);
            } else if (value) {
              editor.setContent(value);
            }
            setLoaded(true);
          },
        });
      }
    };

    initTinyMCE();

    return () => {
      isMounted = false;
      import("tinymce/tinymce").then((m) => {
        const tinymce = m.default || m;
        if (editorInstanceRef.current) {
          tinymce.remove(editorInstanceRef.current);
          editorInstanceRef.current = null;
          if (outerRef) outerRef.current = null;
        }
      });
    };
  }, []); // ✅ empty dependency: init only once

  // ✅ update content if parent value changes externally
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (editor && value !== editor.getContent()) {
      editor.setContent(value);
    }
  }, [value]);

  return (
    <div>
      <textarea id="tinymce-editor" ref={internalRef}></textarea>
      {!loaded && <p>Loading editor...</p>}
    </div>
  );
}
