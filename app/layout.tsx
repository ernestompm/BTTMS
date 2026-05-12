import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Marcador Vinteon · Sistema de gestión de torneos de Tenis Playa',
  description:
    'Plataforma desarrollada por Vinteon Media para arbitrar, retransmitir y gestionar torneos de Tenis Playa en tiempo real: marcadores en pista, gráficos broadcast, estadísticas y cuadros.',
  applicationName: 'Marcador Vinteon',
  authors: [{ name: 'Vinteon Media', url: 'https://vinteon.com' }],
  creator: 'Vinteon Media',
  publisher: 'Vinteon Media',
  keywords: [
    'Vinteon',
    'Marcador Vinteon',
    'Tenis Playa',
    'beach tennis',
    'gestión de torneos',
    'broadcast deportivo',
    'marcador en directo',
  ],
  openGraph: {
    title: 'Marcador Vinteon · Tenis Playa',
    description: 'Sistema profesional de gestión y emisión de torneos de Tenis Playa, desarrollado por Vinteon Media.',
    siteName: 'Marcador Vinteon',
    locale: 'es_ES',
    type: 'website',
  },
  icons: {
    icon: '/logo-full.png',
    apple: '/logo-full.png',
  },
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
