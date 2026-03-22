import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { ToasterProvider } from "@/components/providers/toaster-provider"

export const metadata: Metadata = {
  title: "Tezcapanel",
  description: "Panel de administración de servidores",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <ToasterProvider />
      </body>
    </html>
  )
}

