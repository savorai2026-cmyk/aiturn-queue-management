const skipKey = (businessCode: string) =>
  `featurn:billingSkip:${businessCode}`;

export function readBillingPromptSkipped(businessCode: string) {
  try {
    return sessionStorage.getItem(skipKey(businessCode)) === '1';
  } catch {
    return false;
  }
}

export function writeBillingPromptSkipped(businessCode: string) {
  try {
    sessionStorage.setItem(skipKey(businessCode), '1');
  } catch {
    /* ignore */
  }
}
