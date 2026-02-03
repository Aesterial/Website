export const CITY_STORAGE_KEY = "city";
export const CITY_CHANGE_EVENT = "city-change";

export const cities = [
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
] as const;

export type City = (typeof cities)[number];

export const DEFAULT_CITY_CENTER: [number, number] = [86.0877, 55.3541];

export const CITY_CENTERS: Record<City, [number, number]> = {
  Барнаул: [83.7788448, 53.3475493],
  Бийск: [85.2148673, 52.5394905],
  Рубцовск: [81.2176174, 51.5276264],
  Котельниково: [43.14109, 47.6332274],
  "Ленинск-Кузнецкий": [86.166115, 54.665443],
  Полысаево: [86.276024, 54.603142],
  Прокопьевск: [86.7492072, 53.8879117],
  Мыски: [87.800316, 53.71386],
  Бородино: [94.9049904, 55.9047245],
  Назарово: [90.418503, 56.011593],
  Шарыпово: [89.1864204, 55.5329127],
  Ковдор: [30.474108, 67.563049],
  Кингисепп: [28.5981591, 59.3743982],
  Березники: [56.8036958, 59.4084171],
  Абакан: [91.4406019, 53.72068],
  Черногорск: [91.31321, 53.828236],
  Рефтинский: [61.6721615, 57.0839104],
  Чегдомын: [133.035553, 51.134487],
};

const normalizeCity = (value?: string | null) => value?.trim().toLowerCase() ?? "";

export const resolveCity = (value?: string | null): City | null => {
  const normalized = normalizeCity(value);
  if (!normalized) {
    return null;
  }
  const match = cities.find((city) => city.toLowerCase() === normalized);
  return match ?? null;
};

export const resolveCityCenter = (value?: string | null): [number, number] => {
  const city = resolveCity(value);
  if (city) {
    return CITY_CENTERS[city];
  }
  return DEFAULT_CITY_CENTER;
};

export const getStoredCity = (): City => {
  if (typeof window === "undefined") {
    return cities[0];
  }
  const savedCity = localStorage.getItem(CITY_STORAGE_KEY);
  return resolveCity(savedCity) ?? cities[0];
};

export const emitCityChange = (city: City) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(CITY_CHANGE_EVENT, { detail: { city } }),
  );
};
