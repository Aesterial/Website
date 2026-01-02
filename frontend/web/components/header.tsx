"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronDown,
  Globe,
  Lightbulb,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Shield,
  Sun,
  UserCircle,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "./auth-provider"
import { useLanguage } from "./language-provider"
import { Logo } from "./logo"
import { useTheme } from "./theme-provider"
import { Avatar, AvatarFallback } from "./ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet"

const cities = [
  "Барнаул",
  "Бийск",
  "Рубцовск",
  "Котельниково",
  "Ленинск-Кузнецкий",
  "Полысаево",
  "Прокопьевск",
  "Мыски",
  "Бородино",
  "Назарово",
  "Шарыпово",
  "Ковдор",
  "Кингисепп",
  "Березники",
  "Абакан",
  "Черногорск",
  "Рефтинский",
  "Чегдомын",
] as const

type City = (typeof cities)[number]

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return "U"
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { user, status, hasAdminAccess, logout } = useAuth()
  const [langOpen, setLangOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileCityOpen, setMobileCityOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [city, setCity] = useState<City>(cities[0])
  const cityRef = useRef<HTMLDivElement>(null)
  const displayName = user?.displayName || user?.username || ""
  const avatarLabel = getInitials(displayName || user?.username || "User")

  const handleLogout = async () => {
    await logout()
  }

  const languages = [
    { code: "RU" as const, label: "RU" },
    { code: "EN" as const, label: "EN" },
    { code: "KZ" as const, label: "KZ" },
  ]

  const mobileNavItems = [
    { href: "/voting", label: t("voting"), icon: Users },
    { href: "/suggest", label: t("suggestIdea"), icon: Lightbulb },
    { href: "/support", label: t("askQuestion"), icon: MessageSquare },
    ...(status === "authenticated"
      ? [{ href: "/account", label: t("account"), icon: UserCircle }]
      : [{ href: "/auth", label: t("login"), icon: LogIn }]),
    ...(hasAdminAccess ? [{ href: "/admin", label: "Admin panel", icon: Shield }] : []),
  ]

  useEffect(() => {
    setMounted(true)
    const savedCity = localStorage.getItem("city")
    if (savedCity && cities.includes(savedCity as City)) {
      setCity(savedCity as City)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("city", city)
    }
  }, [city, mounted])

  useEffect(() => {
    if (mobileMenuOpen) {
      setLangOpen(false)
      setCityOpen(false)
    } else {
      setMobileCityOpen(false)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!cityOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
        setCityOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCityOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [cityOpen])

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <motion.button
                  className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg shadow-foreground/10 backdrop-blur"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  aria-label="Открыть меню"
                >
                  <span className="absolute inset-0 rounded-full bg-gradient-to-br from-foreground/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <Menu className="relative h-5 w-5" />
                </motion.button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[88vw] max-w-[420px] border-r border-border/60 bg-background/95 p-0 backdrop-blur-xl sm:max-w-[420px] [&>button]:hidden"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Меню</SheetTitle>
                  <SheetDescription>Навигация по разделам</SheetDescription>
                </SheetHeader>
                <div className="relative flex h-full flex-col overflow-hidden">
                  <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-foreground/10 blur-3xl" />
                  <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-44 translate-x-1/3 translate-y-1/3 rounded-full bg-foreground/5 blur-3xl" />

                  <div className="relative z-10 flex items-center justify-between px-6 pt-6">
                    <div className="flex items-center gap-3">
                      <Logo className="h-9 w-9" showText={false} />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Меню</p>
                        <p className="text-base font-semibold">{t("cityOfIdeas")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={toggleTheme}
                        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground transition-shadow duration-300 hover:shadow-lg hover:shadow-foreground/15"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Toggle theme"
                      >
                        {mounted ? (
                          theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />
                        ) : (
                          <span className="block h-5 w-5" aria-hidden="true" />
                        )}
                      </motion.button>
                      <SheetClose asChild>
                        <motion.button
                          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground transition-shadow duration-300 hover:shadow-lg hover:shadow-foreground/15"
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
                    className="mt-6 flex-1 overflow-y-auto px-6 pb-8"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <div className="flex flex-col gap-5">
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <button
                          type="button"
                          onClick={() => setMobileCityOpen((open) => !open)}
                          className="flex w-full items-center justify-between gap-3"
                          aria-expanded={mobileCityOpen}
                        >
                          <span className="flex items-center gap-3">
                            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background shadow-lg shadow-foreground/30">
                              <MapPin className="h-5 w-5" />
                            </span>
                            <span className="flex flex-col text-left leading-tight">
                              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Город</span>
                              <span className="text-sm font-semibold">{city}</span>
                            </span>
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${mobileCityOpen ? "rotate-180" : ""}`}
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
                                  const isActive = cityName === city
                                  return (
                                    <button
                                      key={cityName}
                                      onClick={() => {
                                        setCity(cityName)
                                        setMobileCityOpen(false)
                                      }}
                                      className={`min-w-0 break-words whitespace-normal rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-200 ${
                                        isActive
                                          ? "bg-foreground text-background shadow-md shadow-foreground/20"
                                          : "bg-muted/60 text-foreground/80 hover:bg-foreground hover:text-background"
                                      }`}
                                    >
                                      {cityName}
                                    </button>
                                  )
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
                              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-card sm:py-4"
                            >
                              <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 before:absolute before:inset-0 before:bg-[radial-gradient(260px_circle_at_12%_20%,_rgba(0,0,0,0.12),_transparent_55%)] dark:before:bg-[radial-gradient(260px_circle_at_12%_20%,_rgba(255,255,255,0.22),_transparent_55%)]" />
                              <span className="relative flex items-center gap-4">
                                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background shadow-lg shadow-foreground/25">
                                  <item.icon className="h-5 w-5" />
                                </span>
                                <span className="text-base font-semibold">{item.label}</span>
                              </span>
                            </Link>
                          </SheetClose>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Язык</p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {languages.map((lang) => {
                            const isActive = language === lang.code
                            return (
                              <button
                                key={lang.code}
                                onClick={() => setLanguage(lang.code)}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200 ${
                                  isActive
                                    ? "bg-foreground text-background shadow-md shadow-foreground/20"
                                    : "bg-muted/60 text-foreground/70 hover:bg-foreground hover:text-background"
                                }`}
                              >
                                {lang.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link href="/">
            <Logo className="h-8 w-8" showText={true} />
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-6">
          <Link href="/voting" className="text-foreground/70 hover:text-foreground transition-colors duration-300">
            {t("voting")}
          </Link>
          <Link href="/suggest" className="text-foreground/70 hover:text-foreground transition-colors duration-300">
            {t("suggestIdea")}
          </Link>
          <Link href="/support" className="text-foreground/70 hover:text-foreground transition-colors duration-300">{t("askQuestion")}</Link>

          <div className="relative" ref={cityRef}>
            <motion.button
              onClick={() =>
                setCityOpen((open) => {
                  const next = !open
                  if (next) {
                    setLangOpen(false)
                  }
                  return next
                })
              }
              className="group relative flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 shadow-lg shadow-foreground/20"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              aria-expanded={cityOpen}
              aria-haspopup="listbox"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-white/25 via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <MapPin className="relative h-4 w-4" />
              <span className="relative flex flex-col items-start leading-none">
                <span className="text-[10px] uppercase tracking-[0.2em] text-background/70">Город</span>
                <span className="text-sm font-semibold">{city}</span>
              </span>
              <ChevronDown
                className={`relative ml-1 h-3.5 w-3.5 transition-transform duration-200 ${cityOpen ? "rotate-180" : ""}`}
              />
            </motion.button>

            <AnimatePresence>
              {cityOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  role="listbox"
                  aria-label="Выбор города"
                  className="absolute top-full right-0 mt-3 w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-border/70 bg-background/90 p-4 shadow-2xl shadow-foreground/10 backdrop-blur-xl"
                >
                  <div className="relative">
                    <div className="absolute -top-8 right-6 h-20 w-20 rounded-full bg-foreground/10 blur-2xl" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-foreground/50">Выбор города</p>
                        <p className="text-sm font-semibold text-foreground">Где вы хотите участвовать?</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {cities.map((cityName) => {
                      const isActive = cityName === city
                      return (
                        <motion.button
                          key={cityName}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setCity(cityName)
                            setCityOpen(false)
                          }}
                          className={`min-w-0 break-words whitespace-normal rounded-xl px-2 py-2 text-center text-xs font-medium leading-tight transition-colors duration-200 ${
                            isActive
                              ? "bg-foreground text-background shadow-md shadow-foreground/20"
                              : "bg-muted/70 text-foreground/80 hover:bg-foreground hover:text-background"
                          }`}
                          role="option"
                          aria-selected={isActive}
                        >
                          {cityName}
                        </motion.button>
                      )
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
                  const next = !open
                  if (next) {
                    setCityOpen(false)
                  }
                  return next
                })
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm font-medium">{language}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`} />
            </motion.button>

            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full right-0 mt-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden min-w-[80px]"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code)
                        setLangOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                        language === lang.code ? "bg-foreground text-background" : "hover:bg-muted"
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
            className="p-2.5 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />
            ) : (
              <span className="block h-5 w-5" aria-hidden="true" />
            )}
          </motion.button>

          {status === "authenticated" && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  className="flex items-center gap-3 rounded-full border border-border/60 bg-card/80 px-4 py-2 shadow-lg shadow-foreground/10"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-semibold">{avatarLabel}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{displayName || user.username}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("account")}</p>
                  <p className="text-sm font-semibold">{displayName || user.username}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <Settings className="h-4 w-4" />
                    {t("accountSettings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    void handleLogout()
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
                {hasAdminAccess ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="h-4 w-4" />
                      Admin panel
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
                className="bg-foreground text-background px-6 py-2.5 rounded-full font-medium hover:opacity-80 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t("login")}
              </motion.button>
            </Link>
          )}
        </nav>
      </div>
    </motion.header>
  )
}
