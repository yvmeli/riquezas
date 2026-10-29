"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, Download, WifiOff } from "lucide-react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function DeviceControls() {
  const [dark, setDark] = useState(false);
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const preference = localStorage.getItem("owl-theme");
    const initial = preference
      ? preference === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(initial);
    document.documentElement.dataset.theme = initial ? "dark" : "light";
    setOffline(!navigator.onLine);
    const connection = () => setOffline(!navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    addEventListener("online", connection);
    addEventListener("offline", connection);
    addEventListener("beforeinstallprompt", prompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      removeEventListener("online", connection);
      removeEventListener("offline", connection);
      removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  return (
    <>
      <div className="device-controls">
        <button
          className="icon-button"
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          onClick={() => {
            const next = !dark;
            setDark(next);
            document.documentElement.dataset.theme = next ? "dark" : "light";
            localStorage.setItem("owl-theme", next ? "dark" : "light");
          }}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button
          className="icon-button"
          aria-label="Instalar OWL"
          onClick={async () => {
            if (install) {
              await install.prompt();
              setInstall(null);
            } else setHelp(!help);
          }}
        >
          <Download size={19} />
        </button>
      </div>
      {help && (
        <aside className="install-help" role="status">
          Instala OWL desde el menú de tu navegador. En Safari para iPhone:
          Compartir → Agregar a inicio. Necesitas HTTPS o localhost y un
          navegador compatible.
          <button className="text-button" onClick={() => setHelp(false)}>
            Cerrar
          </button>
        </aside>
      )}
      {offline && (
        <div className="offline" role="status">
          <WifiOff size={16} /> Sin conexión. Tus datos financieros necesitan
          conexión para consultarse.
        </div>
      )}
    </>
  );
}
