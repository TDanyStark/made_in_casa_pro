import './globals.css';
import { poppins } from '@/app/ui/fonts';
import { Metadata } from 'next';


export const metadata: Metadata = {
  title: {
    template: '%s | Made in Casa',
    default: 'Made in Casa Pro v2',
  },
  description: 'Sistema de gestioón de proyectos de market support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${poppins.className} antialiased bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text`}>{children}</body>
    </html>
  );
}