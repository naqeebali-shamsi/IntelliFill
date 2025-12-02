import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companySlug: '',
    rememberMe: false
  })

  // Get auth store state and actions
  const { login, clearError } = useAuthStore()
  const isLoading = useAuthStore((state) => state.isLoading)
  const error = useAuthStore((state) => state.error)
  const isLocked = useAuthStore((state) => state.isLocked)
  const loginAttempts = useAuthStore((state) => state.loginAttempts)
  const lockExpiry = useAuthStore((state) => state.lockExpiry)
  
  // Check if coming from expired session
  const wasExpired = location.state?.expired

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    // Check if account is locked
    if (isLocked && lockExpiry && Date.now() < lockExpiry) {
      const remainingTime = Math.ceil((lockExpiry - Date.now()) / 60000)
      toast.error(`Account is locked. Try again in ${remainingTime} minutes.`)
      return
    }

    try {
      await login({
        email: formData.email,
        password: formData.password,
        companySlug: formData.companySlug || undefined,
        rememberMe: formData.rememberMe
      })
      
      toast.success('Login successful!')
      
      // Navigate to intended route or dashboard
      const redirectTo = location.state?.from?.pathname || '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      console.error('Login error:', err)
      // Error is already set in the store by the login action
      // Show toast for better UX
      if (err.code === 'ACCOUNT_LOCKED') {
        toast.error('Account locked due to multiple failed attempts')
      } else if (err.code === 'INVALID_CREDENTIALS') {
        toast.error('Invalid email or password')
      } else {
        toast.error(err.message || 'Login failed. Please try again.')
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error when user starts typing
    if (error) clearError()
  }

  // Test credentials for demo
  const fillTestCredentials = () => {
    setFormData({
      email: 'admin@example.com',
      password: 'admin123',
      companySlug: 'demo-company',
      rememberMe: false
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {wasExpired && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your session has expired. Please log in again.
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message}
                  {isLocked && lockExpiry && (
                    <div className="mt-2 text-sm">
                      Account locked until {new Date(lockExpiry).toLocaleTimeString()}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {loginAttempts > 0 && loginAttempts < 5 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {5 - loginAttempts} login attempts remaining
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="companySlug">Company (Optional)</Label>
              <Input
                id="companySlug"
                name="companySlug"
                type="text"
                placeholder="your-company-slug"
                value={formData.companySlug}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="email"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-primary hover:underline"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, rememberMe: checked as boolean }))
                }}
                disabled={isLoading}
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
              >
                Remember me
              </label>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>
            
            <div className="flex items-center w-full">
              <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
              <span className="px-3 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={fillTestCredentials}
              disabled={isLoading}
            >
              Use demo credentials
            </Button>
            
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="font-medium text-primary hover:underline"
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}