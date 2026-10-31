"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionForm, Field } from "@/components/form";
import { api } from "@/lib/api";
type Mode =
  | "login"
  | "register"
  | "verify"
  | "recover"
  | "recovery-code"
  | "password"
  | "otp-request"
  | "otp-code";
export default function AuthForm() {
  const query = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    query.get("mode") === "register" ? "register" : "login",
  );
  const [email, setEmail] = useState(""),
    [notice, setNotice] = useState("");
  const titles = {
    login: "Qué bueno verte.",
    register: "Crea tu cuenta.",
    verify: "Verifica tu correo.",
    recover: "Recupera tu acceso.",
    "recovery-code": "Revisa tu correo.",
    password: "Una nueva contraseña.",
    "otp-request": "Entra con un código.",
    "otp-code": "Revisa tu correo.",
  };
  const enterPortal = () => {
    const invitation = query.get("invitation");
    window.location.assign(
      invitation && /^[a-f0-9-]{36}$/.test(invitation)
        ? "/invitacion?id=" + invitation
        : query.get("admin") === "1"
          ? "/admin"
          : "/portal",
    );
  };
  const linkStarted = useRef(false);
  useEffect(() => {
    if (linkStarted.current) return;
    linkStarted.current = true;
    const tokenHash = new URLSearchParams(window.location.hash.slice(1)).get(
      "token_hash",
    );
    if (!tokenHash) return;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setNotice("Validando el enlace de acceso…");
    api("auth/link-session", "POST", { token_hash: tokenHash })
      .then(enterPortal)
      .catch((e) => setNotice(e.message));
  }, [query]);
  return (
    <>
      <p className="eyebrow">OWL / TU CUENTA</p>
      <h2>{titles[mode]}</h2>
      <p className="muted">
        {mode === "register"
          ? "14 días para explorar. Sin tarjeta bancaria."
          : mode === "verify" || mode === "recovery-code" || mode === "otp-code"
            ? "Introduce el código del correo. Vence en 10 minutos."
            : "Tu información en un espacio privado."}
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <ActionForm
        key={mode}
        submit={
          mode === "login"
            ? "Iniciar sesión"
            : mode === "register"
              ? "Crear cuenta"
              : mode === "recover" || mode === "otp-request"
                ? "Enviar código"
                : mode === "password"
                  ? "Actualizar contraseña"
                  : "Verificar código"
        }
        onSubmit={async (data) => {
          if (mode === "register") {
            await api("auth/register", "POST", {
              ...data,
              accepted_terms: data.accepted_terms === "on",
            });
            setEmail(data.email);
            setMode("verify");
          } else if (mode === "login") {
            await api("auth/login", "POST", data);
            enterPortal();
          } else if (mode === "otp-request") {
            await api("auth/code", "POST", { email: data.email });
            setEmail(data.email);
            setMode("otp-code");
          } else if (
            mode === "verify" ||
            mode === "recovery-code" ||
            mode === "otp-code"
          ) {
            await api("auth/verify", "POST", {
              email: data.email,
              code: data.code,
              kind:
                mode === "otp-code"
                  ? "email"
                  : mode === "verify"
                    ? "signup"
                    : "recovery",
            });
            if (mode === "otp-code") {
              enterPortal();
              return;
            }
            setMode(mode === "verify" ? "login" : "password");
            setNotice(
              mode === "verify"
                ? "Correo verificado. Tu prueba está activa; inicia sesión."
                : "Introduce una contraseña de al menos 12 caracteres.",
            );
          } else if (mode === "recover") {
            await api("auth/recover", "POST", data);
            setEmail(data.email);
            setMode("recovery-code");
          } else {
            await api("auth/password", "POST", data);
            setMode("login");
            setNotice("Contraseña actualizada. Inicia sesión de nuevo.");
          }
        }}
      >
        {mode === "register" && (
          <div className="form-row">
            <Field
              label="Nombres"
              name="first_name"
              autoComplete="given-name"
              required
              maxLength={80}
            />
            <Field
              label="Apellidos"
              name="last_name"
              autoComplete="family-name"
              required
              maxLength={80}
            />
          </div>
        )}
        {mode !== "password" && (
          <Field
            label="Correo electrónico"
            name="email"
            type="email"
            defaultValue={email}
            autoComplete="email"
            required
          />
        )}
        {["login", "register", "password"].includes(mode) && (
          <Field
            label="Contraseña"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "login" ? 1 : 12}
            maxLength={128}
            required
          />
        )}
        {mode === "register" && (
          <>
            <Field
              label="Teléfono (opcional)"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={30}
            />
            <label className="checkbox">
              <input name="accepted_terms" type="checkbox" required /> Acepto
              los <Link href="/terminos">términos</Link> y la{" "}
              <Link href="/privacidad">privacidad</Link>.
            </label>
          </>
        )}
        {["verify", "recovery-code", "otp-code"].includes(mode) && (
          <Field
            label="Código de verificación"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            required
          />
        )}
      </ActionForm>
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <button
              className="button secondary"
              onClick={() => {
                setNotice("");
                setMode("otp-request");
              }}
            >
              Entrar con código por correo
            </button>
            <button
              className="text-button"
              onClick={() => {
                setNotice("");
                setMode("recover");
              }}
            >
              Olvidé mi contraseña
            </button>
            <span>
              ¿Primera vez?{" "}
              <button
                className="text-button"
                onClick={() => {
                  setNotice("");
                  setMode("register");
                }}
              >
                Crear cuenta
              </button>
            </span>
          </>
        ) : (
          <button
            className="text-button"
            onClick={() => {
              setNotice("");
              setMode("login");
            }}
          >
            Volver a iniciar sesión
          </button>
        )}
        {mode === "verify" && (
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api("auth/resend", "POST", { email });
                setNotice(
                  "Si corresponde, recibirás un nuevo código. Espera 60 segundos para reenviar.",
                );
              } catch (error) {
                setNotice((error as Error).message);
              }
            }}
          >
            Reenviar código
          </button>
        )}
        {mode === "otp-code" && (
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api("auth/code", "POST", { email });
                setNotice(
                  "Si tu cuenta existe, recibirás otro código. Espera 60 segundos para reenviar.",
                );
              } catch (error) {
                setNotice((error as Error).message);
              }
            }}
          >
            Reenviar código
          </button>
        )}
      </div>
    </>
  );
}
