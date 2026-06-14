"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

type PageTransitionProps = {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative min-h-[calc(100vh-9rem)]">
      {!reduceMotion ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`progress-${pathname}`}
            initial={{ opacity: 0, scaleX: 0.08 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scaleX: [0.08, 0.52, 0.92, 1],
            }}
            transition={{
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
              times: [0, 0.2, 0.8, 1],
            }}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 origin-left"
          >
            <div className="h-[2px] overflow-hidden rounded-full bg-transparent">
              <div className="h-full w-full bg-[linear-gradient(90deg,rgba(56,189,248,0),rgba(56,189,248,0.95),rgba(250,204,21,0.9),rgba(250,204,21,0))]" />
            </div>
          </motion.div>
        </AnimatePresence>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 0, y: 10, filter: "blur(6px)" }
          }
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          exit={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 0, y: -6, filter: "blur(4px)" }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.26,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="will-change-transform"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
