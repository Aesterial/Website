"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  HelpCircle,
  Mail,
  MessageSquare,
  ShieldCheck,
  User,
} from "lucide-react";
import { Header } from "@/components/header";
import { GradientButton } from "@/components/gradient-button";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { createTicket } from "@/lib/api";

type SupportCategoryId =
  | "account_access"
  | "project_request"
  | "technical_issue"
  | "other";

type SupportFormState = {
  name: string;
  email: string;
  subject: string;
  category: SupportCategoryId;
  message: string;
};

type SupportFormErrors = Partial<Record<keyof SupportFormState, string>>;

const copyByLanguage = {
  RU: {
    title: "Задать вопрос",
    subtitle:
      "Заполните форму — наша служба поддержки свяжется с вами и поможет разобраться.",
    nameLabel: "Имя",
    namePlaceholder: "Как к вам обращаться",
    emailLabel: "Email",
    categoryLabel: "Категория",
    subjectLabel: "Тема обращения",
    subjectPlaceholder: "Коротко о проблеме",
    messageLabel: "Сообщение",
    messagePlaceholder: "Опишите ситуацию и добавьте важные детали",
    submitSending: "Отправка...",
    submitAction: "Отправить запрос",
    errorEmail: "Пожалуйста, укажите контактный email.",
    errorSubject: "Пожалуйста, добавьте тему обращения.",
    errorMessage: "Пожалуйста, опишите проблему подробнее.",
    submitError: "Не удалось отправить запрос. Попробуйте ещё раз.",
    nextTitle: "Что дальше?",
    nextBody:
      "После отправки запрос попадает в очередь поддержки. Специалист возьмёт его в работу и свяжется с вами.",
    nextNote:
      "Если в течение 48 часов не будет новых сообщений, запрос закроется автоматически.",
    historyTitle: "История обращений",
    historyBodyAuthed:
      "Отслеживайте статус запроса и продолжайте переписку с поддержкой.",
    historyBodyGuest: "Войдите, чтобы увидеть ваши обращения и сообщения.",
    historyLinkAuthed: "Перейти к истории",
    historyLinkGuest: "Войти",
    adminTitle: "Панель поддержки",
    adminBody:
      "У вас есть доступ к обращениям. Откройте список и выберите нужное.",
    adminLink: "Перейти в поддержку",
    categories: {
      accountAccess: "Аккаунт и доступ",
      projectRequest: "Проект или запрос",
      technicalIssue: "Техническая проблема",
      other: "Другое",
    },
  },

  EN: {
    title: "Ask a question",
    subtitle: "Fill out the form — our support team will contact you and help.",
    nameLabel: "Name",
    namePlaceholder: "How should we address you",
    emailLabel: "Email",
    categoryLabel: "Category",
    subjectLabel: "Subject",
    subjectPlaceholder: "Short summary of the issue",
    messageLabel: "Message",
    messagePlaceholder: "Describe the situation and include important details",
    submitSending: "Sending...",
    submitAction: "Submit request",
    errorEmail: "Please enter a contact email.",
    errorSubject: "Please add a subject.",
    errorMessage: "Please describe the issue in more detail.",
    submitError: "Failed to send the request. Please try again.",
    nextTitle: "What happens next?",
    nextBody:
      "After you submit, the request goes into the support queue. A specialist will take it and contact you.",
    nextNote:
      "If there are no new messages for 48 hours, the request will close automatically.",
    historyTitle: "Support history",
    historyBodyAuthed:
      "Track request status and continue the conversation with support.",
    historyBodyGuest: "Sign in to view your requests and messages.",
    historyLinkAuthed: "Go to history",
    historyLinkGuest: "Sign in",
    adminTitle: "Support panel",
    adminBody: "You have access to requests. Open the list and pick one.",
    adminLink: "Go to support",
    categories: {
      accountAccess: "Account & access",
      projectRequest: "Project or request",
      technicalIssue: "Technical issue",
      other: "Other",
    },
  },

  KZ: {
    title: "Сұрақ қою",
    subtitle:
      "Форманы толтырыңыз — қолдау қызметі сізбен байланысып, көмектеседі.",
    nameLabel: "Аты",
    namePlaceholder: "Сізге қалай жүгінейік",
    emailLabel: "Email",
    categoryLabel: "Санат",
    subjectLabel: "Өтініш тақырыбы",
    subjectPlaceholder: "Мәселені қысқаша сипаттаңыз",
    messageLabel: "Хабарлама",
    messagePlaceholder: "Жағдайды сипаттап, маңызды мәліметтерді қосыңыз",
    submitSending: "Жіберілуде...",
    submitAction: "Өтініш жіберу",
    errorEmail: "Байланыс email енгізіңіз.",
    errorSubject: "Өтініш тақырыбын қосыңыз.",
    errorMessage: "Мәселені толығырақ сипаттаңыз.",
    submitError: "Өтініш жіберілмеді. Қайталап көріңіз.",
    nextTitle: "Одан әрі не болады?",
    nextBody:
      "Жібергеннен кейін өтініш қолдау кезегіне түседі. Маман қарап, сізбен байланысады.",
    nextNote:
      "48 сағат ішінде жаңа хабарламалар болмаса, өтініш автоматты түрде жабылады.",
    historyTitle: "Қолдау тарихы",
    historyBodyAuthed:
      "Өтініш күйін қадағалап, қолдаумен хат алмасуды жалғастырыңыз.",
    historyBodyGuest: "Өтініштер мен хабарламаларды көру үшін кіріңіз.",
    historyLinkAuthed: "Тарихқа өту",
    historyLinkGuest: "Кіру",
    adminTitle: "Қолдау панелі",
    adminBody:
      "Сізде өтініштерге қолжетімділік бар. Тізімді ашып, керегін таңдаңыз.",
    adminLink: "Қолдауға өту",
    categories: {
      accountAccess: "Аккаунт және қолжетімділік",
      projectRequest: "Жоба немесе сұраныс",
      technicalIssue: "Техникалық мәселе",
      other: "Басқа",
    },
  },
} as const;


type SupportCopy = (typeof copyByLanguage)["RU"];

const categoryKeyById = {
  account_access: "accountAccess",
  project_request: "projectRequest",
  technical_issue: "technicalIssue",
  other: "other",
} as const;

const getCategoryLabel = (
  copy: SupportCopy,
  id: SupportCategoryId,
): string => copy.categories[categoryKeyById[id]];

const DEFAULT_CATEGORY: SupportCategoryId = "account_access";

export default function SupportPage() {
  const router = useRouter();
  const { user, hasAdminAccess } = useAuth();
  const { language } = useLanguage();
  const copy = copyByLanguage[language] ?? copyByLanguage.RU;
  const categoryOptions = [
    { id: "account_access", label: copy.categories.accountAccess },
    { id: "project_request", label: copy.categories.projectRequest },
    { id: "technical_issue", label: copy.categories.technicalIssue },
    { id: "other", label: copy.categories.other },
  ];
  const [formData, setFormData] = useState<SupportFormState>({
    name: "",
    email: "",
    subject: "",
    category: DEFAULT_CATEGORY,
    message: "",
  });
  const [errors, setErrors] = useState<SupportFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      name: prev.name || user.displayName || user.username || "",
      email: prev.email || user.email || "",
    }));
  }, [user]);

  const canManageSupport = hasAdminAccess;
  const canViewHistory = Boolean(user);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    const nextErrors: SupportFormErrors = {};

    if (!formData.email.trim()) {
      nextErrors.email = copy.errorEmail;
    }
    if (!formData.subject.trim()) {
      nextErrors.subject = copy.errorSubject;
    }
    if (!formData.message.trim()) {
      nextErrors.message = copy.errorMessage;
    }

    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const subject = formData.subject.trim();
      const message = formData.message.trim();
      const brief = [subject, message].filter(Boolean).join("\n\n");
      const id = await createTicket({
        name: formData.name.trim() || undefined,
        email: formData.email.trim(),
        topic: getCategoryLabel(copy, formData.category),
        brief,
      });
      router.push(`/support/${encodeURIComponent(id)}`);
    } catch (error) {
      setSubmitError(copy.submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
        <div className="container mx-auto max-w-5xl space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold sm:text-4xl">{copy.title}</h1>
            <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <motion.form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.35)]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <div className="grid gap-5">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <User className="inline h-4 w-4 mr-2" />
                    {copy.nameLabel}
                  </label>
                  <input
                    value={formData.name}
                    onChange={(event) =>
                      setFormData({ ...formData, name: event.target.value })
                    }
                    placeholder={copy.namePlaceholder}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Mail className="inline h-4 w-4 mr-2" />
                    {copy.emailLabel}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData({ ...formData, email: event.target.value })
                    }
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  {errors.email ? (
                    <p className="mt-2 text-xs text-destructive">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <HelpCircle className="inline h-4 w-4 mr-2" />
                    {copy.categoryLabel}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        category: event.target.value as SupportCategoryId,
                      })
                    }
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <MessageSquare className="inline h-4 w-4 mr-2" />
                    {copy.subjectLabel}
                  </label>
                  <input
                    value={formData.subject}
                    onChange={(event) =>
                      setFormData({ ...formData, subject: event.target.value })
                    }
                    placeholder={copy.subjectPlaceholder}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  {errors.subject ? (
                    <p className="mt-2 text-xs text-destructive">
                      {errors.subject}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {copy.messageLabel}
                  </label>
                  <textarea
                    rows={5}
                    value={formData.message}
                    onChange={(event) =>
                      setFormData({ ...formData, message: event.target.value })
                    }
                    placeholder={copy.messagePlaceholder}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                  />
                  {errors.message ? (
                    <p className="mt-2 text-xs text-destructive">
                      {errors.message}
                    </p>
                  ) : null}
                </div>

                {submitError ? (
                  <p className="rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
                    {submitError}
                  </p>
                ) : null}

                <div className="pt-2">
                  <GradientButton
                    type="submit"
                    className="w-full justify-center sm:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? copy.submitSending : copy.submitAction}
                  </GradientButton>
                </div>
              </div>
            </motion.form>

            <motion.aside
              className="space-y-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                <p className="text-sm font-semibold">{copy.nextTitle}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {copy.nextBody}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {copy.nextNote}
                </p>
              </div>

              <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                <p className="text-sm font-semibold">{copy.historyTitle}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {canViewHistory
                    ? copy.historyBodyAuthed
                    : copy.historyBodyGuest}
                </p>
                <Link
                  href={canViewHistory ? "/support/history" : "/auth"}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  {canViewHistory
                    ? copy.historyLinkAuthed
                    : copy.historyLinkGuest}
                </Link>
              </div>

              {canManageSupport ? (
                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <p className="text-sm font-semibold">{copy.adminTitle}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {copy.adminBody}
                  </p>
                  <Link
                    href="/admin/support"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {copy.adminLink}
                  </Link>
                </div>
              ) : null}
            </motion.aside>
          </div>
        </div>
      </main>
    </div>
  );
}
