import type { Metadata, Viewport } from "next";
import { DeviceControls } from "@/components/device";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "OWL · Tu dinero, con dirección", template: "%s · OWL" },
  description:
    "Organiza tus cuentas, entiende tus gastos y avanza hacia tus metas. Finanzas personales para República Dominicana.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icons/owl-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "OWL" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#183c35",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="skip" href="#contenido">
          Saltar al contenido
        </a>
        {children}
        <DeviceControls />
      </body>
    </html>
  );
}
