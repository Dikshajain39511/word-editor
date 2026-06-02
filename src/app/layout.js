import "./globals.css";

// app/layout.js

export const metadata = {
  // title: "Bank Word Editor",
  description: "Edit, upload, and manage Word documents securely",
};

/**
 * ✅ IMPORTANT:
 * - TinyMCE requires proper HTML standards mode
 * - Do NOT remove <html> or <body> tags
 * - This layout wraps every page in our Next.js App Router
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">{children}</body>
    </html>
  );
}
