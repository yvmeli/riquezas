"use client";
import { useCallback, useEffect, useState } from "react";
import { ActionForm, Field, Select } from "@/components/form";
import { api } from "@/lib/api";
type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  delivery_status: string;
};
type User = {
  id: string;
  email: string;
  role: string;
  disabled_at: string | null;
};
const status = (i: Invitation) =>
  i.accepted_at
    ? "Aceptada"
    : i.revoked_at
      ? "Revocada"
      : Date.parse(i.expires_at) <= Date.now()
        ? "Vencida"
        : "Pendiente";
export default function Users() {
  const [invitations, setInvitations] = useState<Invitation[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [notice, setNotice] = useState("");
  const reload = useCallback(async () => {
    const [i, u] = await Promise.all([
      api<Invitation[]>("admin/invitations"),
      api<User[]>("admin/users"),
    ]);
    if (!Array.isArray(i) || !Array.isArray(u))
      throw new Error("No se pudo consultar la gestión de usuarios.");
    setInvitations(i);
    setUsers(u);
  }, []);
  useEffect(() => {
    reload().catch((e) => setNotice(e.message));
  }, [reload]);
  const action = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
      setNotice("Cambio guardado.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  return (
    <section className="panel">
      <h2>Usuarios e invitaciones</h2>
      <p>
        Invita por correo. Cada destinatario valida su identidad y acepta el
        acceso; no se asignan contraseñas desde este panel.
      </p>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <ActionForm
        submit="Invitar usuario"
        onSubmit={async (data) => {
          const result = await api<{ delivery_status: string }>(
            "admin/invitations",
            "POST",
            data,
          );
          await reload();
          return result.delivery_status === "sent"
            ? "Invitación enviada. Vence en 7 días."
            : "Invitación guardada; falló el envío. Puedes reintentarlo.";
        }}
      >
        <Field
          label="Correo del destinatario"
          name="email"
          type="email"
          required
        />
        <Select label="Rol de la invitación" name="role" defaultValue="client">
          <option value="client">Cliente</option>
          <option value="support">Administración · soporte</option>
          <option value="operator">Administración · operador</option>
          <option value="owner">Administración · principal</option>
        </Select>
      </ActionForm>
      <h3>Invitaciones</h3>
      {!invitations.length && <p>No hay invitaciones.</p>}
      {invitations.map((i) => (
        <article className="admin-item" key={i.id}>
          <strong>{i.email}</strong>
          <p>
            {i.role} · {status(i)} · envío: {i.delivery_status}
          </p>
          <p>Vence: {new Date(i.expires_at).toLocaleString("es-DO")}</p>
          {!i.accepted_at && !i.revoked_at && (
            <>
              <button
                className="text-button"
                onClick={() =>
                  action(() =>
                    api("admin/invitations/" + i.id + "/resend", "POST", {}),
                  )
                }
              >
                Reenviar invitación
              </button>
              <button
                className="text-button"
                onClick={() =>
                  action(() =>
                    api("admin/invitations/" + i.id + "/revoke", "POST", {}),
                  )
                }
              >
                Revocar invitación
              </button>
            </>
          )}
        </article>
      ))}
      <h3>Usuarios registrados</h3>
      {users.map((u) => (
        <article className="admin-item" key={u.id}>
          <strong>{u.email}</strong>
          <p>
            {u.role} · {u.disabled_at ? "Desactivado" : "Activo"}
          </p>
          <button
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  `${u.disabled_at ? "Activar" : "Desactivar"} acceso de ${u.email}?`,
                )
              )
                void action(() =>
                  api("admin/users/" + u.id + "/access", "PATCH", {
                    disabled: !u.disabled_at,
                  }),
                );
            }}
          >
            {u.disabled_at ? "Activar acceso" : "Desactivar acceso"}
          </button>
        </article>
      ))}
    </section>
  );
}
