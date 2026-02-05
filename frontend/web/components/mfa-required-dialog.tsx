"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { checkMfaCode, MfaRequiredError } from "@/lib/api";
import { MFA_REQUIRED_EVENT } from "@/lib/mfa-required";

const OTP_LENGTH = 6;

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const resolveAvatarSrc = (
  avatar?: { url?: string; contentType?: string; data?: string } | null,
) => {
  if (!avatar) {
    return "";
  }
  if (avatar.url) {
    return avatar.url;
  }
  if (avatar.contentType && avatar.data) {
    return `data:${avatar.contentType};base64,${avatar.data}`;
  }
  return "";
};

export function MfaRequiredDialog() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleRequired = () => {
      setErrorMessage(null);
      setCode("");
      setOpen(true);
    };
    window.addEventListener(MFA_REQUIRED_EVENT, handleRequired);
    return () => window.removeEventListener(MFA_REQUIRED_EVENT, handleRequired);
  }, []);

  const codeSlots = useMemo(
    () => Array.from({ length: OTP_LENGTH }, (_, index) => index),
    [],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (code.trim().length < OTP_LENGTH) {
      setErrorMessage(t("authCodeError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await checkMfaCode({ code });
      setOpen(false);
      setCode("");
      await refreshUser({ silent: true });
    } catch (err) {
      if (err instanceof MfaRequiredError) {
        setErrorMessage(t("authCodeError"));
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : t("authCodeError"),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = user?.displayName || user?.username || "";
  const avatarLabel = getInitials(displayName || user?.username || "User");
  const avatarSrc = resolveAvatarSrc(user?.avatar);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          setOpen(nextOpen);
        }
      }}
    >
      <DialogContent
        className="w-full max-w-md rounded-3xl border-border/70 bg-card/95 p-6 shadow-2xl"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="text-2xl">{t("authCodeTitle")}</DialogTitle>
          <DialogDescription>{t("authCodeSubtitleTotp")}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            {avatarSrc || displayName ? (
              <Avatar className="h-12 w-12">
                {avatarSrc ? (
                  <AvatarImage src={avatarSrc} alt={displayName} />
                ) : null}
                <AvatarFallback className="text-sm font-semibold">
                  {avatarLabel}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Shield className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {displayName || t("account")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("authCodeInputLabel")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium mb-2">
              {t("authCodeInputLabel")}
            </label>
            <InputOTP
              maxLength={OTP_LENGTH}
              value={code}
              onChange={setCode}
              inputMode="numeric"
              autoFocus
            >
              <InputOTPGroup className="gap-2">
                {codeSlots.map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <GradientButton
            type="submit"
            className="w-full flex items-center justify-center gap-3"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Loading..." : t("authCodeSubmit")}
          </GradientButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
