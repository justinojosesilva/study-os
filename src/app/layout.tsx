import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { AppShell } from "./_components/AppShell";
import { SignOutButton } from "./_components/SignOutButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Latis Skills",
  description: "Transforme objetivos de carreira em planos de estudo executáveis.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  // Read here rather than in the client so the sidebar renders at its final
  // width on the first paint, instead of flashing open and then collapsing.
  const collapsed = cookieStore.get("sidebar")?.value === "collapsed";

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <AppShell
          user={session?.user ?? null}
          signOut={<SignOutButton />}
          initialCollapsed={collapsed}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
