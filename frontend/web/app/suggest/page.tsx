"use client";

import type React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Header } from "@/components/header";
import { useAuth } from "@/components/auth-provider";
import { GradientButton } from "@/components/gradient-button";
import { MapLibreMap } from "@/components/maplibre-map";
import {
  Upload,
  X,
  MapPin,
  Camera,
  FileText,
  ListFilter,
  Check,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cities, type City } from "@/components/header";
import { createProject, uploadProjectPhotos } from "@/lib/api";

type SelectedImage = {
  id: string;
  file: File;
  preview: string;
};

type SuggestCategoryId =
  | "improvement"
  | "roadsidewalks"
  | "lighting"
  | "playgrounds"
  | "parks"
  | "other";

const createImageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getStoredCity = () => {
  if (typeof window === "undefined") {
    return cities[0];
  }
  const savedCity = localStorage.getItem("city");
  if (savedCity && cities.includes(savedCity as City)) {
    return savedCity as City;
  }
  return cities[0];
};

export default function SuggestPage() {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SuggestCategoryId>("improvement");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mapSelection, setMapSelection] = useState<[number, number] | null>(
    null,
  );
  const [selectedCity, setSelectedCity] = useState<City>(cities[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const imagesRef = useRef<SelectedImage[]>([]);
  const { status, user } = useAuth();
  const { t } = useLanguage();
  const categoryOptions = [
    { id: "improvement", label: t("landscaping") },
    { id: "roadsidewalks", label: t("roadsAndSidewalks") },
    { id: "lighting", label: t("lighting") },
    { id: "playgrounds", label: t("playgrounds") },
    { id: "parks", label: t("parksAndSquares") },
    { id: "other", label: t("other") },
  ] as const;
  const selectedCategoryLabel =
    categoryOptions.find((option) => option.id === category)?.label ??
    t("category");

  useEffect(() => {
    setSelectedCity(getStoredCity());
  }, []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
    };
  }, []);

  useEffect(() => {
    if (!isCategoryOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!categoryDropdownRef.current?.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCategoryOpen]);

  useEffect(() => {
    if (!isCategoryOpen) {
      return;
    }

    const list = categoryListRef.current;
    if (!list) {
      return;
    }

    const escapeValue =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape
        : (value: string) => value.replace(/"/g, '\\"');
    const selected = list.querySelector(
      `[data-value="${escapeValue(category)}"]`,
    ) as HTMLElement | null;

    if (selected) {
      requestAnimationFrame(() => {
        selected.scrollIntoView({ block: "nearest" });
      });
    }
  }, [isCategoryOpen, category]);

  const addImages = useCallback((files: File[]) => {
    const next = files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: createImageId(),
        file,
        preview: URL.createObjectURL(file),
      }));
    if (next.length === 0) {
      return;
    }
    setImages((prev) => [...prev, ...next]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      addImages(Array.from(e.dataTransfer.files));
    },
    [addImages],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setSubmitError(t("projectSubmitErrorDescription"));
      return;
    }
    if (!mapSelection) {
      setSubmitError(t("projectSubmitErrorCoordinates"));
      return;
    }
    if (images.length === 0) {
      setSubmitError(t("projectSubmitErrorPhotos"));
      return;
    }

    const city = getStoredCity();
    setSelectedCity(city);
    if (!city) {
      setSubmitError(t("projectSubmitErrorCity"));
      return;
    }

    const title =
      trimmedDescription.split(/\n|\r/)[0]?.slice(0, 80).trim() ||
      `${t("projectTitleFallback")} ${city}`;

    setIsSubmitting(true);
    try {
      const { id } = await createProject({
        title,
        description: trimmedDescription,
        category,
        location: {
          city,
          latitude: mapSelection[1],
          longitude: mapSelection[0],
        },
      });

      if (!id) {
        throw new Error(t("projectSubmitErrorMissingId"));
      }

      await uploadProjectPhotos(
        id,
        images.map((image) => image.file),
      );

      setDescription("");
      setMapSelection(null);
      setImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.preview));
        return [];
      });
      setSubmitSuccess(t("projectSubmitSuccess"));
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t("projectSubmitErrorGeneric"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
          <div className="container mx-auto flex justify-center">
            <div className="h-10 w-40 rounded-full bg-muted/80 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
          <div className="container mx-auto max-w-lg text-center">
            <p className="text-lg font-semibold">
              Для начала необходимо авторизовать
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Авторизуйтесь, чтобы предложить идею.
            </p>
            <Link href="/auth" className="mt-6 inline-flex">
              <GradientButton className="px-6 py-3 text-sm">
                Авторизация
              </GradientButton>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
          <div className="container mx-auto max-w-lg text-center">
            <p className="text-lg font-semibold">
              {t("emailVerificationRequiredTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("emailVerificationRequiredProjectsBody")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("emailVerificationSupportHint")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/account" className="inline-flex">
                <GradientButton className="px-6 py-3 text-sm">
                  {t("emailVerificationGoToAccount")}
                </GradientButton>
              </Link>
              <Link href="/support" className="inline-flex">
                <button
                  type="button"
                  className="rounded-full border border-border/70 px-6 py-3 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                >
                  {t("emailVerificationGoToSupport")}
                </button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-3 sm:text-4xl">
              {t("suggestIdea")}
            </h1>
            <p className="text-muted-foreground mb-8 sm:mb-10">
              {t("describeIssue")}
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
              <motion.div
                className="space-y-5 sm:space-y-6"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    {t("projectCityLabel")}
                  </label>
                  <input
                    type="text"
                    value={selectedCity}
                    readOnly
                    className="w-full bg-card border border-border rounded-2xl py-3 px-5 text-sm font-semibold text-foreground/90 focus:outline-none sm:py-4"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("projectCityHint")}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <ListFilter className="w-4 h-4 inline mr-2" />
                    {t("category")}
                  </label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <ListFilter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isCategoryOpen}
                      onClick={() => setIsCategoryOpen((prev) => !prev)}
                      className="w-full rounded-2xl border border-border/60 bg-card px-10 py-3 text-left text-sm font-semibold text-foreground/90 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-foreground/20 sm:py-4"
                    >
                      {selectedCategoryLabel}
                    </button>
                    <ChevronDown
                      className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform ${
                        isCategoryOpen ? "rotate-180" : "rotate-0"
                      }`}
                    />
                    <ul
                      ref={categoryListRef}
                      role="listbox"
                      aria-hidden={!isCategoryOpen}
                      className={`absolute left-0 right-0 z-20 mt-2 max-h-60 origin-top overflow-auto rounded-2xl border border-border/60 bg-card/95 p-1 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.55)] backdrop-blur transition duration-150 ease-out ${
                        isCategoryOpen
                          ? "pointer-events-auto scale-100 opacity-100"
                          : "pointer-events-none scale-95 opacity-0"
                      }`}
                    >
                      {categoryOptions.map((option) => {
                        const isSelected = category === option.id;
                        return (
                          <li key={option.id} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              data-value={option.id}
                              onClick={() => {
                                setCategory(option.id);
                                setIsCategoryOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                                isSelected
                                  ? "bg-foreground/10"
                                  : "hover:bg-foreground/10"
                              }`}
                            >
                              <span className="truncate">{option.label}</span>
                              {isSelected ? (
                                <Check
                                  aria-hidden="true"
                                  className="h-4 w-4 text-foreground"
                                />
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    {t("description")}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("describeYourIdea")}
                    rows={5}
                    className="w-full bg-card border border-border rounded-2xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300 resize-none sm:py-4"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Camera className="w-4 h-4 inline mr-2" />
                    {t("photos")}
                  </label>
                  <motion.div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all duration-300 sm:p-8 ${
                      isDragging
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/50"
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3 sm:w-10 sm:h-10" />
                    <p className="text-sm text-muted-foreground sm:text-base">
                      {t("dragImagesOrSelect")}{" "}
                      <label className="text-foreground cursor-pointer hover:underline">
                        {t("selectFiles")}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            addImages(Array.from(e.target.files || []));
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </p>
                  </motion.div>

                  {images.length > 0 && (
                    <motion.div
                      className="flex gap-3 mt-4 flex-wrap"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {images.map((img, index) => (
                        <motion.div
                          key={img.id}
                          className="relative w-20 h-20 rounded-xl overflow-hidden group sm:w-24 sm:h-24"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <img
                            src={img.preview || "/placeholder.svg"}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-foreground/80 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <label className="block text-sm font-medium mb-2">
                  {t("markOnMap")}
                </label>
                <MapLibreMap
                  className="min-h-[220px] sm:min-h-[300px] lg:min-h-[360px]"
                  markers={
                    mapSelection
                      ? [
                          {
                            id: "selection",
                            coordinates: mapSelection,
                            title: t("markOnMap"),
                          },
                        ]
                      : []
                  }
                  onMapClick={(coordinates) => setMapSelection(coordinates)}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {mapSelection
                    ? `${t("mapSelectedCoordinates")}: ${mapSelection[1].toFixed(5)}, ${mapSelection[0].toFixed(5)}`
                    : t("clickMapToMark")}
                </p>
              </motion.div>
            </div>

            <motion.div
              className="flex justify-center pt-2 sm:pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="w-full space-y-3 sm:w-auto sm:min-w-[280px]">
                <GradientButton
                  type="submit"
                  className="w-full justify-center px-10 sm:px-12"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("projectSubmitSending") : t("submitIdea")}
                </GradientButton>
                {submitError ? (
                  <p className="text-sm text-destructive text-center">
                    {submitError}
                  </p>
                ) : null}
                {submitSuccess ? (
                  <p className="text-sm text-foreground text-center">
                    {submitSuccess}
                  </p>
                ) : null}
              </div>
            </motion.div>
          </form>
        </div>
      </main>
    </div>
  );
}
