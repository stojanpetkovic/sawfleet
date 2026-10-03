import { business } from '../config/business';

/*
 * Every form marked data-lead-form="name" posts its fields to the lead admin
 * (stojanpetkovic.com/api/leads) and, once the lead is stored, goes to the
 * thank-you page. The admin emails the inquiry; nothing here depends on a
 * mail server of the site's own.
 *
 * The forms carry data-lead-ignore so the page-wide collector (leads.js)
 * does not send them a second time.
 */

const ENDPOINT = 'https://stojanpetkovic.com/api/leads';

function attribution(): { utm?: Record<string, string>; referrer?: string } {
  try {
    return JSON.parse(localStorage.getItem('sp_lead_attribution') || '{}') || {};
  } catch {
    return {};
  }
}

function fieldsOf(form: HTMLFormElement): Record<string, string> {
  const data: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value !== 'string' || !value.trim()) return;
    data[key] = key in data ? `${data[key]}, ${value.trim()}` : value.trim();
  });
  return data;
}

function showError(form: HTMLFormElement, text: string) {
  const box = form.querySelector<HTMLElement>('[data-lead-error]');
  if (!box) return;
  box.textContent = text;
  box.hidden = false;
}

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-lead-form]')) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const label = button?.textContent ?? '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending…';
    }

    const source = attribution();
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        // text/plain keeps this a simple request, with no CORS preflight.
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          site_key: business.leadsSiteKey,
          form: form.dataset.leadForm,
          page_url: location.href.split('#')[0],
          referrer: source.referrer || '',
          utm: source.utm || {},
          data: fieldsOf(form),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || String(response.status));

      try {
        sessionStorage.setItem('sf_lead_sent', form.dataset.leadForm || 'form');
      } catch {
        // Storage blocked: the thank-you page simply skips its conversion event.
      }
      location.href = '/thank-you/';
    } catch (error) {
      const tooMany = error instanceof Error && error.message === 'rate_limited';
      showError(
        form,
        tooMany
          ? `Too many requests in a short time. Please wait a few minutes and try again.`
          : `Something went wrong sending your request. Please try again in a moment.`,
      );
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  });
}
