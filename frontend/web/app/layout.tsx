import { AuthProvider } from "@/components/auth-provider";
import { LanguageProvider } from "@/components/language-provider";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { MfaRequiredDialog } from "@/components/mfa-required-dialog";
import { PageLoader } from "@/components/page-loader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { Days_One } from "next/font/google";
import type React from "react";
import "./globals.css";

const daysOne = Days_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Город Идей",
  description: "Платформа для предложения идей по развитию городов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${daysOne.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <LanguageProvider>
            <AuthProvider>
              <PageLoader />
              <MaintenanceBanner />
              <Toaster position="top-right" richColors closeButton />
              <MfaRequiredDialog />
              {children}
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
