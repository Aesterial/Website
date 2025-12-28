"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/sonner"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { status, hasAdminAccess } = useAuth()

  useEffect(() => {
    if (status !== "loading" && !hasAdminAccess) {
      router.replace("/")
    }
  }, [status, hasAdminAccess, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-24 rounded-full bg-muted/80 animate-pulse" />
      </div>
    )
  }

  if (!hasAdminAccess) {
    return null
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      {children}
    </>
  )
}
