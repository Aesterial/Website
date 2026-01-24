"use client";

import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const copyByLanguage = {
  RU: {
    title: "Нет доступа к панели поддержки",
    description: "Пожалуйста, воспользуйтесь формой поддержки, если вам нужна помощь.",
    action: "Назад к форме",
  },
  EN: {
    title: "No access to support panel",
    description: "Use the support form if you need help.",
    action: "Back to form",
  },
  KZ: {
    title: "Қолдау панеліне қолжетімділік жоқ",
    description: "Көмек қажет болса, қолдау формасын қолданыңыз.",
    action: "Формаға оралу",
  },
} as const;


export default function SupportQueuePage() {
  const router = useRouter();
  const { status, hasAdminAccess } = useAuth();
  const { language } = useLanguage();
  const copy = copyByLanguage[language] ?? copyByLanguage.RU;

  useEffect(() => {
    if (status !== "loading" && hasAdminAccess) {
      router.replace("/admin/support");
    }
  }, [status, hasAdminAccess, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 px-4 sm:pt-28 sm:px-6">
          <div className="container mx-auto max-w-3xl">
            <div className="h-28 rounded-3xl bg-muted/70 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (hasAdminAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12 px-4 sm:pt-28 sm:px-6">
        <div className="container mx-auto max-w-3xl space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10">
            <ShieldAlert className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
          <Link
            href="/support"
            className="inline-flex rounded-full border border-border/70 px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
          >
            {copy.action}
          </Link>
        </div>
      </main>
    </div>
  );
}
