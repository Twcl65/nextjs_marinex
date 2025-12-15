'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message);
      } else {
        setError(data.message || 'Failed to send reset email.');
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
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
            {'Forgot Your Password?'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-[#134686]/80">
            {"No problem. Enter your email and we'll send a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {successMessage}
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
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                  if (successMessage) setSuccessMessage('');
                }}
                className="border-[#13468633] focus:border-[#134686] focus:ring-[#134686]"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#134686] hover:bg-[#0f3a6e] text-white font-medium cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? 'Sending Link...' : 'Send Reset Link'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center space-y-4">
          <Link
            href="/auth/login"
            className="text-sm text-[#134686] hover:text-[#0f3a6e] hover:underline focus:outline-none flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
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
};

export default ForgotPasswordPage;
