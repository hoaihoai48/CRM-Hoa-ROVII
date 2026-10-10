'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Flower2, Lock, Mail, ArrowRight, Phone, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { 
  loginWithEmail, 
  loginWithGoogle, 
  setupRecaptcha, 
  sendPhoneOtp, 
  verifyPhoneOtp 
} from '@/lib/firebase/authService';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

type AuthMethod = 'email' | 'google' | 'phone';

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Phone state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  
  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Recaptcha for phone auth
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
      }
    };
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng nhập email thất bại. Vui lòng kiểm tra lại.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng nhập Google thất bại.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      let formattedPhone = phoneNumber.trim();
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+84' + formattedPhone.slice(1);
      }
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      }
      const confirmation = await sendPhoneOtp(formattedPhone, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không gửi được mã OTP. Vui lòng thử lại.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setIsLoading(true);
    setError(null);
    try {
      await verifyPhoneOtp(confirmationResult, verificationCode);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Mã OTP không chính xác hoặc đã hết hạn.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4 sm:p-6 text-[var(--text-main)]">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border-theme shadow-xl p-6 sm:p-8">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center text-white shadow-md mb-3">
            <Flower2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tiệm Hoa CRM</h1>
          <p className="text-sm text-text-muted mt-1">Đăng nhập tài khoản quản lý tiệm</p>
        </div>

        {/* Auth Method Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-surface-subtle rounded-xl mb-6 border border-border-theme">
          <button
            type="button"
            onClick={() => { setAuthMethod('email'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              authMethod === 'email'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            Email & Mật khẩu
          </button>
          <button
            type="button"
            onClick={() => { setAuthMethod('phone'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              authMethod === 'phone'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            Số điện thoại (SMS)
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Method 1: Email & Password */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              placeholder="nhanvien@tiemhoa.vn"
            />

            <Input
              label="Mật khẩu"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              placeholder="Nhập mật khẩu"
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Đăng nhập với Email
              </Button>
            </div>
          </form>
        )}

        {/* Method 2: Phone Authentication */}
        {authMethod === 'phone' && (
          <div>
            {!confirmationResult ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                <Input
                  label="Số điện thoại"
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                  placeholder="0901234567"
                  hint="Hệ thống sẽ gửi mã xác thực 6 số qua tin nhắn SMS"
                />

                <div id="recaptcha-container" />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    isLoading={isLoading}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Gửi mã xác thực SMS
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <Input
                  label="Mã xác thực (OTP)"
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  placeholder="123456"
                  hint={`Đã gửi mã đến ${phoneNumber}`}
                />

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => { setConfirmationResult(null); setVerificationCode(''); if (recaptchaVerifierRef.current) { recaptchaVerifierRef.current.clear(); recaptchaVerifierRef.current = null; } }}
                  >
                    Đổi số khác
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    isLoading={isLoading}
                  >
                    Xác nhận OTP
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-theme" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-3 text-text-muted">Hoặc tiếp tục với</span>
          </div>
        </div>

        {/* Method 3: Google Sign-in */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-border-theme bg-surface hover:bg-surface-subtle text-foreground text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Đăng nhập bằng tài khoản Google</span>
        </button>

        {/* Security & Project info footer */}
        <div className="mt-6 pt-4 border-t border-border-theme text-center">
          <p className="text-xs text-text-muted">
            Dự án: <span className="font-mono font-medium text-foreground">crm-hoa-rovi</span>
          </p>
        </div>
      </div>
    </div>
  );
}
