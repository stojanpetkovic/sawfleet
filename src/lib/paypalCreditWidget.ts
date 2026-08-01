// Shared "buy credit with PayPal" widget wiring for both dashboard.astro
// (contractors) and truck-dashboard.astro (truck owners) — identical flow on
// both, just parameterized by which DOM ids/toast/refresh function to use.

type SupabaseLike = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  auth: { getSession: () => Promise<{ data: { session: any } }> };
};

let sdkLoadPromise: Promise<void> | null = null;

function loadPayPalSdk(clientId: string): Promise<void> {
  if ((window as any).paypal) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('paypal_sdk_load_failed'));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export async function initPayPalCreditButton(opts: {
  supabase: SupabaseLike;
  comingSoonNoteId: string;
  buySectionId: string;
  amountInputId: string;
  buttonContainerId: string;
  msgId: string;
  onSuccess: (newBalance: number) => void | Promise<void>;
}) {
  const comingSoonNote = document.getElementById(opts.comingSoonNoteId);
  const buySection = document.getElementById(opts.buySectionId);
  const msg = document.getElementById(opts.msgId);

  const { data: config } = await opts.supabase.rpc('get_paypal_client_config');
  const cfg = Array.isArray(config) ? config[0] : config;
  if (!cfg?.enabled || !cfg?.client_id) {
    comingSoonNote?.classList.remove('hidden');
    buySection?.classList.add('hidden');
    return;
  }

  comingSoonNote?.classList.add('hidden');
  buySection?.classList.remove('hidden');

  try {
    await loadPayPalSdk(cfg.client_id);
  } catch {
    if (msg) {
      msg.textContent = 'Could not load PayPal — try refreshing the page.';
      msg.className = 'mt-2 text-[11px] text-red-600';
    }
    return;
  }

  const container = document.getElementById(opts.buttonContainerId);
  if (!container) return;
  if (!(window as any).paypal?.Buttons) {
    if (msg) {
      msg.textContent = 'PayPal is misconfigured — contact the administrator.';
      msg.className = 'mt-2 text-[11px] text-red-600';
    }
    return;
  }
  container.innerHTML = '';

  async function authHeaders() {
    const { data: { session } } = await opts.supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };
  }

  try {
    (window as any).paypal.Buttons({
      style: { layout: 'horizontal', height: 40, tagline: false },
      createOrder: async () => {
        const amountInput = document.getElementById(opts.amountInputId) as HTMLInputElement;
        const amount = Number(amountInput?.value);
        if (msg) { msg.textContent = ''; msg.className = 'mt-2 text-[11px]'; }
        if (!Number.isFinite(amount) || amount < 5) {
          if (msg) {
            msg.textContent = 'Enter an amount of at least $5.';
            msg.className = 'mt-2 text-[11px] text-red-600';
          }
          throw new Error('invalid_amount');
        }
        const res = await fetch('/api/paypal/create-order', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ amount }) });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          if (msg) {
            msg.textContent = result.message || 'Could not start the PayPal order.';
            msg.className = 'mt-2 text-[11px] text-red-600';
          }
          throw new Error(result.error || 'create_order_failed');
        }
        return result.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        const res = await fetch('/api/paypal/capture-order', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ orderId: data.orderID }) });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          if (msg) {
            msg.textContent = result.message || 'Payment could not be completed.';
            msg.className = 'mt-2 text-[11px] text-red-600';
          }
          return;
        }
        if (msg) {
          msg.textContent = '✅ Credit added — thank you!';
          msg.className = 'mt-2 text-[11px] text-green-700';
        }
        await opts.onSuccess(Number(result.balance || 0));
      },
      onCancel: () => {
        if (msg) { msg.textContent = 'Payment cancelled.'; msg.className = 'mt-2 text-[11px] text-slate-500'; }
      },
      onError: () => {
        if (msg) { msg.textContent = 'PayPal ran into an error. Please try again.'; msg.className = 'mt-2 text-[11px] text-red-600'; }
      },
    }).render(`#${opts.buttonContainerId}`);
  } catch {
    if (msg) {
      msg.textContent = 'PayPal is misconfigured — contact the administrator.';
      msg.className = 'mt-2 text-[11px] text-red-600';
    }
  }
}
