import { Suspense } from "react";
import Invitation from "./view";
export default function Page() {
  return (
    <Suspense fallback={<p>Cargando invitación…</p>}>
      <Invitation />
    </Suspense>
  );
}
