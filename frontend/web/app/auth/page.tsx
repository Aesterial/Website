"use client"

import type React from "react"

import { useAuth } from "@/components/auth-provider"
import { GradientButton } from "@/components/gradient-button"
import { useLanguage } from "@/components/language-provider"
import { Logo } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, Moon, Sun, User } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type AuthMode = "login" | "register" // | "forgot-password"

export default function AuthPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [mode, setMode] = useState<AuthMode>("login")
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()

  const passwordRules = [
    {
      id: "length",
      label: t("passwordRuleLength"),
      test: (value: string) => value.length >= 10,
    },
    {
      id: "lowercase",
      label: t("passwordRuleLowercase"),
      test: (value: string) => /[a-z]/.test(value),
    },
    {
      id: "uppercase",
      label: t("passwordRuleUppercase"),
      test: (value: string) => /[A-Z]/.test(value),
    },
    {
      id: "number",
      label: t("passwordRuleNumber"),
      test: (value: string) => /[0-9]/.test(value),
    },
    {
      id: "symbol",
      label: t("passwordRuleSymbol"),
      test: (value: string) => /[^A-Za-z0-9]/.test(value),
    },
  ]

  const passwordChecks = passwordRules.map((rule) => ({
    ...rule,
    passed: rule.test(formData.password),
  }))
  const passwordScore = passwordChecks.filter((rule) => rule.passed).length
  const passwordProgress = Math.round((passwordScore / passwordRules.length) * 100)
  const isPasswordStrong = passwordScore === passwordRules.length
  const passwordsMatch =
    formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setErrorMessage(null)
  }, [mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const email = formData.email.trim()
    const password = formData.password
    const name = formData.name.trim()

    if (mode === "register") {
      if (!name || !email || !password) {
        setErrorMessage("Please fill in all fields.")
        return
      }
      if (!isPasswordStrong) {
        setErrorMessage(t("passwordRequirementsError"))
        return
      }
      if (password !== formData.confirmPassword) {
        setErrorMessage("Passwords do not match.")
        return
      }
    } else if (!email || !password) {
      setErrorMessage("Please enter your email and password.")
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === "login") {
        await login({ usermail: email, password })
      } else {
        await register({ username: name, email, password })
      }
      router.push("/")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },


  }

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
            theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />
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
              {mode === "login" ? t("authorization") : t("registration")}
            </h1>
            <p className="text-sm text-muted-foreground mb-8 sm:text-base">
              {mode === "login" ? t("heroSubtitle") : t("heroSubtitle")}
            </p>
          </motion.div>


          <motion.div
            className="flex bg-muted rounded-2xl p-1 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as AuthMode)}
                className={`flex-1 py-3 rounded-xl font-medium transition-all duration-300 ${
                  mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? t("authorization") : t("registration")}
              </button>
            ))}
          </motion.div>

          <motion.div
            className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 mb-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Тестовый доступ</p>
            <div className="mt-2 text-sm font-semibold">
              <p>Логин: admin@admin.admin</p>
              <p>Пароль: admin</p>
            </div>
          </motion.div>


          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {errorMessage ? (
              <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="name"
                  variants={inputVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-sm font-medium mb-2">{t("name")}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("name")}
                      className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all duration-300 sm:py-4"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              variants={inputVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <label className="block text-sm font-medium mb-2">{t("email")}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all duration-300 sm:py-4"
                />
              </div>
            </motion.div>

            <motion.div
              variants={inputVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <label className="block text-sm font-medium mb-2">{t("password")}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all duration-300 sm:py-4"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="passwordChecklist"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4 sm:px-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      {t("passwordChecklistTitle")}
                    </p>
                    <span
                      className={`text-xs font-semibold ${
                        isPasswordStrong ? "text-emerald-500" : "text-muted-foreground"
                      }`}
                    >
                      {passwordScore}/{passwordRules.length}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full ${isPasswordStrong ? "bg-emerald-500" : "bg-foreground"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${passwordProgress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    {passwordChecks.map((rule) => (
                      <div key={rule.id} className="flex items-center gap-2 font-semibold">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            rule.passed
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : "border-border/70 text-muted-foreground"
                          }`}
                        >
                          {rule.passed ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className={rule.passed ? "text-foreground" : "text-muted-foreground"}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 font-semibold">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          passwordsMatch
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-border/70 text-muted-foreground"
                        }`}
                      >
                        {passwordsMatch ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className={passwordsMatch ? "text-foreground" : "text-muted-foreground"}>
                        {t("passwordRuleMatch")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="confirmPassword"
                  variants={inputVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-sm font-medium mb-2">{t("confirmPassword")}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all duration-300 sm:py-4"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="pt-2 sm:pt-4"
            >
              <GradientButton
                type="submit"
                className="w-full flex items-center justify-center gap-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Loading..." : mode === "login" ? t("login") : t("register")}
                <ArrowRight className="w-5 h-5" />
              </GradientButton>
            </motion.div>
          </form>


          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">или</span>
            <div className="flex-1 h-px bg-border" />
          </div>


          <motion.div
            className="space-y-2 sm:space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <button className="w-full bg-card border border-border rounded-2xl py-3 px-6 text-sm font-medium hover:bg-muted transition-colors duration-300 flex items-center justify-center gap-3 sm:py-4 sm:text-base">
              <svg
                width="230"
                height="28"
                viewBox="0 0 276 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full max-w-[230px] h-auto"
              >
<path d="M83.4343 29.7801C83.4343 33.4241 80.0416 36.0629 75.2667 36.0629H64.0835V13.4451H74.8897C79.539 13.4451 82.806 15.9582 82.806 19.4765C82.806 21.8639 81.5495 23.3718 79.6646 24.2514C81.6751 25.0053 83.4343 27.0157 83.4343 29.7801ZM68.984 17.5917V22.4922H74.7641C76.5233 22.4922 77.6542 21.487 77.6542 20.1048C77.6542 18.7226 76.3976 17.5917 74.7641 17.5917H68.984ZM75.2667 31.9163C77.1516 31.9163 78.5338 30.7854 78.5338 29.1519C78.5338 27.5184 77.2772 26.3875 75.2667 26.3875H68.984V31.9163H75.2667Z" fill="currentColor"/>
<path d="M101.905 35.9372L94.1148 27.0158H92.8582V35.9372H87.832V13.4451H92.8582V22.1152H94.1148L101.654 13.4451H107.56L98.1357 24.2514L108.439 35.9372H101.905Z" fill="currentColor"/>
<path d="M108.439 24.754C108.439 17.9686 113.466 13.0681 120.502 13.0681C127.539 13.0681 132.565 17.9686 132.565 24.754C132.565 31.5393 127.539 36.4398 120.502 36.4398C113.466 36.4398 108.439 31.5393 108.439 24.754ZM127.288 24.754C127.288 20.4817 124.523 17.5917 120.502 17.5917C116.481 17.5917 113.717 20.4817 113.717 24.754C113.717 29.0262 116.481 31.9163 120.502 31.9163C124.523 31.9163 127.288 29.0262 127.288 24.754Z" fill="currentColor"/>
<path d="M151.79 13.4451H156.817V35.9372H151.79V26.8901H141.738V35.9372H136.712V13.4451H141.738V22.3665H151.79V13.4451Z" fill="currentColor"/>
<path d="M167.623 35.9372V17.9686H159.832V13.4451H180.314V17.9686H172.523V35.9372H167.623Z" fill="currentColor"/>
<path d="M201.926 23.3718V35.9372H198.282L197.277 32.4189C196.146 34.3037 193.759 36.4398 190.115 36.4398C185.591 36.4398 182.324 33.4241 182.324 29.2775C182.324 25.1309 185.591 22.2409 192.251 22.2409H197.151C196.9 19.3508 195.392 17.3404 192.628 17.3404C190.366 17.3404 188.858 18.5969 188.104 19.9791L183.581 19.2252C184.712 15.3299 188.607 13.0681 192.879 13.0681C198.408 13.0681 201.926 16.8377 201.926 23.3718ZM197.026 26.1362H192.377C188.607 26.1362 187.35 27.3927 187.35 29.0262C187.35 30.911 188.858 32.1676 191.371 32.1676C194.638 32.1676 197.026 29.7802 197.026 26.1362Z" fill="currentColor"/>
<path d="M221.277 35.9372L213.487 27.0158H212.23V35.9372H207.204V13.4451H212.23V22.1152H213.487L221.026 13.4451H226.932L217.508 24.2514L227.811 35.9372H221.277Z" fill="currentColor"/>
<path d="M236.858 35.9372V17.9686H229.068V13.4451H249.55V17.9686H241.759V35.9372H236.858Z" fill="currentColor"/>
<path d="M274.68 26.1362H256.586C257.089 29.6545 259.602 31.9163 263.371 31.9163C266.01 31.9163 268.021 30.7854 269.152 29.1519L273.801 29.9058C272.167 34.1781 267.769 36.4398 262.994 36.4398C256.209 36.4398 251.309 31.5393 251.309 24.754C251.309 17.9686 256.209 13.0681 262.994 13.0681C269.78 13.0681 274.68 17.9686 274.68 24.5027C274.806 25.1309 274.68 25.6336 274.68 26.1362ZM256.963 22.2409H269.403C268.523 19.4765 266.261 17.466 263.12 17.466C260.104 17.3404 257.717 19.3508 256.963 22.2409Z" fill="currentColor"/>
<path d="M0 23.04C0 12.1788 0 6.74826 3.37413 3.37413C6.74826 0 12.1788 0 23.04 0H24.96C35.8212 0 41.2517 0 44.6259 3.37413C48 6.74826 48 12.1788 48 23.04V24.96C48 35.8212 48 41.2517 44.6259 44.6259C41.2517 48 35.8212 48 24.96 48H23.04C12.1788 48 6.74826 48 3.37413 44.6259C0 41.2517 0 35.8212 0 24.96V23.04Z" fill="#0077FF"/>
<path d="M25.54 34.5801C14.6 34.5801 8.3601 27.0801 8.1001 14.6001H13.5801C13.7601 23.7601 17.8 27.6401 21 28.4401V14.6001H26.1602V22.5001C29.3202 22.1601 32.6398 18.5601 33.7598 14.6001H38.9199C38.0599 19.4801 34.4599 23.0801 31.8999 24.5601C34.4599 25.7601 38.5601 28.9001 40.1201 34.5801H34.4399C33.2199 30.7801 30.1802 27.8401 26.1602 27.4401V34.5801H25.54Z" fill="white"/>
</svg> {/* where is fckn formatter bro */}
            </button>
          </motion.div>
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
            <Logo className="h-24 w-24 mx-auto mb-8 text-background" showText={false} />
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
  )
}
