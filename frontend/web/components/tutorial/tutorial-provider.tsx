"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TutorialOverlay } from "./tutorial-overlay";
import { TutorialTooltip } from "./tutorial-tooltip";

export type TutorialStep = {
  selector: string;
  text: string;
  position: "top" | "bottom" | "left" | "right";
};

type TutorialLabels = {
  next: string;
  back: string;
  skip: string;
};

type TutorialProviderProps = {
  steps: TutorialStep[];
  children: ReactNode;
  storageKey?: string;
  labels?: Partial<TutorialLabels>;
  padding?: number;
};

const DEFAULT_STORAGE_KEY = "admin-tutorial-complete";
const DEFAULT_LABELS: TutorialLabels = {
  next: "\u0414\u0430\u043b\u0435\u0435",
  back: "\u041d\u0430\u0437\u0430\u0434",
  skip: "\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function TutorialProvider({
  steps,
  children,
  storageKey = DEFAULT_STORAGE_KEY,
  labels,
  padding = 30,
}: TutorialProviderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const mergedLabels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels],
  );

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!steps.length) {
      setIsActive(false);
      return;
    }
    const stored = localStorage.getItem(storageKey);
    setIsActive(stored !== "1");
  }, [steps.length, storageKey]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    setCurrentStep((prev) => clamp(prev, 0, Math.max(steps.length - 1, 0)));
  }, [isActive, steps.length]);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(storageKey, "1");
    setIsActive(false);
  }, [storageKey]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        completeTutorial();
        return prev;
      }
      return prev + 1;
    });
  }, [completeTutorial, steps.length]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => clamp(prev - 1, 0, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  const handleSkip = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const step = isActive ? steps[currentStep] : null;

  useEffect(() => {
    if (!isActive || !step) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(step.selector) as HTMLElement | null;
    if (!element) {
      setTargetRect(null);
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });

    const update = () => {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(element);
    }

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [isActive, step]);

  const overlay =
    portalTarget && isActive && step && targetRect && viewport.width > 0 ? (
      <AnimatePresence>
        <motion.div key={`overlay-${currentStep}`}>
          <TutorialOverlay
            targetRect={targetRect}
            viewport={viewport}
            padding={padding}
          />
        </motion.div>
      
        <motion.div key={`tooltip-${currentStep}`}>
          <TutorialTooltip
            step={step}
            stepIndex={currentStep}
            stepsCount={steps.length}
            labels={mergedLabels}
            targetRect={targetRect}
            viewport={viewport}
            onNext={handleNext}
            onPrev={handlePrev}
            onSkip={handleSkip}
          />
        </motion.div>
      </AnimatePresence>

    ) : null;

  return (
    <>
      {children}
      {portalTarget ? createPortal(overlay, portalTarget) : null}
    </>
  );
}
