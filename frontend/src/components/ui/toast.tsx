import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

import {
  ToastProvider,
  useToast,
  useToastItems,
  type ToastItem,
} from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function ToastIcon({ toast }: { toast: ToastItem }) {
  if (toast.variant === "success") {
    return <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
  }

  if (toast.variant === "destructive") {
    return <AlertCircle className="mt-0.5 size-4 text-destructive" />
  }

  return <Info className="mt-0.5 size-4 text-blue-500" />
}

function Toaster() {
  const { toasts, dismiss } = useToastItems()

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-slot="toast"
          className={cn(
            "flex items-start gap-3 rounded-xl border bg-background/95 p-4 text-foreground shadow-xl shadow-slate-950/10 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 dark:bg-slate-950/95",
            toast.variant === "destructive"
              ? "border-destructive/30"
              : "border-border"
          )}
        >
          <ToastIcon toast={toast} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-5">{toast.title}</div>
            {toast.description ? (
              <div className="mt-1 text-sm leading-5 text-muted-foreground">
                {toast.description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="关闭提示"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
            onClick={() => dismiss(toast.id)}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export { ToastProvider, Toaster, useToast }
