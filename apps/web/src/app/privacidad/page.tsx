import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Privacy() {
  return (
    <>
      <header className="public-header">
        <Brand />
        <Link href="/">Volver</Link>
      </header>
      <main id="contenido" className="legal">
        <p className="eyebrow">VERSIÓN LOCAL DEL MVP · OCTUBRE 2026</p>
        <h1>
          Tu información,
          <br />
          bajo tu control.
        </h1>
        <h2>Qué tratamos y para qué</h2>
        <p>
          OWL utiliza los datos de tu cuenta para autenticarte y los registros
          financieros que introduces para organizar cuentas, movimientos,
          presupuestos y metas. Las solicitudes de orientación se utilizan para
          gestionar la cita. No introduzcas claves bancarias, números completos
          de tarjetas ni documentos de identidad.
        </p>
        <h2>Almacenamiento y acceso</h2>
        <p>
          La versión se ejecuta con Supabase como proveedor de autenticación y
          datos. Cada usuario accede a sus registros mediante políticas de
          aislamiento en PostgreSQL. Los administradores gestionan citas y
          pruebas gratuitas; sus roles no conceden acceso general a tus
          movimientos financieros.
        </p>
        <h2>Conservación y eliminación</h2>
        <p>
          Conservamos tus registros hasta que solicites su eliminación. Desde el
          portal puedes exportarlos y eliminar los datos financieros. La
          identidad de acceso y el historial del trial permanecen para mantener
          la cuenta y evitar reinicios de la prueba. Los respaldos del proveedor
          siguen su propio ciclo de conservación. La eliminación completa de la
          identidad requiere la intervención del responsable del servicio.
        </p>
        <h2>Conexiones opcionales</h2>
        <p>
          Gmail y la importación de estados bancarios no están habilitados en
          esta entrega. Antes de activarlos se deberá detallar el
          consentimiento, los datos mínimos procesados, la retención y la
          revocación.
        </p>
        <h2>Dispositivo y cookies</h2>
        <p>
          Usamos cookies HttpOnly para la sesión. La preferencia de tema se
          guarda en el navegador. La PWA solo conserva recursos públicos de
          instalación; no guarda información financiera para consultar sin
          conexión.
        </p>
        <h2>Antes de la apertura pública</h2>
        <p>
          Esta política describe el entorno de desarrollo. El responsable debe
          confirmar su identidad legal, canal de atención, jurisdicción,
          ubicación de datos y plazos de respuesta antes de admitir usuarios
          reales públicamente.
        </p>
      </main>
    </>
  );
}
