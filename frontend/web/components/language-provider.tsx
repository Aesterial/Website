"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Language = "RU" | "EN" | "KZ"

type Translations = {
  [key: string]: {
    RU: string
    EN: string
    KZ: string
  }
}

export const translations: Translations = {
  cityOfIdeas: {
    RU: "ГОРОД ИДЕЙ",
    EN: "CITY OF IDEAS",
    KZ: "ИДЕЯЛАР ҚАЛАСЫ",
  },
  voting: {
    RU: "Голосование",
    EN: "Voting",
    KZ: "Дауыс беру",
  },
  suggestIdea: {
    RU: "Предложить идею",
    EN: "Suggest an idea",
    KZ: "Идея ұсыну",
  },
  login: {
    RU: "ВОЙТИ",
    EN: "LOGIN",
    KZ: "КІРУ",
  },
  heroTitle: {
    RU: "Предлагайте решения",
    EN: "Suggest solutions",
    KZ: "Шешімдер ұсыныңыз",
  },
  heroSubtitle: {
    RU: "По развитию общественных пространств",
    EN: "For the development of public spaces",
    KZ: "Қоғамдық кеңістіктерді дамыту үшін",
  },
  start: {
    RU: "Начать",
    EN: "Start",
    KZ: "Бастау",
  },
  mostPopularIdeas: {
    RU: "самые популярные идеи",
    EN: "most popular ideas",
    KZ: "ең танымал идеялар",
  },
  vote: {
    RU: "Голосовать",
    EN: "Vote",
    KZ: "Дауыс беру",
  },
  ideas: {
    RU: "Идеи",
    EN: "Ideas",
    KZ: "Идеялар",
  },
  searchIdeas: {
    RU: "Поиск идеи...",
    EN: "Search ideas...",
    KZ: "Идея іздеу...",
  },
  leaksFromRoof: {
    RU: "капает с крыши",
    EN: "leaks from roof",
    KZ: "шатырдан тамады",
  },
  brokenWindow: {
    RU: "окно поломанно",
    EN: "broken window",
    KZ: "терезе сынған",
  },
  noCrosswalk: {
    RU: "нет пешеходного перехода",
    EN: "no crosswalk",
    KZ: "жаяу жүргінші өтпесі жоқ",
  },
  authorization: {
    RU: "Авторизация",
    EN: "Authorization",
    KZ: "Авторизация",
  },
  registration: {
    RU: "Регистрация",
    EN: "Registration",
    KZ: "Тіркелу",
  },
  email: {
    RU: "Email",
    EN: "Email",
    KZ: "Email",
  },
  password: {
    RU: "Пароль",
    EN: "Password",
    KZ: "Құпия сөз",
  },
  name: {
    RU: "Имя",
    EN: "Name",
    KZ: "Аты",
  },
  confirmPassword: {
    RU: "Подтвердите пароль",
    EN: "Confirm password",
    KZ: "Құпия сөзді растаңыз",
  },
  passwordChecklistTitle: {
    RU: "Требования к паролю",
    EN: "Password requirements",
    KZ: "Password requirements",
  },
  passwordRuleLength: {
    RU: "Не менее 10 символов",
    EN: "At least 10 characters",
    KZ: "At least 10 characters",
  },
  passwordRuleLowercase: {
    RU: "Строчная буква (a-z)",
    EN: "Lowercase letter (a-z)",
    KZ: "Lowercase letter (a-z)",
  },
  passwordRuleUppercase: {
    RU: "Заглавная буква (A-Z)",
    EN: "Uppercase letter (A-Z)",
    KZ: "Uppercase letter (A-Z)",
  },
  passwordRuleNumber: {
    RU: "Цифра (0-9)",
    EN: "Number (0-9)",
    KZ: "Number (0-9)",
  },
  passwordRuleSymbol: {
    RU: "Спецсимвол (!@#)",
    EN: "Special character (!@#)",
    KZ: "Special character (!@#)",
  },
  passwordRuleMatch: {
    RU: "Пароли совпадают",
    EN: "Passwords match",
    KZ: "Passwords match",
  },
  passwordRequirementsError: {
    RU: "Пароль слишком простой. Выполните все требования.",
    EN: "Password is too weak. Meet all requirements.",
    KZ: "Password is too weak. Meet all requirements.",
  },
  noAccount: {
    RU: "Нет аккаунта?",
    EN: "No account?",
    KZ: "Аккаунт жоқ па?",
  },
  haveAccount: {
    RU: "Уже есть аккаунт?",
    EN: "Already have an account?",
    KZ: "Аккаунт бар ма?",
  },
  register: {
    RU: "Зарегистрироваться",
    EN: "Register",
    KZ: "Тіркелу",
  },
  address: {
    RU: "Адрес",
    EN: "Address",
    KZ: "Мекенжай",
  },
  category: {
    RU: "Категория",
    EN: "Category",
    KZ: "Санат",
  },
  description: {
    RU: "Описание",
    EN: "Description",
    KZ: "Сипаттама",
  },
  photos: {
    RU: "Фотографии",
    EN: "Photos",
    KZ: "Фотосуреттер",
  },
  markOnMap: {
    RU: "Отметьте на карте",
    EN: "Mark on map",
    KZ: "Картада белгілеңіз",
  },
  clickMapToMark: {
    RU: "Кликните на карту, чтобы указать местоположение",
    EN: "Click on the map to mark location",
    KZ: "Орынды белгілеу үшін картаны басыңыз",
  },
  submitIdea: {
    RU: "Отправить идею",
    EN: "Submit idea",
    KZ: "Идеяны жіберу",
  },
  enterAddressOrSelectOnMap: {
    RU: "Введите адрес или выберите на карте",
    EN: "Enter address or select on map",
    KZ: "Мекенжайды енгізіңіз немесе картадан таңдаңыз",
  },
  describeYourIdea: {
    RU: "Опишите проблему или вашу идею...",
    EN: "Describe the problem or your idea...",
    KZ: "Мәселені немесе идеяңызды сипаттаңыз...",
  },
  dragImagesOrSelect: {
    RU: "Перетащите изображения сюда или",
    EN: "Drag images here or",
    KZ: "Суреттерді осында сүйреңіз немесе",
  },
  selectFiles: {
    RU: "выберите файлы",
    EN: "select files",
    KZ: "файлдарды таңдаңыз",
  },
  describeIssue: {
    RU: "Опишите проблему или предложение по улучшению города",
    EN: "Describe a problem or suggestion for improving the city",
    KZ: "Қала жақсарту туралы мәселе немесе ұсыныс сипаттаңыз",
  },
  landscaping: {
    RU: "Благоустройство",
    EN: "Landscaping",
    KZ: "Көріктендіру",
  },
  roadsAndSidewalks: {
    RU: "Дороги и тротуары",
    EN: "Roads and sidewalks",
    KZ: "Жолдар мен тротуарлар",
  },
  lighting: {
    RU: "Освещение",
    EN: "Lighting",
    KZ: "Жарықтандыру",
  },
  playgrounds: {
    RU: "Детские площадки",
    EN: "Playgrounds",
    KZ: "Балалар алаңдары",
  },
  parksAndSquares: {
    RU: "Парки и скверы",
    EN: "Parks and squares",
    KZ: "Саябақтар мен скверлер",
  },
  other: {
    RU: "Другое",
    EN: "Other",
    KZ: "Басқа",
  },
  needsCrosswalk: {
    RU: "нужен пешеходный переход",
    EN: "needs a crosswalk",
    KZ: "жаяу жүргінші өткелі қажет",
  },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("RU")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedLang = localStorage.getItem("language") as Language
    if (savedLang && ["RU", "EN", "KZ"].includes(savedLang)) {
      setLanguage(savedLang)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("language", language)
    }
  }, [language, mounted])

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language]
    }
    return key
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
