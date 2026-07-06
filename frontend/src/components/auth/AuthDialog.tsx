import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  Code,
  Eye,
  EyeOff,
  Globe,
  LoaderCircle,
  Lock,
  Mail,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "register"

type AuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type LoginFormState = {
  email: string
  password: string
}

type RegisterFormState = {
  username: string
  email: string
  password: string
  confirmPassword: string
}

type LoginErrors = Partial<Record<keyof LoginFormState, string>>
type RegisterErrors = Partial<Record<keyof RegisterFormState | "terms", string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) {
    return null
  }

  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {children}
    </p>
  )
}

function FieldShell({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  )
}

function InputWithIcon({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  icon: ReactNode
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  )
}

function PasswordInput({
  id,
  value,
  placeholder,
  visible,
  error,
  onToggle,
  onChange,
}: {
  id: string
  value: string
  placeholder: string
  visible: boolean
  error?: string
  onToggle: () => void
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <InputWithIcon
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        icon={<Lock className="size-4" />}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="pr-10"
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label={visible ? "隐藏密码" : "显示密码"}
        className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
        onClick={onToggle}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function validateLoginForm(form: LoginFormState): LoginErrors {
  const errors: LoginErrors = {}

  if (!form.email.trim()) {
    errors.email = "请输入邮箱"
  } else if (!emailPattern.test(form.email.trim())) {
    errors.email = "请输入有效的邮箱地址"
  }

  if (!form.password) {
    errors.password = "请输入密码"
  } else if (form.password.length < 6) {
    errors.password = "密码至少需要 6 位"
  }

  return errors
}

function validateRegisterForm(
  form: RegisterFormState,
  termsAccepted: boolean
): RegisterErrors {
  const errors: RegisterErrors = {}

  if (!form.username.trim()) {
    errors.username = "请输入用户名"
  } else if (form.username.trim().length < 2) {
    errors.username = "用户名至少需要 2 个字符"
  }

  if (!form.email.trim()) {
    errors.email = "请输入邮箱"
  } else if (!emailPattern.test(form.email.trim())) {
    errors.email = "请输入有效的邮箱地址"
  }

  if (!form.password) {
    errors.password = "请输入密码"
  } else if (form.password.length < 6) {
    errors.password = "密码至少需要 6 位"
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = "请再次输入密码"
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "密码不一致，请重新输入"
  }

  if (!termsAccepted) {
    errors.terms = "请先同意用户协议"
  }

  return errors
}

function hasErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean)
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login")
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: "",
  })
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({})
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({})
  const [rememberMe, setRememberMe] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState<AuthMode | null>(null)

  const { login, register } = useAuth()
  const { toast } = useToast()

  const dialogCopy = useMemo(
    () =>
      mode === "login"
        ? {
            title: "欢迎回来",
            description: "登录后继续管理你的照片与作品集",
          }
        : {
            title: "创建账号",
            description: "用一个邮箱账号开始整理你的影像空间",
          },
    [mode]
  )

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateLoginForm(loginForm)
    setLoginErrors(errors)

    if (hasErrors(errors)) {
      return
    }

    setLoading("login")
    try {
      await login(
        {
          userEmail: loginForm.email.trim(),
          userPassword: loginForm.password,
        },
        {
          remember: rememberMe,
        }
      )
      toast({
        title: "登录成功",
        description: "已为你同步账号状态。",
        variant: "success",
      })
      setLoginForm((current) => ({
        ...current,
        password: "",
      }))
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "登录失败",
        description: getErrorMessage(error, "请检查邮箱和密码后重试。"),
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateRegisterForm(registerForm, termsAccepted)
    setRegisterErrors(errors)

    if (hasErrors(errors)) {
      return
    }

    setLoading("register")
    try {
      await register({
        username: registerForm.username.trim(),
        userEmail: registerForm.email.trim(),
        userPassword: registerForm.password,
        userCheckPassword: registerForm.confirmPassword,
      })
      toast({
        title: "注册成功",
        description: "账号已创建，请使用邮箱和密码登录。",
        variant: "success",
      })
      setLoginForm({
        email: registerForm.email.trim(),
        password: "",
      })
      setRegisterForm({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      })
      setTermsAccepted(false)
      setRegisterErrors({})
      setMode("login")
    } catch (error) {
      toast({
        title: "注册失败",
        description: getErrorMessage(error, "注册暂时不可用，请稍后重试。"),
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  function handleProviderLogin(provider: "GitHub" | "Google") {
    toast({
      title: `${provider} 登录暂未配置`,
      description: "请先使用邮箱和密码完成登录。",
    })
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setLoginErrors({})
    setRegisterErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[420px] border-0 bg-transparent p-0 shadow-none"
        initialFocus={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{dialogCopy.title}</DialogTitle>
          <DialogDescription>{dialogCopy.description}</DialogDescription>
        </DialogHeader>

        <Card className="overflow-hidden border-white/70 bg-white/90 shadow-2xl shadow-slate-950/15 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 dark:shadow-black/30">
          <CardHeader className="items-center px-7 pb-4 pt-8 text-center">
            <a
              href="/"
              aria-label="WenJelly 首页"
              className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
            >
              <img
                src="/logo.svg"
                alt="WenJelly"
                className="h-7 w-7 object-contain dark:invert"
              />
            </a>
            <CardTitle className="text-2xl">{dialogCopy.title}</CardTitle>
            <CardDescription>{dialogCopy.description}</CardDescription>
          </CardHeader>

          <CardContent className="px-7 pb-7">
            <Tabs value={mode} onValueChange={(value) => switchMode(value)}>
              <TabsList aria-label="登录注册切换">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-4" onSubmit={handleLoginSubmit}>
                  <FieldShell
                    id="login-email"
                    label="邮箱"
                    error={loginErrors.email}
                  >
                    <InputWithIcon
                      id="login-email"
                      type="email"
                      value={loginForm.email}
                      placeholder="you@example.com"
                      icon={<Mail className="size-4" />}
                      aria-invalid={Boolean(loginErrors.email)}
                      aria-describedby={
                        loginErrors.email ? "login-email-error" : undefined
                      }
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </FieldShell>

                  <FieldShell
                    id="login-password"
                    label="密码"
                    error={loginErrors.password}
                  >
                    <PasswordInput
                      id="login-password"
                      value={loginForm.password}
                      placeholder="输入密码"
                      visible={showLoginPassword}
                      error={loginErrors.password}
                      onToggle={() =>
                        setShowLoginPassword((current) => !current)
                      }
                      onChange={(password) =>
                        setLoginForm((current) => ({
                          ...current,
                          password,
                        }))
                      }
                    />
                  </FieldShell>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked)}
                      />
                      <Label
                        htmlFor="remember-me"
                        className="text-sm font-normal text-muted-foreground"
                      >
                        记住我
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-600 transition hover:text-blue-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 dark:text-blue-400"
                      onClick={() =>
                        toast({
                          title: "忘记密码暂未开放",
                          description: "请先联系站点管理员重置账号。",
                        })
                      }
                    >
                      忘记密码？
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading === "login"}
                    className="h-10 w-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-500"
                  >
                    {loading === "login" ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        登录中
                      </>
                    ) : (
                      "登录"
                    )}
                  </Button>

                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      或使用
                    </span>
                    <Separator className="flex-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 transition hover:-translate-y-0.5"
                      onClick={() => handleProviderLogin("GitHub")}
                    >
                      <Code className="size-4" />
                      GitHub
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 transition hover:-translate-y-0.5"
                      onClick={() => handleProviderLogin("Google")}
                    >
                      <Globe className="size-4" />
                      Google
                    </Button>
                  </div>

                  <p className="pt-1 text-center text-sm text-muted-foreground">
                    还没有账号？
                    <button
                      type="button"
                      className="ml-1 font-medium text-blue-600 transition hover:text-blue-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 dark:text-blue-400"
                      onClick={() => switchMode("register")}
                    >
                      点击注册
                    </button>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                  <FieldShell
                    id="register-username"
                    label="用户名"
                    error={registerErrors.username}
                  >
                    <InputWithIcon
                      id="register-username"
                      value={registerForm.username}
                      placeholder="唯一用户名"
                      icon={<User className="size-4" />}
                      aria-invalid={Boolean(registerErrors.username)}
                      aria-describedby={
                        registerErrors.username
                          ? "register-username-error"
                          : undefined
                      }
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                    />
                  </FieldShell>

                  <FieldShell
                    id="register-email"
                    label="邮箱"
                    error={registerErrors.email}
                  >
                    <InputWithIcon
                      id="register-email"
                      type="email"
                      value={registerForm.email}
                      placeholder="you@example.com"
                      icon={<Mail className="size-4" />}
                      aria-invalid={Boolean(registerErrors.email)}
                      aria-describedby={
                        registerErrors.email
                          ? "register-email-error"
                          : undefined
                      }
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </FieldShell>

                  <FieldShell
                    id="register-password"
                    label="密码"
                    error={registerErrors.password}
                  >
                    <PasswordInput
                      id="register-password"
                      value={registerForm.password}
                      placeholder="至少 6 位密码"
                      visible={showRegisterPassword}
                      error={registerErrors.password}
                      onToggle={() =>
                        setShowRegisterPassword((current) => !current)
                      }
                      onChange={(password) =>
                        setRegisterForm((current) => ({
                          ...current,
                          password,
                        }))
                      }
                    />
                  </FieldShell>

                  <FieldShell
                    id="register-confirm-password"
                    label="确认密码"
                    error={registerErrors.confirmPassword}
                  >
                    <PasswordInput
                      id="register-confirm-password"
                      value={registerForm.confirmPassword}
                      placeholder="再次输入密码"
                      visible={showConfirmPassword}
                      error={registerErrors.confirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      onChange={(confirmPassword) =>
                        setRegisterForm((current) => ({
                          ...current,
                          confirmPassword,
                        }))
                      }
                    />
                  </FieldShell>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        aria-describedby={
                          registerErrors.terms ? "terms-error" : undefined
                        }
                        onCheckedChange={(checked) =>
                          setTermsAccepted(checked)
                        }
                      />
                      <Label
                        htmlFor="terms"
                        className="text-sm font-normal leading-5 text-muted-foreground"
                      >
                        我已阅读并同意用户协议与隐私政策
                      </Label>
                    </div>
                    <FieldError id="terms-error">{registerErrors.terms}</FieldError>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading === "register"}
                    className="h-10 w-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-500"
                  >
                    {loading === "register" ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        注册中
                      </>
                    ) : (
                      "注册"
                    )}
                  </Button>

                  <p className="pt-1 text-center text-sm text-muted-foreground">
                    已有账号？
                    <button
                      type="button"
                      className="ml-1 font-medium text-blue-600 transition hover:text-blue-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 dark:text-blue-400"
                      onClick={() => switchMode("login")}
                    >
                      点击登录
                    </button>
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
