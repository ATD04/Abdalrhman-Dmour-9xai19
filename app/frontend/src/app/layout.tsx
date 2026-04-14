import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shahem — Jordan Government AI Intelligence Platform",
  description: "AI-powered knowledge and policy assistant for the Jordanian public sector. Retrieve, validate, and cite official government documents with confidence.",
  keywords: "Jordan government AI, policy intelligence, RAG, knowledge management, Shahem",
};

import { AppProvider } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
