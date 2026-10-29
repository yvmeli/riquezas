export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let refreshing: Promise<void> | null = null;

export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
  retry = true,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  if (response.status === 401 && retry && !path.startsWith("auth/")) {
    refreshing ||= api("auth/refresh", "POST", {}, false)
      .then(() => {})
      .finally(() => {
        refreshing = null;
      });
    await refreshing;
    return api<T>(path, method, data, false);
  }
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      result.detail || "No se pudo completar la operación.",
    );
  return result as T;
}

export function formData(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<
    string,
    string
  >;
}

export function requestKey(form: HTMLFormElement) {
  form.dataset.requestKey ||= crypto.randomUUID();
  return form.dataset.requestKey;
}

export function money(value: string | number, currency = "DOP") {
  const decimal = String(value).match(/^(-?)(\d+)(?:[.](\d{1,2}))?$/);
  if (!decimal) return "—";
  const [, sign, whole, fraction = ""] = decimal;
  const negative = sign === "-";
  const integer = BigInt(whole);
  const negativeFraction = negative && integer === 0n;
  const formatter = new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter
    .formatToParts(negativeFraction ? -1n : negative ? -integer : integer)
    .map((part) =>
      part.type === "fraction"
        ? fraction.padEnd(2, "0")
        : part.type === "integer" && negativeFraction
          ? "0"
          : part.value,
    )
    .join("");
}
