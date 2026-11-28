import React, { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Phone,
  UserPlus,
  X,
} from 'lucide-react';
import {
  sendPasswordResetEmail,
  signInWithSupabase,
  signUpWithSupabase,
  updateSupabasePassword,
} from '../lib/supabaseApi';
import type { SiteSettings } from '../types';
import { HeroPromotionalBanner } from './BrandVisuals';
import { TELEGRAM_SUPPORT_URL, TELEGRAM_SUPPORT_USERNAME } from './TelegramSupport';

interface AuthScreenProps {
  settings: SiteSettings;
  initialMode?: 'login' | 'register' | 'recovery';
  initialReferralCode?: string;
  onAuthenticated: () => void;
  onRecoveryCompleted?: () => void;
  onOpenAdmin: () => void;
}

const COUNTRY_CODES = ['+91', '+1', '+44', '+971', '+65', '+61'];
const LANGUAGES = ['ENG', 'HIN', 'ESP'];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  settings,
  initialMode = 'login',
  initialReferralCode = '',
  onAuthenticated,
  onRecoveryCompleted,
  onOpenAdmin,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'recovery'>(initialMode);
  const [language, setLanguage] = useState<string>(settings.defaultLanguage || 'ENG');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState(initialReferralCode);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (initialMode === 'recovery') {
      setMode('recovery');
      setError(null);
      setSuccess('Verify your new login password below to complete account recovery.');
    }
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if ((mode === 'login' || mode === 'register') && !acceptedTerms) {
      setError('Please accept the Terms & Conditions to continue.');
      return;
    }

    if (mode === 'register') {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        setError('Enter a valid mobile number (7 to 15 digits).');
        return;
      }
      if (password.length < 6) {
        setError('Login password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Login passwords do not match.');
        return;
      }
    }

    if (mode === 'recovery') {
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithSupabase(email, password);
        onAuthenticated();
      } else if (mode === 'register') {
        const res = await signUpWithSupabase({
          email,
          countryCode,
          phone,
          password,
          invitationCode,
        });
        if (res.hasSession) {
          onAuthenticated();
        } else if (res.needsEmailConfirmation) {
          setSuccess(
            'Account created! Please check your email inbox to confirm your address, then sign in.'
          );
          setPassword('');
          setConfirmPassword('');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(email);
        setSuccess(
          'Password reset link sent! Check your email inbox and open the link to set a new password.'
        );
      } else if (mode === 'recovery') {
        await updateSupabasePassword(password);
        setSuccess('Your login password has been updated.');
        setPassword('');
        setConfirmPassword('');
        onRecoveryCompleted?.();
        onAuthenticated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mahendra-page-bg flex flex-col items-center justify-start md:justify-center md:py-8 md:px-4">
      <div className="w-full max-w-[460px] md:max-w-[500px] bg-white md:rounded-[28px] md:shadow-xl md:border md:border-[#D5EFE0] overflow-hidden min-h-screen md:min-h-0 flex flex-col">
        {/* Top Banner + Language Chip + Center Emblem */}
        <HeroPromotionalBanner
          siteName={settings.siteName}
          headline="Premium Surfaces for Modern Spaces"
          subtitle="Structured · Transparent · Verifiable"
          centerBadge
          rightSlot={
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const idx = LANGUAGES.indexOf(language);
                  setLanguage(LANGUAGES[(idx + 1) % LANGUAGES.length]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 shadow-sm border border-[#CBEBD7] text-xs font-bold text-[#005B32] cursor-pointer min-h-[36px]"
              >
                <Globe className="w-3.5 h-3.5 text-[#008C45]" />
                <span>{language}</span>
              </button>
            </div>
          }
        />

        {/* White rounded-t sheet */}
        <div className="-mt-4 relative z-10 bg-white rounded-t-[28px] px-5 sm:px-7 pt-6 pb-8 flex-1 flex flex-col">
          {/* Header Row: Title + Segmented Sign In / Sign Up */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="font-display font-extrabold text-2xl text-[#007A3D] tracking-tight">
              {mode === 'login'
                ? 'Login'
                : mode === 'register'
                  ? 'Register'
                  : mode === 'forgot'
                    ? 'Forgot Password'
                    : 'Set New Password'}
            </h2>

            {mode !== 'recovery' && (
              <div className="inline-flex items-center p-1 rounded-full bg-[#E7F7EE] border border-[#CCEAD9]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    mode === 'login'
                      ? 'brand-gradient text-white shadow-sm'
                      : 'text-[#446151] hover:text-[#005B32]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    mode === 'register'
                      ? 'brand-gradient text-white shadow-sm'
                      : 'text-[#446151] hover:text-[#005B32]'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#E7F7EE] border border-[#A7DEC0] text-xs font-medium text-[#005B32]">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Address (for Login, Register, Forgot Password) */}
            {mode !== 'recovery' && (
              <div className="flex items-center gap-2.5 px-3.5 h-12 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0] focus-within:border-[#008C45] focus-within:ring-2 focus-within:ring-[#008C45]/15 transition">
                <Mail className="w-4 h-4 text-[#008C45] shrink-0" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Email Address"
                  required
                  className="w-full bg-transparent text-sm text-[#17231C] placeholder:text-[#829B8D] focus:outline-none"
                />
              </div>
            )}

            {/* Mobile Number with Country Code Selector (Register) */}
            {mode === 'register' && (
              <div className="flex items-center gap-2.5 px-3.5 h-12 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0] focus-within:border-[#008C45] focus-within:ring-2 focus-within:ring-[#008C45]/15 transition">
                <Phone className="w-4 h-4 text-[#008C45] shrink-0" />
                <select
                  aria-label="Country code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="bg-transparent text-sm font-bold text-[#17231C] pr-1.5 border-r border-[#CBE4D5] focus:outline-none cursor-pointer"
                >
                  {COUNTRY_CODES.map((cc) => (
                    <option key={cc} value={cc}>
                      {cc}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 15))}
                  placeholder="Enter Phone Number"
                  required
                  className="w-full bg-transparent text-sm text-[#17231C] placeholder:text-[#829B8D] focus:outline-none"
                />
              </div>
            )}

            {/* Password (Login, Register, Recovery) */}
            {mode !== 'forgot' && (
              <div className="flex items-center gap-2.5 px-3.5 h-12 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0] focus-within:border-[#008C45] focus-within:ring-2 focus-within:ring-[#008C45]/15 transition">
                <Lock className="w-4 h-4 text-[#008C45] shrink-0" />
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'login'
                      ? 'Enter your password'
                      : mode === 'register'
                        ? 'Create New Password (6+ chars)'
                        : 'Enter New Login Password (6+ chars)'
                  }
                  required
                  className="w-full bg-transparent text-sm text-[#17231C] placeholder:text-[#829B8D] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label="Toggle password visibility"
                  className="text-[#5E8C72] hover:text-[#005B32] p-1 cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {(mode === 'register' || mode === 'recovery') && (
              <div className="flex items-center gap-2.5 px-3.5 h-12 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0] focus-within:border-[#008C45] focus-within:ring-2 focus-within:ring-[#008C45]/15 transition">
                <Lock className="w-4 h-4 text-[#008C45] shrink-0" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  required
                  className="w-full bg-transparent text-sm text-[#17231C] placeholder:text-[#829B8D] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label="Toggle confirm password visibility"
                  className="text-[#5E8C72] hover:text-[#005B32] p-1 cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div className="flex items-center gap-2.5 px-3.5 h-12 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0] focus-within:border-[#008C45] focus-within:ring-2 focus-within:ring-[#008C45]/15 transition">
                <UserPlus className="w-4 h-4 text-[#008C45] shrink-0" />
                <input
                  type="text"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  placeholder="Enter Invitation Code (Optional)"
                  className="w-full bg-transparent text-sm text-[#17231C] placeholder:text-[#829B8D] focus:outline-none uppercase"
                />
              </div>
            )}

            {/* Terms + Forgot Password row */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {mode === 'login' || mode === 'register' ? (
                <label className="inline-flex items-center gap-2 text-xs text-[#344A3E] cursor-pointer select-none">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={acceptedTerms}
                    onClick={() => setAcceptedTerms((v) => !v)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 cursor-pointer ${
                      acceptedTerms
                        ? 'bg-[#008C45] border-[#008C45] text-white'
                        : 'bg-white border-[#B9D9C6] text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>
                  <span>
                    {mode === 'login' ? 'By logging in you agree to the ' : 'I agree to the '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-[#008C45] font-semibold underline cursor-pointer"
                    >
                      Terms & Conditions
                    </button>
                  </span>
                </label>
              ) : (
                <span className="text-xs text-[#5B7265]">
                  {mode === 'forgot'
                    ? 'We will email you a secure password reset link'
                    : 'Choose a strong password (6+ characters)'}
                </span>
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs font-semibold text-[#008C45] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-12 rounded-full brand-gradient text-white font-display font-bold text-base shadow-lg shadow-[#008C45]/25 hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Login Now'
                  : mode === 'register'
                    ? 'Register Now'
                    : mode === 'forgot'
                      ? 'Send Reset Link'
                      : 'Update Password'}
            </button>
          </form>

          {/* Bottom switch links */}
          {mode !== 'recovery' && (
            <div className="mt-5 text-center text-xs text-[#5E7468]">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-bold text-[#008C45] hover:underline cursor-pointer"
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="font-bold text-[#008C45] hover:underline cursor-pointer"
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          )}

          <div className="mt-auto pt-6 flex items-center justify-between gap-2 border-t border-[#EBF6EF] text-[11px] text-[#6B8275]">
            <span>{settings.siteName} Capital</span>
            <div className="flex items-center gap-3">
              <a
                href={TELEGRAM_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={`Official Support: ${TELEGRAM_SUPPORT_USERNAME}`}
                className="font-semibold text-[#008C45] hover:underline"
              >
                Telegram Support
              </a>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="font-semibold text-[#006B35] hover:underline cursor-pointer"
              >
                Admin Portal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-[#D5EFE0]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-base text-[#17231C]">Terms & Disclosure</h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="p-1.5 rounded-lg text-[#5A7264] hover:bg-[#F4FAF7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-[#42594C] whitespace-pre-line">
              {settings.termsText}
            </p>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl brand-gradient text-white text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
