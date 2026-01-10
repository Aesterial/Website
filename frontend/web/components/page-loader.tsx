"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function PageLoader() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const minDuration = 700; 
    const maxDuration = 4500; 
    const start = Date.now();

    const hide = () => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, minDuration - elapsed);
      window.setTimeout(() => {
        if (!cancelled) setVisible(false);
      }, wait);
    };

   
    if (document.readyState === "complete") {
      hide();
    } else {
      const onLoad = () => hide();
      window.addEventListener("load", onLoad, { once: true });

    
      const fallback = window.setTimeout(() => hide(), maxDuration);

      return () => {
        cancelled = true;
        window.removeEventListener("load", onLoad);
        window.clearTimeout(fallback);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const logo = useMemo(
    () => (
      <svg viewBox="0 0 64 48" role="presentation" className="h-16 w-16">
        <path
          fill="currentColor"
          d="M18 6c6-8 22-8 28 0 4 5 6 11 6 17 0 7-2 13-6 17h7v8H36v-8c4-2 8-7 8-14 0-6-3-11-8-14-5 3-8 8-8 14 0 7 4 12 8 14v8H11v-8h7c-4-4-6-10-6-17 0-6 2-12 6-17Z"
        />
      </svg>
    ),
    [],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-background"
        >
         
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-transparent">
            <motion.div
              initial={{ x: "-30%", opacity: 0.7 }}
              animate={{ x: "130%", opacity: 1 }}
              transition={{
                duration: 1.05,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="h-full w-[40%] bg-foreground"
            />
          </div>

          
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-64 w-[720px] -translate-x-1/2 rounded-full bg-foreground/10 blur-3xl dark:bg-foreground/15" />
            <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
          </div>

          <div className="relative flex h-full items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: easeOut }}
              className="w-full max-w-sm"
            >
              <div className="rounded-[2rem] border border-border bg-card/60 p-7 backdrop-blur">
                <div className="flex flex-col items-center text-center">
                 
                  <div className="relative mb-5">
                    <motion.div
                      aria-hidden="true"
                      className="h-24 w-24 rounded-full border border-border"
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6 }}
                    />
                    <motion.div
                      aria-hidden="true"
                      className="absolute inset-0 h-24 w-24"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.1,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-foreground">
                      {logo}
                    </div>
                  </div>

                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.35, ease: easeOut }}
                    className="text-xl font-bold tracking-tight"
                  >
                    ГОРОД ИДЕЙ
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.35, ease: easeOut }}
                    className="mt-2 text-xs uppercase tracking-[0.35em] text-muted-foreground"
                  >
                    Инициализация…
                  </motion.p>

                 
                  <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                    <motion.div
                      initial={{ x: "-40%" }}
                      animate={{ x: "140%" }}
                      transition={{
                        duration: 1.1,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                      className="h-full w-[45%] rounded-full bg-foreground"
                    />
                  </div>
                </div>
              </div>

           
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Если долго грузится — обнови страницу.
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
