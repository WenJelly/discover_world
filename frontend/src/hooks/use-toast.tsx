import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type ToastVariant = "default" | "success" | "destructive"

export type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

export type ToastItem = Required<Pick<ToastInput, "title" | "variant">> &
  Pick<ToastInput, "description"> & {
    id: string
  }

type ToastContextValue = {
  toasts: ToastItem[]
  toast: (input: ToastInput) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = createToastId()
      const nextToast: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "default",
      }

      setToasts((current) => [nextToast, ...current].slice(0, 4))

      window.setTimeout(() => dismiss(id), input.duration ?? 3600)

      return id
    },
    [dismiss]
  )

  const value = useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
    }),
    [dismiss, toast, toasts]
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return {
    toast: context.toast,
    dismiss: context.dismiss,
  }
}

export function useToastItems() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToastItems must be used within ToastProvider")
  }

  return context
}
