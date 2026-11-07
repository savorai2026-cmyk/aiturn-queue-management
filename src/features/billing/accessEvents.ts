const EVENT_NAME = 'qgent:business-access-changed';

export function notifyBusinessAccessChanged(businessCode: string) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: businessCode }));
}

export function onBusinessAccessChanged(
  businessCode: string,
  listener: () => void,
): () => void {
  const handler = (event: Event) => {
    if ((event as CustomEvent<string>).detail === businessCode) listener();
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
