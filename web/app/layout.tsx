import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { UserSwitcherShell } from "./components/UserSwitcherShell";

export const metadata: Metadata = {
  title: "WhereTF",
  description: "R&D workshop item tracker",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-200 flex h-screen overflow-hidden font-sans text-sm">
        <Sidebar footer={<UserSwitcherShell />} />
        <main className="flex-1 flex min-w-0">{children}</main>
      </body>
    </html>
  );
}
