import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Terms() {
  return (
    <>
      <header className="public-header">
        <Brand />
        <Link href="/">Volver</Link>
      </header>
      <main id="contenido" className="legal">
        <p className="eyebrow">CONDICIONES DEL MVP LOCAL · OCTUBRE 2026</p>
        <h1>
          Claridad desde
          <br />
          el principio.
        </h1>
        <h2>Alcance</h2>
        <p>
          OWL es una herramienta de organización financiera personal. Sus
          cálculos dependen de los registros que introduces. Los balances
          registrados pueden diferir de los saldos de tu banco. No constituye
          asesoría de inversión, fiscal o legal ni garantiza resultados.
        </p>
        <h2>Prueba gratuita</h2>
        <p>
          La prueba comienza después de verificar el correo y dura inicialmente
          14 días. La duración de nuevas pruebas y las extensiones pueden
          configurarse por administración. Al vencer puedes consultar y exportar
          los datos existentes; se suspenden nuevas operaciones financieras
          premium. No pedimos tarjeta ni cobramos automáticamente.
        </p>
        <h2>Tu cuenta</h2>
        <p>
          Debes mantener segura tu contraseña y registrar únicamente datos que
          estés autorizado a tratar. La verificación del correo no constituye
          verificación formal de identidad. No hay pasarela de pago ni KYC
          documental en este MVP.
        </p>
        <h2>Disponibilidad y citas</h2>
        <p>
          El entorno local puede interrumpirse durante el desarrollo. Las
          solicitudes de orientación no reservan automáticamente un horario ni
          crean una cuenta financiera. El equipo debe confirmarlas.
        </p>
        <h2>Apertura pública pendiente</h2>
        <p>
          Estas condiciones documentan la prueba local. La identidad legal del
          prestador, los canales de soporte y las condiciones comerciales
          definitivas requieren aprobación antes de ofrecer el servicio
          públicamente.
        </p>
        <Link href="/privacidad">Consultar privacidad</Link>
      </main>
    </>
  );
}
