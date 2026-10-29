"use client";
import { useState } from "react";
import { ApiError, formData } from "@/lib/api";
export function ActionForm({
  children,
  onSubmit,
  submit = "Guardar",
  className = "",
}: {
  children: React.ReactNode;
  onSubmit: (
    data: Record<string, string>,
    form: HTMLFormElement,
  ) => Promise<string | void>;
  submit?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <form
      className={`form ${className}`}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const result = await onSubmit(formData(form), form);
          delete form.dataset.requestKey;
          if (result) setMessage(result);
        } catch (error) {
          setError(
            error instanceof ApiError || error instanceof Error
              ? error.message
              : "Ocurrió un error.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Procesando…" : submit}
      </button>
    </form>
  );
}
export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: {
  label: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}
