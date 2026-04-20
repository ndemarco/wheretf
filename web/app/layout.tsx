import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { auth, signOut } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: "WhereTF",
  description: "R&D workshop item tracker",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user ?? null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-200 flex h-screen overflow-hidden font-sans text-sm">
        <Sidebar user={user} onSignOut={handleSignOut} />
        <main className="flex-1 flex min-w-0">{children}</main>
      </body>
    </html>
  );
}
