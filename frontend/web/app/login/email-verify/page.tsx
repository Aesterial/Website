"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { verifyEmail } from "@/lib/api";

export default function EmailVerifyPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoVerificationTriggered = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const runVerification = useCallback(
    async (verificationToken: string) => {
      const normalizedToken = verificationToken.trim();

      if (!normalizedToken) {
        setErrorMessage(t("emailVerifyTokenMissing"));
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await verifyEmail({ token: normalizedToken });
        router.replace("/");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : t("emailVerifyError"),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [router, t],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    const nextToken =
      hashParams.get("token") || searchParams.get("token") || "";
    const normalizedToken = nextToken.trim();
    if (autoVerificationTriggered.current) {
      return;
    }
    autoVerificationTriggered.current = true;
    void runVerification(normalizedToken);
  }, [runVerification]);

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
              {t("emailVerifyTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mb-8 sm:text-base">
              {t("emailVerifySubtitle")}
            </p>
          </motion.div>

          <div className="space-y-4 sm:space-y-5">
            {errorMessage ? (
              <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            {isSubmitting ? (
              <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : null}
          </div>

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
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Logo
              className="h-24 w-24 mx-auto mb-8 text-background"
              showText={false}
            />
          </motion.div>

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
