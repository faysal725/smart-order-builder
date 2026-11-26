import type {
  CartLine, Menu, PaymentMethod, PriceBreakdown, Selection, Violation,
} from "./engine/types";

// Server clock offset. Learned from `serverTime` in EVERY response.
// Never use Date.now() alone for countdown or expiry.
let offsetMs = 0;
export const serverNow = () => Date.now() + offsetMs;

export class ApiError extends Error {
  status: number;
  code: string;
  body: unknown;
  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function call<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK", "Network error. Check connection and retry.");
  }
  const data = await res.json().catch(() => ({}));
  if (typeof data.serverTime === "number") offsetMs = data.serverTime - Date.now();
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "ERROR", data.message ?? data.error ?? `HTTP ${res.status}`, data);
  }
  return data as T;
}

export interface ReservationView {
  id: string;
  line: CartLine;
  expiresAt: number; // server ms
}

export interface StateResponse {
  menu: Menu;
  available: Record<string, number>;
  reservations: ReservationView[];
}

export const fetchState = () => call<StateResponse>("GET", "/api/state");

export const fetchPrice = (
  requestId: number,
  cart: CartLine[],
  couponCode: string | null,
  signal?: AbortSignal,
) =>
  call<{ requestId: number; breakdown: PriceBreakdown }>(
    "POST", "/api/price", { requestId, cart, couponCode }, signal,
  );

// key = idempotency key. Same key twice = same reservation, never two.
export const reserve = (key: string, selection: Selection, qty: number) =>
  call<{ reservation: ReservationView }>("POST", "/api/reserve", { key, selection, qty });

export const updateReservation = (id: string, selection: Selection, qty: number) =>
  call<{ reservation: ReservationView }>("PUT", `/api/reserve/${id}`, { selection, qty });

export const release = (id: string) => call<{ released: boolean }>("DELETE", `/api/reserve/${id}`);

export const checkout = (key: string, paymentMethod: PaymentMethod, couponCode: string | null) =>
  call<{ order: unknown }>("POST", "/api/checkout", { key, paymentMethod, couponCode });

export const fetchOrders = () => call<{ orders: unknown[] }>("GET", "/api/orders");

export type { Violation };