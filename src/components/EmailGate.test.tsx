import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

import EmailGate, { hasSubscribed } from './EmailGate';

let root: Root | null = null;
let host: HTMLDivElement;
const onClose = vi.fn();
const onUnlock = vi.fn();

const render = (mode: 'download' | 'subscribe') => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<EmailGate open mode={mode} onClose={onClose} onUnlock={onUnlock} source="quiz_gate" primaryShoe="Brooks Ghost 18" />));
};
const type = (el: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const $ = <T extends Element>(sel: string) => host.querySelector(sel) as T;
const emailInput = () => $<HTMLInputElement>('input[type=email]');
const primary = () => host.querySelector('[data-testid=gate-primary]') as HTMLButtonElement;
const consentBox = () => $<HTMLInputElement>('input[type=checkbox]');

describe('PDF email gate (download mode): the report never depends on an email', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.invoke.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    onClose.mockReset();
    onUnlock.mockReset();
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
  });

  it('downloads straight away with no email: nothing is asked and nothing is sent', async () => {
    render('download');
    expect(primary().textContent).toMatch(/download my pdf report/i);
    act(() => primary().click());
    await settle();
    expect(onUnlock).toHaveBeenCalledWith(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(hasSubscribed()).toBe(false);
  });

  it('an email without the consent tick is not signed up and does not download until fixed', async () => {
    render('download');
    type(emailInput(), 'runner@example.com');
    expect(primary().textContent).toMatch(/download my pdf \+ send me the tips/i);
    act(() => primary().click());
    await settle();
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('email + consent signs up (single request, consent true) and then downloads', async () => {
    mocks.invoke.mockResolvedValue({ data: {}, error: null });
    render('download');
    type(emailInput(), 'Runner@Example.com');
    act(() => consentBox().click());
    act(() => primary().click());
    await settle();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const [fn, args] = mocks.invoke.mock.calls[0];
    expect(fn).toBe('brevo-subscribe');
    expect(args.body).toMatchObject({ email: 'runner@example.com', consent: true, source: 'quiz_gate', primaryShoe: 'Brooks Ghost 18' });
    expect(onUnlock).toHaveBeenCalledWith(true);
    expect(hasSubscribed()).toBe(true);
  });

  it('a failing sign-up still downloads the report (and says so)', async () => {
    mocks.invoke.mockResolvedValue({ data: { error: 'Email service not configured' }, error: null });
    render('download');
    type(emailInput(), 'runner@example.com');
    act(() => consentBox().click());
    act(() => primary().click());
    await settle();
    expect(onUnlock).toHaveBeenCalledWith(false);
    expect(String(mocks.toastError.mock.calls[0]?.[0])).toMatch(/downloading/i);
    expect(hasSubscribed()).toBe(false);
  });

  it('never claims the report is emailed (it is built in the browser), in either mode', () => {
    for (const mode of ['download', 'subscribe'] as const) {
      render(mode);
      const text = host.textContent ?? '';
      expect(text, mode).not.toMatch(/email me my (pdf|report)|report is on its way|pdf is on its way|straight to your inbox|email yourself/i);
      act(() => root?.unmount());
      host.remove();
      root = null;
    }
  });
});
