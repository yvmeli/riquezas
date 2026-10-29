import { Suspense } from "react";
import { Brand } from "@/components/brand";
import AuthForm from "./view";
export default function Auth() {
  return (
    <>
      <header className="public-header">
        <Brand />
      </header>
      <main id="contenido" className="auth-page">
        <div className="auth-intro">
          <p className="eyebrow">BIENVENIDO A TU ESPACIO</p>
          <h1>
            Un lugar para
            <br />
            entender tu dinero.
          </h1>
          <p>El primer paso hacia tus metas empieza con claridad.</p>
          <span className="auth-stamp">
            OUR WEALTH LATAM
            <br />
            TU DINERO, CON DIRECCIÓN.
          </span>
        </div>
        <div className="auth-panel">
          <Suspense fallback={<p>Cargando formulario…</p>}>
            <AuthForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
