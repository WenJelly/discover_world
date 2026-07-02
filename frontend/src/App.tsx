
import { AppLayout } from "@/app/AppLayout"
import { Toaster } from "@/components/ui/toast"
import { AuthProvider } from "@/context/AuthContext"
import { ToastProvider } from "@/hooks/use-toast"

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppLayout />
        <Toaster />
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
