
import { AppLayout } from "@/app/AppLayout"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { AuthProvider } from "@/context/AuthContext"

const sonnerTopOffset = "calc(var(--navbar-height, 4rem) + 0.75rem)"

function App() {
  return (
    <AuthProvider>
      <AppLayout />
      <Sonner
        position="top-center"
        offset={{ top: sonnerTopOffset }}
        mobileOffset={{ top: sonnerTopOffset, left: "1rem", right: "1rem" }}
        duration={3600}
      />
    </AuthProvider>
  )
}

export default App
