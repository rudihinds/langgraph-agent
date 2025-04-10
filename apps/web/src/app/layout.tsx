import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/hooks/useSession";
import { ThemeProvider } from "@/providers/theme-provider";
import { DashboardLayoutProvider } from "@/components/layout/DashboardLayoutContext";
import MainContent from "@/components/layout/MainContent";

const inter = Inter({ subsets: ["latin"], display: "swap" });

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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          storageKey="proposal-writer-theme"
        >
          <SessionProvider>
            <DashboardLayoutProvider>
              <MainContent>{children}</MainContent>
            </DashboardLayoutProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
