"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, RefreshCw, Sun } from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { useLanguage } from "@/components/language-provider";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { loadAuthChallenge } from "@/lib/auth-challenge";
import { resendAuthCode, type AuthChallenge } from "@/lib/api";

const resolveOtpLength = (challenge: AuthChallenge | null) => {
  const length = challenge?.length;
  if (typeof length === "number" && Number.isFinite(length) && length > 0) {
    return Math.min(Math.max(length, 4), 10);
  }
  return 6;
};

export default function VerifyLoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setMounted(true);
    setChallenge(loadAuthChallenge());
  }, []);

  const otpLength = useMemo(
    () => resolveOtpLength(challenge),
    [challenge?.length],
  );
  const isEmail = challenge?.type === "email";
  const subtitle = !challenge
    ? t("authCodeMissing")
    : isEmail
      ? t("authCodeSubtitleEmail")
      : t("authCodeSubtitleTotp");

  const handleResend = async () => {
    if (!challenge) {
      setErrorMessage(t("authCodeMissing"));
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    setIsResending(true);
    try {
      await resendAuthCode(challenge);
      setInfoMessage(t("authCodeResent"));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("authCodeError"));
    } finally {
      setIsResending(false);
    }
  };

  const codeSlots = useMemo(
    () => Array.from({ length: otpLength }, (_, index) => index),
    [otpLength],
  );

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center p-6 relative sm:p-8">
        <motion.button
          onClick={toggleTheme}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground shadow-lg shadow-foreground/10 backdrop-blur transition-shadow duration-300 hover:shadow-foreground/20 sm:right-8 sm:top-8 sm:h-11 sm:w-11"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Toggle theme"
        >
          {mounted ? (
            theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )
          ) : (
            <span className="block h-5 w-5" aria-hidden="true" />
          )}
        </motion.button>

        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="mb-8 sm:mb-12"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link href="/">
              <Logo className="h-12 w-12 sm:h-16 sm:w-16" showText={false} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h1 className="text-3xl font-bold mb-3 sm:text-4xl">
              {t("authCodeTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mb-8 sm:text-base">
              {subtitle}
            </p>
          </motion.div>

          {challenge?.destination ? (
            <div className="mb-6 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
              {t("authCodeEmailSentTo")}{" "}
              <span className="font-semibold">{challenge.destination}</span>
            </div>
          ) : null}

          {!challenge ? (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {t("authCodeMissing")}
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {errorMessage ? (
                <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}
              {infoMessage ? (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
                  {infoMessage}
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("authCodeInputLabel")}
                </label>
                <InputOTP
                  maxLength={otpLength}
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

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="pt-2 sm:pt-4"
              >
                <GradientButton
                  type="button"
                  className="w-full"
                  onClick={() => router.push("/")}
                >
                  {t("authCodeReturnToSite")}
                </GradientButton>
              </motion.div>

              {isEmail ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    disabled={isResending}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`}
                    />
                    {t("authCodeResend")}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="font-semibold text-foreground hover:opacity-80 transition-opacity"
            >
              {t("authCodeBack")}
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div
        className="hidden lg:flex flex-1 bg-foreground items-center justify-center relative overflow-hidden"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 border border-background rounded-full" />
          <div className="absolute bottom-20 right-20 w-96 h-96 border border-background rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-background rounded-full" />
        </div>

        <div className="relative z-10 text-center text-background px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key="verify-hero"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Logo
                className="h-24 w-24 mx-auto mb-8 text-background"
                showText={false}
              />
            </motion.div>
          </AnimatePresence>

          <motion.h2
            className="text-3xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            {t("cityOfIdeas")}
          </motion.h2>

          <motion.p
            className="text-lg opacity-80 max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            {t("heroSubtitle")}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
