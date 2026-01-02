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
  askQuestion: {
    RU: "\u0417\u0430\u0434\u0430\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441",
    EN: "Ask a question",
    KZ: "\u0421\u04b1\u0440\u0430\u049b \u049b\u043e\u044e",
  },
  account: {
    RU: "\u0410\u043a\u043a\u0430\u0443\u043d\u0442",
    EN: "Account",
    KZ: "\u0410\u043a\u043a\u0430\u0443\u043d\u0442",
  },
  accountSettings: {
    RU: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
    EN: "Account settings",
    KZ: "\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u0431\u0430\u043f\u0442\u0430\u0443\u043b\u0430\u0440\u044b",
  },
  accountSettingsSubtitle: {
    RU: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f \u0438 \u0434\u0430\u043d\u043d\u044b\u0435 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430.",
    EN: "Update your display name and review account details.",
    KZ: "\u041a\u04e9\u0440\u0441\u0435\u0442\u0456\u043b\u0435\u0442\u0456\u043d \u0430\u0442\u0442\u044b \u0436\u0430\u04a3\u0430\u0440\u0442\u044b\u043f, \u0430\u043a\u043a\u0430\u0443\u043d\u0442 \u043c\u04d9\u043b\u0456\u043c\u0435\u0442\u0442\u0435\u0440\u0456\u043d \u049b\u0430\u0440\u0430\u04a3\u044b\u0437.",
  },
  displayNameLabel: {
    RU: "\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f",
    EN: "Display name",
    KZ: "\u041a\u04e9\u0440\u0441\u0435\u0442\u0456\u043b\u0435\u0442\u0456\u043d \u0430\u0442",
  },
  displayNamePlaceholder: {
    RU: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f",
    EN: "Enter display name",
    KZ: "\u041a\u04e9\u0440\u0441\u0435\u0442\u0456\u043b\u0435\u0442\u0456\u043d \u0430\u0442\u0442\u044b \u0435\u043d\u0433\u0456\u0437\u0456\u04a3\u0456\u0437",
  },
  saveChanges: {
    RU: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f",
    EN: "Save changes",
    KZ: "\u04e8\u0437\u0433\u0435\u0440\u0456\u0441\u0442\u0435\u0440\u0434\u0456 \u0441\u0430\u049b\u0442\u0430\u0443",
  },
  saving: {
    RU: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
    EN: "Saving...",
    KZ: "\u0421\u0430\u049b\u0442\u0430\u043b\u0443\u0434\u0430...",
  },
  userIdLabel: {
    RU: "ID \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f",
    EN: "User ID",
    KZ: "\u041f\u0430\u0439\u0434\u0430\u043b\u0430\u043d\u0443\u0448\u044b ID",
  },
  usernameLabel: {
    RU: "\u041b\u043e\u0433\u0438\u043d",
    EN: "Username",
    KZ: "\u041b\u043e\u0433\u0438\u043d",
  },
  emailLabel: {
    RU: "\u041f\u043e\u0447\u0442\u0430",
    EN: "Email",
    KZ: "\u041f\u043e\u0448\u0442\u0430",
  },
  roleLabel: {
    RU: "\u0420\u043e\u043b\u044c",
    EN: "Role",
    KZ: "\u0420\u04e9\u043b",
  },
  languageLabel: {
    RU: "\u042f\u0437\u044b\u043a",
    EN: "Language",
    KZ: "\u0422\u0456\u043b",
  },
  languageDescription: {
    RU: "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u044f\u0437\u044b\u043a \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430.",
    EN: "Choose the interface language.",
    KZ: "\u0418\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0442\u0456\u043b\u0456\u043d \u0442\u0430\u04a3\u0434\u0430\u04a3\u044b\u0437.",
  },
  logout: {
    RU: "\u0412\u044b\u0439\u0442\u0438",
    EN: "Logout",
    KZ: "\u0428\u044b\u0493\u0443",
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
