import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "Acme News", template: "%s · Acme News" },
  description: "Stories from the Acme engineering team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <Link href="/articles" className="text-lg font-semibold tracking-tight">
              Acme News
            </Link>
            <nav className="text-sm text-muted">
              <a href="/about" className="hover:text-foreground">
                About
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
