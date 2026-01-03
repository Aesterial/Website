"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Shield, User } from "lucide-react";
import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { GradientButton } from "@/components/gradient-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

export default function AccountPage() {
  const router = useRouter();
  const { user, status, updateDisplayName, updateAvatar } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const languageOptions = [
    { code: "RU" as const, label: "RU" },
    { code: "EN" as const, label: "EN" },
    { code: "KZ" as const, label: "KZ" },
  ];
  const maxAvatarSize = 2 * 1024 * 1024;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/auth");
    }
  }, [status, router]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  const handleAvatarSelect = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setAvatarError(null);
    setAvatarSuccess(null);

    if (!file.type.startsWith("image/")) {
      setAvatarError(t("accountAvatarErrorType"));
      event.target.value = "";
      return;
    }

    if (file.size > maxAvatarSize) {
      setAvatarError(t("accountAvatarErrorSize"));
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        setAvatarError(t("accountAvatarErrorRead"));
        return;
      }
      setAvatarPreview(result);
      const commaIndex = result.indexOf(",");
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : "";
      if (!base64) {
        setAvatarError(t("accountAvatarErrorRead"));
        return;
      }
      setIsAvatarSaving(true);
      try {
        await updateAvatar({ contentType: file.type, data: base64 });
        setAvatarSuccess(t("accountAvatarSuccess"));
        setAvatarPreview(null);
      } catch (err) {
        setAvatarError(
          err instanceof Error ? err.message : t("accountAvatarErrorRead"),
        );
        setAvatarPreview(null);
      } finally {
        setIsAvatarSaving(false);
      }
    };
    reader.onerror = () => {
      setAvatarError(t("accountAvatarErrorRead"));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user) {
      return;
    }

    const nextName = displayName.trim();
    if (!nextName) {
      setErrorMessage("Display name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayName(nextName);
      setSuccessMessage("Saved.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 px-4 sm:pt-28 sm:px-6">
          <div className="container mx-auto max-w-3xl">
            <div className="h-24 rounded-3xl bg-muted/70 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const nameForAvatar = user.displayName || user.username || "User";
  const initials = getInitials(nameForAvatar);
  const avatarSrc =
    avatarPreview ||
    (user.avatar?.contentType && user.avatar?.data
      ? `data:${user.avatar.contentType};base64,${user.avatar.data}`
      : null);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold mb-2 sm:text-4xl">
              {t("accountSettings")}
            </h1>
            <p className="text-muted-foreground">
              {t("accountSettingsSubtitle")}
            </p>
          </motion.div>

          <motion.div
            className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.35)]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-14 w-14">
                {avatarSrc ? (
                  <AvatarImage src={avatarSrc} alt={nameForAvatar} />
                ) : null}
                <AvatarFallback className="text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">
                  {user.displayName || user.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("userIdLabel")}: {user.uid}
                </p>
              </div>
              <div className="w-full sm:w-auto sm:ml-auto">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <GradientButton
                  type="button"
                  className="w-full justify-center sm:w-auto"
                  onClick={handleAvatarSelect}
                  disabled={isAvatarSaving}
                >
                  {isAvatarSaving
                    ? t("accountAvatarUploading")
                    : t("accountAvatarChange")}
                </GradientButton>
                {avatarError ? (
                  <p className="mt-2 text-xs text-destructive">{avatarError}</p>
                ) : null}
                {avatarSuccess ? (
                  <p className="mt-2 text-xs text-foreground">
                    {avatarSuccess}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  {t("usernameLabel")}: {user.username}
                </span>
              </div>
              {user.email ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>
                    {t("emailLabel")}: {user.email}
                  </span>
                </div>
              ) : null}
              {user.rank?.name ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>
                    {t("roleLabel")}: {user.rank.name}
                  </span>
                </div>
              ) : null}
            </div>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {t("displayNameLabel")}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("displayNamePlaceholder")}
                className="w-full bg-background border border-border rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all duration-300"
              />
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}
              {successMessage ? (
                <p className="text-sm text-foreground">{successMessage}</p>
              ) : null}
            </div>

            <div className="mt-5">
              <GradientButton
                type="submit"
                className="w-full justify-center sm:w-auto"
                disabled={isSaving}
              >
                {isSaving ? t("saving") : t("saveChanges")}
              </GradientButton>
            </div>
          </motion.form>
        </div>
      </main>
    </div>
  );
}
