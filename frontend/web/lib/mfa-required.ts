export const MFA_REQUIRED_EVENT = "mfa-required";

export const emitMfaRequired = (detail?: { reason?: string }) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(MFA_REQUIRED_EVENT, { detail: detail ?? {} }),
  );
};
