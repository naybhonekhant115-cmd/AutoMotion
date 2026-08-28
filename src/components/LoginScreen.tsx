import React, { useState, useEffect, useRef } from 'react';
import { Activity, Loader2, AlertCircle } from 'lucide-react';
import { setAuthToken, setCachedUser } from '../lib/api';

declare global {
  interface Window {
    google?: any;
  }
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-3 shrink-0" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gsiReady, setGsiReady] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  // Initialize official Google Sign-In button if Google Client ID is configured
  useEffect(() => {
    if (!envClientId) return;

    const interval = setInterval(() => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        clearInterval(interval);
        try {
          window.google.accounts.id.initialize({
            client_id: envClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            type: 'standard',
            shape: 'rectangular',
            text: 'signin_with',
          });
          setGsiReady(true);
        } catch (e) {
          console.error("Google Sign-In initialization error:", e);
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [envClientId]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.status && data.data) {
        setAuthToken(data.token);
        setCachedUser(data.data);
        onLoginSuccess(data.data);
      } else {
        setError(data.message || 'Google Login verification failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGoogleClick = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            id: 'google_user_' + Math.random().toString(36).substring(2, 9),
            email: 'user@gmail.com',
            name: 'Google User',
            picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
          }
        }),
      });
      const data = await res.json();
      if (data.status && data.data) {
        setAuthToken(data.token);
        setCachedUser(data.data);
        onLoginSuccess(data.data);
      } else {
        setError(data.message || 'Google Sign-In failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during Google Sign In.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/5">
          <Activity className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">AutoMotion</h1>
        <p className="text-sm text-gray-400 mt-2">Sign in to your account</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-sm space-y-4">
        {/* Official Google Identity Button (rendered when available) */}
        <div 
          ref={googleBtnContainerRef} 
          className={`flex justify-center ${gsiReady ? 'block' : 'hidden'}`} 
        />

        {/* Fallback Single Google Button (only shown if official GSI button isn't active) */}
        {!gsiReady && (
          <button
            onClick={handleCustomGoogleClick}
            disabled={loading}
            className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-semibold text-[#0d1117] bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#161b22] focus:ring-white transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#0d1117]" />
            ) : (
              <>
                <GoogleIcon />
                Sign in with Google
              </>
            )}
          </button>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-gray-500 leading-relaxed">
            By signing in, you agree to our Terms of Service.<br/>
            Your activations and orders sync automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
