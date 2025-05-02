import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/hooks/useSession";
import { ThemeProvider } from "@/providers/theme-provider";
import { DashboardLayoutProvider } from "@/features/layout/components/DashboardLayoutContext";
import MainContent from "@/features/layout/components/MainContent";
import { NuqsAdapter } from "nuqs/adapters/next/app";

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
          <NuqsAdapter>
            <SessionProvider>
              <DashboardLayoutProvider>
                <MainContent>{children}</MainContent>
              </DashboardLayoutProvider>
            </SessionProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
