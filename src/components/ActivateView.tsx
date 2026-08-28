import React, { useState } from 'react';
import { Loader2, Mail, Link as LinkIcon, CheckCircle, AlertCircle, Lock, Send, Video, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../lib/api';

// Telegram SVG Icon
function TelegramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .33z" />
    </svg>
  );
}

export default function ActivateView({ 
  accountInfo, 
  infoLoading, 
  activatableCount, 
  onUpdate 
}: { 
  accountInfo: any; 
  infoLoading: boolean; 
  activatableCount: number; 
  onUpdate?: () => void; 
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Placeholder for video link which user can provide later
  const videoTutorialUrl = "https://t.me/levil_ft_sushitrash";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await authFetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.status) {
        setSuccess(data.message || 'Verification link sent. Check your inbox.');
        setStep(2);
      } else {
        setError(data.error?.message || data.message || 'Failed to send email.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !link) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await authFetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, link })
      });
      const data = await res.json();
      if (data.status) {
        setSuccess('Verification successful! Premium account active.');
        setStep(1); setEmail(''); setLink('');
        if (onUpdate) onUpdate(); // Refresh user count
      } else {
        setError(data.error?.message || data.message || 'Verification failed.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-md mx-auto pb-20">
      {/* Action Buttons: "ဆက်သွယ်ရန်" (Telegram) & "Sign in link ယူနည်း" (Video guide) */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href="https://t.me/levil_ft_sushitrash"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-[#388bfd]/50 rounded-xl text-xs font-semibold text-white shadow-sm transition-all group"
        >
          <div className="w-5 h-5 rounded-full bg-[#2AABEE]/20 flex items-center justify-center text-[#2AABEE] group-hover:scale-110 transition-transform">
            <TelegramIcon className="w-3.5 h-3.5 text-[#2AABEE]" />
          </div>
          <span>ဆက်သွယ်ရန်</span>
        </a>

        <button
          type="button"
          onClick={() => setShowVideoModal(true)}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-green-500/50 rounded-xl text-xs font-semibold text-white shadow-sm transition-all group"
        >
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
            <Video className="w-3.5 h-3.5 text-green-400" />
          </div>
          <span>Sign in link ယူနည်း</span>
        </button>
      </div>

      {activatableCount <= 0 && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3 text-sm text-red-400 shadow-sm">
          <Lock className="w-5 h-5 shrink-0" />
          <p>You have 0 Activations remaining. Please purchase more or redeem a reward before activating an account.</p>
        </div>
      )}

      {/* Main Activation Card */}
      <div className={`bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden relative shadow-sm ${activatableCount <= 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex border-b border-[#30363d]">
          <button onClick={() => setStep(1)} className={`flex-1 py-3 text-sm font-medium transition-colors ${step === 1 ? 'text-white border-b-2 border-green-500 bg-[#0d1117]' : 'text-gray-500 hover:text-gray-300'}`}>
            1. Send
          </button>
          <button onClick={() => setStep(2)} className={`flex-1 py-3 text-sm font-medium transition-colors ${step === 2 ? 'text-white border-b-2 border-green-500 bg-[#0d1117]' : 'text-gray-500 hover:text-gray-300'}`}>
            2. Verify
          </button>
        </div>
        <div className="p-5 sm:p-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 text-sm text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex gap-3 text-sm text-green-400">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <p>{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {step === 1 ? (
            <motion.form key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">AM Account Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="block w-full pl-10 pr-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={loading || !email} className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0d1117] bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#161b22] focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Link"}
              </button>
            </motion.form>
          ) : (
            <motion.form key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">AM Account Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="block w-full pl-10 pr-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Verification Link</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <input type="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://alight-creative.firebaseapp.com/..." className="block w-full pl-10 pr-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={loading || !email || !link} className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0d1117] bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#161b22] focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Activate (Costs 1)"}
              </button>
            </motion.form>
          )}
        </div>
      </div>

      {/* Video Modal / Popup Dialog */}
      <AnimatePresence>
        {showVideoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Sign in link ယူနည်း</h3>
                  <p className="text-xs text-gray-400">Video & အဆင့်ဆင့် လမ်းညွှန်</p>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3.5 space-y-2 text-xs text-gray-300">
                <p>၁။ Email ထည့်ပြီး Send Link နှိပ်ပါ။</p>
                <p>၂။ သင့် Gmail ထဲသို့ ရောက်လာသော Alight Motion Email ထဲရှိ <strong>"Sign In"</strong> ခလုတ်ကို ဖိထားပြီး <strong>"Copy URL"</strong> ယူပါ။</p>
                <p>၃။ AutoMotion ၏ Step 2 တွင် Paste လုပ်ပြီး Verify & Activate နှိပ်ပါ။</p>
              </div>

              <div className="space-y-2 pt-1">
                <a
                  href={videoTutorialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-green-500 hover:bg-green-400 text-[#0d1117] font-bold rounded-xl text-xs transition-colors"
                >
                  <span>Telegram Video လင့်ခ် ကြည့်ရန်</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => setShowVideoModal(false)}
                  className="w-full py-2.5 px-4 bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-medium rounded-xl text-xs transition-colors"
                >
                  ပိတ်မည် (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
