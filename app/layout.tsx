import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTTMS - Beach Tennis Tournament Management System',
  description: 'Sistema de gestión de torneos de Tenis Playa - RFET',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
