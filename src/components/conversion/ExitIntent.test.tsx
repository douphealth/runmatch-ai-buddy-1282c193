import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import ExitIntent, { EXIT_DISMISSED_KEY, EXIT_SESSION_KEY, popupSuppressed } from './ExitIntent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe = (props: Partial<React.ComponentProps<typeof ExitIntent>>) => (
  <ExitIntent minDwellMs={0} {...props}>
    {({ open, close }) => (
      <div>
        <span data-testid="state">{open ? 'open' : 'closed'}</span>
        <button onClick={close}>close</button>
      </div>
    )}
  </ExitIntent>
);

let root: Root | null = null;
let host: HTMLDivElement;
const render = (el: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
};
const state = () => host.querySelector('[data-testid=state]')!.textContent;

describe('email popup triggers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    vi.useRealTimers();
  });

  it('opens after the dwell time and only once per session', () => {
    render(<Probe dwellOpenMs={5000} />);
    expect(state()).toBe('closed');
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(state()).toBe('open');
    expect(sessionStorage.getItem(EXIT_SESSION_KEY)).toBe('1');
    expect(popupSuppressed()).toBe(true);
  });

  it('opens when the pointer leaves through the top of the window', () => {
    render(<Probe />);
    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent('mouseleave', { clientY: -3 }));
    });
    expect(state()).toBe('open');
  });

  it('ignores a pointer that leaves through the side or bottom', () => {
    render(<Probe />);
    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent('mouseleave', { clientY: 400 }));
    });
    expect(state()).toBe('closed');
  });

  it('never shows to someone who subscribed', () => {
    localStorage.setItem('gutf_subscribed_v1', JSON.stringify({ email: 'a@b.co', ts: Date.now() }));
    render(<Probe dwellOpenMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(state()).toBe('closed');
  });

  it('stays quiet for a week after a dismissal, then may show again', () => {
    localStorage.setItem(EXIT_DISMISSED_KEY, String(Date.now() - 2 * 24 * 3600 * 1000));
    expect(popupSuppressed()).toBe(true);
    localStorage.setItem(EXIT_DISMISSED_KEY, String(Date.now() - 8 * 24 * 3600 * 1000));
    expect(popupSuppressed()).toBe(false);
  });

  it('is off while another modal is open', () => {
    render(<Probe dwellOpenMs={1000} disabled />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(state()).toBe('closed');
  });

  it('records the dismissal when closed', () => {
    render(<Probe dwellOpenMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => {
      (host.querySelector('button') as HTMLButtonElement).click();
    });
    expect(Number(localStorage.getItem(EXIT_DISMISSED_KEY))).toBeGreaterThan(0);
  });
});
