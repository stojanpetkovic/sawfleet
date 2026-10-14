// Turns a form with data-steps into a guided, multi-step form. Without this
// script every step is visible and the form still works as one long form.
document.querySelectorAll<HTMLFormElement>("form[data-steps]").forEach((form) => {
  const steps = [...form.querySelectorAll<HTMLElement>("[data-step]")];
  if (steps.length < 2) return;
  const bar = form.querySelector<HTMLElement>("[data-progress]");
  const dots = [...(bar?.querySelectorAll<HTMLElement>("[data-dot]") ?? [])];
  const fill = bar?.querySelector<HTMLElement>("[data-fill]");
  let current = 0;

  const clearErrors = (scope: ParentNode) => {
    scope.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    scope.querySelectorAll("[data-field-error]").forEach((el) => el.remove());
  };

  const show = (i: number, focus = true) => {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, idx) => s.classList.toggle("is-current", idx === current));
    form.toggleAttribute("data-first", current === 0);
    form.toggleAttribute("data-last", current === steps.length - 1);
    dots.forEach((d, idx) => {
      d.classList.toggle("bg-primary-600", idx <= current);
      d.classList.toggle("text-white", idx <= current);
      d.classList.toggle("bg-secondary-100", idx > current);
      d.classList.toggle("text-secondary-500", idx > current);
      d.setAttribute("aria-current", idx === current ? "step" : "false");
      const label = d.parentElement?.querySelector("[data-label]");
      label?.classList.toggle("text-secondary-900", idx <= current);
      label?.classList.toggle("text-secondary-400", idx > current);
    });
    if (fill) fill.style.width = `${(current / (steps.length - 1)) * 100}%`;
    if (focus) {
      const target = steps[current].querySelector<HTMLElement>("input:not([type=hidden]):not(.hidden), select, textarea");
      const top = form.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: "smooth" });
      window.setTimeout(() => target?.focus({ preventScroll: true }), 350);
    }
  };

  const validate = (step: HTMLElement) => {
    clearErrors(step);
    let first: HTMLElement | null = null;
    step.querySelectorAll<HTMLInputElement>("input, select, textarea").forEach((el) => {
      if (el.type === "hidden" || el.checkValidity()) return;
      el.setAttribute("aria-invalid", "true");
      const msg = document.createElement("p");
      msg.className = "field-error";
      msg.dataset.fieldError = "";
      msg.textContent = el.validity.typeMismatch ? "Please enter a valid value." : "This field is required.";
      (el.closest("label, fieldset, div") ?? el).appendChild(msg);
      first ??= el;
    });
    (first as HTMLElement | null)?.focus();
    return !first;
  };

  form.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-next], [data-back]");
    if (!t) return;
    e.preventDefault();
    if (t.hasAttribute("data-next")) {
      if (validate(steps[current])) show(current + 1);
    } else {
      show(current - 1);
    }
  });

  // Enter moves to the next step instead of submitting early.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || current === steps.length - 1) return;
    const el = e.target as HTMLElement;
    if (el.tagName === "TEXTAREA" || el.tagName === "BUTTON") return;
    e.preventDefault();
    if (validate(steps[current])) show(current + 1);
  });

  form.addEventListener("input", (e) => {
    const el = e.target as HTMLElement;
    if (el.getAttribute("aria-invalid")) {
      el.removeAttribute("aria-invalid");
      el.parentElement?.querySelector("[data-field-error]")?.remove();
    }
  });

  show(0, false);
});
