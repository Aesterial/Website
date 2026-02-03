"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import {
  ChevronDown,
  Clock,
  Globe,
  Lightbulb,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Moon,
  PanelLeft,
  Settings,
  Shield,
  Sun,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { Logo } from "./logo";
import { useTheme } from "./theme-provider";
import {
  CITY_STORAGE_KEY,
  cities,
  emitCityChange,
  getStoredCity,
  type City,
} from "@/lib/cities";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

export { cities, type City } from "@/lib/cities";

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const resolveAvatarSrc = (
  avatar?: { url?: string; contentType?: string; data?: string } | null,
) => {
  if (!avatar) return "";
  if (avatar.url) return avatar.url;
  if (avatar.contentType && avatar.data) {
    return `data:${avatar.contentType};base64,${avatar.data}`;
  }
  return "";
};

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, status, hasAdminAccess, logout } = useAuth();

  const [langOpen, setLangOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCityOpen, setMobileCityOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [city, setCity] = useState<City>(cities[0]);

  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const lastScrollY = useRef(0);
  const { scrollY } = useScroll();

  const cityRef = useRef<HTMLDivElement>(null);

  const displayName = user?.displayName || user?.username || "";
  const avatarLabel = getInitials(displayName || user?.username || "User");
  const avatarSrc = resolveAvatarSrc(user?.avatar);

  const handleLogout = async () => {
    await logout();
  };

  const languages = [
    { code: "RU" as const, label: "RU" },
    { code: "EN" as const, label: "EN" },
    { code: "KZ" as const, label: "KZ" },
  ];

  const mobileNavItems = [
    { href: "/voting", label: t("voting"), icon: Users },
    { href: "/suggest", label: t("suggestIdea"), icon: Lightbulb },
    { href: "/support", label: t("askQuestion"), icon: MessageSquare },
    ...(status === "authenticated"
      ? [
          { href: "/support/history", label: t("supportHistory"), icon: Clock },
          { href: "/account", label: t("account"), icon: UserCircle },
        ]
      : [{ href: "/auth", label: t("login"), icon: LogIn }]),
    ...(hasAdminAccess
      ? [{ href: "/admin", label: t("adminPanel"), icon: Shield }]
      : []),
  ];

  useEffect(() => {
    setMounted(true);
    setCity(getStoredCity());
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    localStorage.setItem(CITY_STORAGE_KEY, city);
    emitCityChange(city);
  }, [city, mounted]);

  useEffect(() => {
    if (mobileMenuOpen) {
      setLangOpen(false);
      setCityOpen(false);
    } else {
      setMobileCityOpen(false);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!cityOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(event.target as Node))
        setCityOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCityOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [cityOpen]);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = lastScrollY.current;
    const goingDown = y > prev;

    const nextCompact = y > 12;
    if (nextCompact !== headerCompact) setHeaderCompact(nextCompact);

    if (y < 10) {
      if (headerHidden) setHeaderHidden(false);
      lastScrollY.current = y;
      return;
    }

    if (goingDown && y > 96) {
      if (!headerHidden) setHeaderHidden(true);
    } else if (!goingDown) {
      if (headerHidden) setHeaderHidden(false);
    }

    lastScrollY.current = y;
  });

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
      style={{ top: "var(--maintenance-banner-height)" }}
      initial={{ y: -100 }}
      animate={{ y: headerHidden ? -96 : 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div
        className={`container mx-auto px-4 sm:px-6 flex items-center justify-between ${
          headerCompact ? "py-2 sm:py-2.5" : "py-2.5 sm:py-3"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="xl:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <motion.button
                  className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  aria-label="Открыть меню"
                >
                  <span className="absolute inset-0 rounded-full bg-gradient-to-br from-foreground/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <PanelLeft className="relative h-5 w-5" />
                </motion.button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="shadow-none w-[88vw] max-w-[420px] border-r border-border bg-background/95 p-0 backdrop-blur-xl sm:max-w-[420px] [&>button]:hidden"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Меню</SheetTitle>
                  <SheetDescription>Навигация по разделам</SheetDescription>
                </SheetHeader>

                <div className="relative flex h-full flex-col overflow-hidden">
                  <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-foreground/5 blur-3xl" />
                  <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-44 translate-x-1/3 translate-y-1/3 rounded-full bg-foreground/5 blur-3xl" />

                  <div className="relative z-10 flex items-center justify-between px-5 pt-5">
                    <div className="flex items-center gap-3">
                      <Logo className="h-9 w-9" showText={false} />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                          Меню
                        </p>
                        <p className="text-sm font-semibold">
                          {t("cityOfIdeas")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={toggleTheme}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted/60 transition"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Toggle theme"
                      >
                        {mounted ? (
                          theme === "light" ? (
                            <Moon className="h-4 w-4" />
                          ) : (
                            <Sun className="h-4 w-4" />
                          )
                        ) : (
                          <span className="block h-4 w-4" aria-hidden="true" />
                        )}
                      </motion.button>

                      <SheetClose asChild>
                        <motion.button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted/60 transition"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Закрыть меню"
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                      </SheetClose>
                    </div>
                  </div>

                  <motion.div
                    className="mt-5 flex-1 overflow-y-auto px-5 pb-7"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <div className="flex flex-col gap-5">
                      <div className="rounded-2xl border border-border bg-card/60 p-4">
                        <button
                          type="button"
                          onClick={() => setMobileCityOpen((open) => !open)}
                          className="flex w-full items-center justify-between gap-3"
                          aria-expanded={mobileCityOpen}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                              <MapPin className="h-5 w-5" />
                            </span>
                            <span className="flex flex-col text-left leading-tight min-w-0">
                              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                                Город
                              </span>
                              <span className="text-sm font-semibold truncate">
                                {city}
                              </span>
                            </span>
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${
                              mobileCityOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {mobileCityOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {cities.map((cityName) => {
                                  const isActive = cityName === city;
                                  return (
                                    <button
                                      key={cityName}
                                      onClick={() => {
                                        setCity(cityName);
                                        setMobileCityOpen(false);
                                      }}
                                      className={`min-w-0 break-words whitespace-normal rounded-xl px-3 py-2 text-xs font-medium transition ${
                                        isActive
                                          ? "bg-foreground text-background"
                                          : "bg-muted/60 text-foreground/80 hover:bg-foreground hover:text-background"
                                      }`}
                                    >
                                      {cityName}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid gap-3">
                        {mobileNavItems.map((item) => (
                          <SheetClose asChild key={item.href}>
                            <Link
                              href={item.href}
                              className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 px-4 py-3 transition hover:bg-muted/60"
                            >
                              <span className="relative flex items-center gap-4">
                                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                                  <item.icon className="h-5 w-5" />
                                </span>
                                <span className="text-base font-semibold">
                                  {item.label}
                                </span>
                              </span>
                            </Link>
                          </SheetClose>
                        ))}
                      </div>
                      {status === "authenticated" ? (
                        <SheetClose asChild>
                          <button
                            type="button"
                            onClick={() => void handleLogout()}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 px-4 py-3 text-left transition hover:bg-muted/60"
                          >
                            <span className="relative flex items-center gap-4">
                              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground">
                                <LogOut className="h-5 w-5" />
                              </span>
                              <span className="text-base font-semibold">
                                {t("logout")}
                              </span>
                            </span>
                          </button>
                        </SheetClose>
                      ) : null}

                      <div className="rounded-2xl border border-border bg-card/60 p-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                          Язык
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {languages.map((lang) => {
                            const isActive = language === lang.code;
                            return (
                              <button
                                key={lang.code}
                                onClick={() => setLanguage(lang.code)}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  isActive
                                    ? "bg-foreground text-background"
                                    : "bg-muted/60 text-foreground/70 hover:bg-foreground hover:text-background"
                                }`}
                              >
                                {lang.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link href="/" className="shrink-0">
            <Logo
              className={headerCompact ? "h-7 w-7" : "h-8 w-8"}
              showText={true}
            />
          </Link>
        </div>

        <nav className="hidden xl:flex flex-1 items-center justify-between gap-4 ml-6 min-w-0">
          <div className="flex items-center gap-1 2xl:gap-2 min-w-0">
            <Link
              href="/voting"
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 transition"
            >
              {t("voting")}
            </Link>
            <Link
              href="/suggest"
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 transition"
            >
              {t("suggestIdea")}
            </Link>
            <Link
              href="/support"
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 transition"
            >
              {t("askQuestion")}
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative" ref={cityRef}>
              <motion.button
                onClick={() =>
                  setCityOpen((open) => {
                    const next = !open;
                    if (next) setLangOpen(false);
                    return next;
                  })
                }
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/60 transition"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                aria-expanded={cityOpen}
                aria-haspopup="listbox"
              >
                <MapPin className="h-4 w-4" />
                <span className="max-w-[140px] truncate">{city}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${cityOpen ? "rotate-180" : ""}`}
                />
              </motion.button>

              <AnimatePresence>
                {cityOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    role="listbox"
                    aria-label="Выбор города"
                    className="absolute top-full right-0 mt-3 w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-border bg-background/95 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                          Выбор города
                        </p>
                        <p className="text-sm font-semibold">
                          Где вы хотите участвовать?
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-2">
                      {cities.map((cityName) => {
                        const isActive = cityName === city;
                        return (
                          <motion.button
                            key={cityName}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setCity(cityName);
                              setCityOpen(false);
                            }}
                            className={`min-w-0 rounded-xl px-2 py-2 text-xs font-medium leading-tight transition ${
                              isActive
                                ? "bg-foreground text-background"
                                : "bg-muted/60 text-foreground/80 hover:bg-foreground hover:text-background"
                            }`}
                            role="option"
                            aria-selected={isActive}
                          >
                            <span className="block break-words">
                              {cityName}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <motion.button
                onClick={() =>
                  setLangOpen((open) => {
                    const next = !open;
                    if (next) setCityOpen(false);
                    return next;
                  })
                }
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/60 transition"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                aria-expanded={langOpen}
              >
                <Globe className="h-4 w-4" />
                <span>{language}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`}
                />
              </motion.button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="absolute top-full right-0 mt-2 overflow-hidden rounded-xl border border-border bg-background min-w-[92px]"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setLangOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-medium transition ${
                          language === lang.code
                            ? "bg-foreground text-background"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted/60 transition"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )
              ) : (
                <span className="block h-4 w-4" aria-hidden="true" />
              )}
            </motion.button>

            {status === "authenticated" && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    className="flex items-center gap-3 rounded-full border border-border bg-background px-3 py-2 hover:bg-muted/60 transition min-w-0"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label="Account menu"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {avatarSrc ? (
                        <AvatarImage
                          src={avatarSrc}
                          alt={displayName || user.username}
                        />
                      ) : null}
                      <AvatarFallback className="text-xs font-semibold">
                        {avatarLabel}
                      </AvatarFallback>
                    </Avatar>

                    <span className="text-sm font-semibold max-w-[180px] truncate">
                      {displayName || user.username}
                    </span>

                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </motion.button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56 shadow-none">
                  <DropdownMenuLabel className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("account")}
                    </p>
                    <p className="text-sm font-semibold">
                      {displayName || user.username}
                    </p>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild>
                    <Link href="/account" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t("accountSettings")}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link
                      href="/support/history"
                      className="flex items-center gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      {t("supportHistory")}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleLogout();
                    }}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>

                  {hasAdminAccess ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t("adminPanel")}
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : status === "loading" ? (
              <div className="h-10 w-24 rounded-full bg-muted/80 animate-pulse" />
            ) : (
              <Link href="/auth">
                <motion.button
                  className="rounded-full border border-border bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90 transition"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t("login")}
                </motion.button>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
