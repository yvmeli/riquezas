"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ActionForm } from "@/components/form";
import { api } from "@/lib/api";

type Invitation = {
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
export default function InvitationPage() {
  const id = useSearchParams().get("id") || "";
  const started = useRef(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const tokenHash = fragment.get("token_hash");
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    (async () => {
      if (!/^[a-f0-9-]{36}$/.test(id))
        throw new Error("Enlace de invitación inválido.");
      if (tokenHash)
        await api("auth/invitation-session", "POST", {
          invitation_id: id,
          token_hash: tokenHash,
        });
      setInvitation(await api<Invitation>("invitations/" + id));
    })().catch((e) => setError(e.message));
  }, [id]);
  const closed =
    invitation &&
    (invitation.accepted_at ||
      invitation.revoked_at ||
      Date.parse(invitation.expires_at) <= Date.now());
  return (
    <main id="contenido" className="center-page">
      <Brand />
      <h1>Tu invitación a OWL</h1>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!invitation && !error && <p role="status">Validando invitación…</p>}
      {invitation && (
        <>
          <p>
            Acceso:{" "}
            {invitation.role === "client"
              ? "portal del cliente"
              : "administración · " + invitation.role}
            .
          </p>
          {closed ? (
            <p role="status">
              Esta invitación ya no está disponible. Puede estar aceptada,
              vencida o revocada.
            </p>
          ) : (
            <ActionForm
              submit="Aceptar invitación"
              onSubmit={async () => {
                const result = await api<{ redirect_to: string }>(
                  "invitations/" + id + "/accept",
                  "POST",
                  { accepted_terms: true },
                );
                window.location.assign(result.redirect_to);
              }}
            >
              <label className="checkbox">
                <input type="checkbox" required /> Acepto los{" "}
                <Link href="/terminos">términos</Link> y la{" "}
                <Link href="/privacidad">privacidad</Link>.
              </label>
            </ActionForm>
          )}
        </>
      )}
      <Link href={"/auth?invitation=" + encodeURIComponent(id)}>
        Iniciar sesión con mi cuenta
      </Link>
    </main>
  );
}
