import type { Metadata } from "next";
import "./globals.css";
import "./styles/tiptap.css"; // Importamos los estilos globales de TipTap
import { ThemeProvider } from "@/components/theme-provider";
import QueryProvider from "./components/QueryProvider";
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: {
    template: "%s | Made in Casa Pro",
    default: "Made in Casa Pro",
  },
  description: "Sistema de gestión de proyectos de market support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="es" className="antialiased">
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
