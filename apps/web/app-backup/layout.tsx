import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SessionProvider } from "@/hooks/useSession";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Proposal Writer",
  description: "Create high-quality proposals with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">{children}</main>
            <footer className="w-full py-4 border-t">
              <div className="max-w-5xl px-4 mx-auto text-sm text-center text-muted-foreground">
                © {new Date().getFullYear()} Proposal Writer
              </div>
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
