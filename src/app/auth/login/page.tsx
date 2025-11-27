'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { user, login, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail }));
      setRememberMe(true);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      const redirectPath = getRedirectPath(user.role);
      router.push(redirectPath);
    }
  }, [user, authLoading, router]);

  const getRedirectPath = (role: string) => {
    switch (role) {
      case 'SHIPOWNER':
        return '/pages/shipowner';
      case 'SHIPYARD':
        return '/pages/shipyard';
      case 'MARINA':
        return '/pages/marina';
      default:
        return '/auth/login';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Handle remember me functionality
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', formData.email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        // Show success toast
        toast({
          title: 'Successfully logged in',
          description: 'Welcome back! Redirecting to your dashboard...',
          variant: 'success',
        });
        
        // Small delay to show toast before redirect
        setTimeout(() => {
          // The useEffect will handle the redirect
          console.log('Login successful');
        }, 500);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[3px]"
        style={{ backgroundImage: "url('/assets/background.jpg')" }}
      />
      <Card className="w-full max-w-sm sm:max-w-md shadow-xl border-0 bg-white backdrop-blur-sm relative z-10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl sm:text-2xl font-bold text-[#134686]">
            Welcome back
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-[#134686]/80">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#134686] font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                className="border-[#13468633] focus:border-[#134686] focus:ring-[#134686]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#134686] font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="border-[#13468633] focus:border-[#134686] focus:ring-[#134686] pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 cursor-pointer top-1/2 -translate-y-1/2 text-[#134686] hover:text-[#0f3a6e] focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => {
                    setRememberMe(checked === true);
                    if (!checked) {
                      localStorage.removeItem('rememberedEmail');
                    }
                  }}
                  className="border-[#1346864d] data-[state=checked]:bg-[#134686] data-[state=checked]:border-[#134686]"
                />
                <Label htmlFor="remember" className="text-sm text-[#134686] bg-white cursor-pointer">
                  Remember me
                </Label>
              </div>
              <Link
                href="#"
                className="text-sm text-[#134686] hover:text-[#0f3a6e] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#134686] hover:bg-[#0f3a6e] text-white font-medium cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-[#134686]">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/register"
              className="font-medium text-[#0f3a6e] hover:text-[#0c2f59] hover:underline"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
