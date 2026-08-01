import { supabaseAdmin } from "./supabaseAdmin";

type PaymentSettings = {
  paypal_enabled: boolean;
  paypal_client_id: string | null;
  paypal_client_secret: string | null;
  paypal_mode: "sandbox" | "live";
};

async function getPaymentSettings(): Promise<PaymentSettings | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
  return data as PaymentSettings | null;
}

function apiBase(mode: string) {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken(settings: PaymentSettings): Promise<string> {
  const basicAuth = Buffer.from(`${settings.paypal_client_id}:${settings.paypal_client_secret}`).toString("base64");
  const res = await fetch(`${apiBase(settings.paypal_mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "paypal_auth_failed");
  return data.access_token;
}

export async function createPayPalOrder(amount: number): Promise<{ id: string }> {
  const settings = await getPaymentSettings();
  if (!settings?.paypal_enabled || !settings.paypal_client_id || !settings.paypal_client_secret) {
    throw new Error("paypal_not_configured");
  }
  const token = await getAccessToken(settings);
  const res = await fetch(`${apiBase(settings.paypal_mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: amount.toFixed(2) } }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "paypal_create_order_failed");
  return data;
}

export async function capturePayPalOrder(orderId: string): Promise<{ status: string; capturedAmount: number | null }> {
  const settings = await getPaymentSettings();
  if (!settings?.paypal_enabled || !settings.paypal_client_id || !settings.paypal_client_secret) {
    throw new Error("paypal_not_configured");
  }
  const token = await getAccessToken(settings);
  const res = await fetch(`${apiBase(settings.paypal_mode)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "paypal_capture_failed");
  const capturedAmount = Number(data.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value);
  return { status: data.status, capturedAmount: Number.isFinite(capturedAmount) ? capturedAmount : null };
}
