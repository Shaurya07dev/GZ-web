import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { AssistantWidget } from "@/features/assistant/assistant-widget";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display-raw",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-body-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GalleryZone | Your Art Deserves an Identity",
  description:
    "A trusted digital ecosystem for original artwork, artists and collectors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Ships SSR output with `dark` already applied so first paint on a
      // dark-default theme never flashes the light-theme logo (black mark)
      // on a dark background. next-themes still swaps it to `light` on the
      // client if the user has that stored in their preference; its inline
      // script runs before React hydrates, and suppressHydrationWarning
      // tolerates that one-time server/client class mismatch.
      className={`${playfair.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground pb-16 lg:pb-0"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <MobileBottomNav />
            <AssistantWidget />
          </QueryProvider>
          <Toaster />
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
