import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  title: "WhereTF",
  description: "R&D workshop item tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-200 flex h-screen overflow-hidden font-sans text-sm">
        <Sidebar />
        <main className="flex-1 flex min-w-0">{children}</main>
      </body>
    </html>
  );
}
