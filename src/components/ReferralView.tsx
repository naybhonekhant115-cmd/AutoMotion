import React, { useState } from 'react';
import { Gift, Copy, Loader2, CheckCircle, AlertCircle, Users, Sparkles, Check, Clock, UserPlus, ArrowRight, ChevronDown, ChevronUp, ShieldCheck, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../lib/api';
import { UserData, ReferralBatch } from '../types';

export default function ReferralView({ user, onUpdate }: { user: UserData; onUpdate?: () => void }) {
  const [loadingRedeem, setLoadingRedeem] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const currentRefCode = user?.refCode || '';
  const batches: ReferralBatch[] = user?.referralBatches || [];
  const activeBatch = batches.find(b => b.code === currentRefCode) || batches[0] || {
    code: currentRefCode,
    createdAt: new Date().toISOString(),
    users: [],
    status: 'active',
    rewardClaimed: false
  };

  const currentSlots = activeBatch.users || [];
  const hasPurchasedInBatch = currentSlots.some(u => u.hasPurchased);
  const purchases = user?.purchases || 0;
  const rewards = user?.rewardsToClaim || 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentRefCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRedeem = async () => {
    setLoadingRedeem(true);
    try {
      const res = await authFetch('/api/redeem', { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRedeem(false);
    }
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setLoadingApply(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const res = await authFetch('/api/referral/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode.trim() })
      });
      const data = await res.json();
      if (data.status) {
        setApplySuccess(data.message || 'Referral code applied successfully!');
        setInputCode('');
        if (onUpdate) onUpdate();
      } else {
        setApplyError(data.message || 'Failed to apply referral code.');
      }
    } catch (err: any) {
      setApplyError(err.message || 'Network error applying code.');
    } finally {
      setLoadingApply(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5 pb-24">
      {/* Header Banner */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
        <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Gift className="w-6 h-6 text-purple-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Two-Way Referral Program</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
          Share your code with up to 3 friends. When any 1 of them makes their first purchase, you earn <span className="text-green-400 font-semibold">+1 Free Activation</span>, and every friend who uses your code gets a <span className="text-blue-400 font-semibold">10% OFF discount</span>!
        </p>
      </div>

      {/* Rewards Ready to Redeem Notification */}
      {rewards > 0 && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="bg-gradient-to-r from-green-500/15 via-green-500/10 to-blue-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-green-500/5"
        >
          <div>
            <div className="text-green-400 font-bold text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>{rewards} Reward{rewards > 1 ? 's' : ''} Ready!</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Convert directly to available activations.</div>
          </div>
          <button 
            onClick={handleRedeem} 
            disabled={loadingRedeem} 
            className="px-4 py-2 bg-green-500 hover:bg-green-400 text-[#0d1117] font-bold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {loadingRedeem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Redeem Now"}
          </button>
        </motion.div>
      )}

      {/* Active Referral Code Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Your Active Referral Code</h3>
          </div>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-md">
            Batch: {currentSlots.length}/3 slots
          </span>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-lg font-mono font-bold text-white tracking-wider">{currentRefCode}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">3-User Limit</span>
          </div>
          <button 
            onClick={handleCopy} 
            className={`px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-sm font-medium ${
              copied 
                ? 'bg-green-500 text-[#0d1117]' 
                : 'bg-[#21262d] hover:bg-[#30363d] text-gray-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span className="text-xs">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-xs">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* 3 Slots Visualizer */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Current Code Group (3 People Max)</span>
            <span className={hasPurchasedInBatch ? 'text-green-400 font-medium' : 'text-yellow-400'}>
              {hasPurchasedInBatch ? '✓ 1+ Purchase Completed' : 'Waiting for 1 purchase'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => {
              const member = currentSlots[index];
              return (
                <div 
                  key={index} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center min-h-[82px] transition-all ${
                    member 
                      ? member.hasPurchased
                        ? 'bg-green-500/5 border-green-500/30 text-white'
                        : 'bg-[#0d1117] border-[#30363d] text-gray-300'
                      : 'border-dashed border-[#30363d] bg-transparent text-gray-600'
                  }`}
                >
                  {member ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-1 text-[10px] font-bold text-white">
                        {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="text-[11px] font-medium truncate max-w-full px-1">
                        {member.name ? member.name.split(' ')[0] : 'Friend'}
                      </div>
                      <div className="mt-1">
                        {member.hasPurchased ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-green-400 font-semibold">
                            <Check className="w-2.5 h-2.5" /> Bought
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-yellow-500">
                            <Clock className="w-2.5 h-2.5" /> Joined
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5 text-gray-600 mb-1" />
                      <span className="text-[10px] text-gray-500">Slot {index + 1} Open</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-gray-500 pt-1 leading-normal">
            💡 Once 3 friends join this code, AutoMotion automatically creates a new referral code for you so you can invite the next 3 friends!
          </p>
        </div>
      </div>

      {/* Enter Friend's Referral Code Section (Two-Way Perk) */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-white">Have a Friend's Referral Code?</h3>

        {user?.referredBy ? (
          <div className="p-3 bg-[#0d1117] border border-green-500/20 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Referred by {user.referredBy.inviterName}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Code used: <span className="font-mono text-gray-300 font-semibold">{user.referredBy.code}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md font-bold flex items-center gap-1">
                <Tag className="w-3 h-3" /> 10% OFF Active
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleApplyCode} className="space-y-3">
            <p className="text-xs text-gray-400">
              Apply an inviter's referral code to instantly get <span className="text-green-400 font-semibold">10% OFF discount (4,500 Ks instead of 5,000 Ks)</span> on your purchases!
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="e.g. AM-XXXXX"
                className="flex-1 px-3.5 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={loadingApply || !inputCode.trim()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
              >
                {loadingApply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><span>Apply</span><ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>

            <AnimatePresence>
              {applyError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{applyError}</span>
                </motion.div>
              )}
              {applySuccess && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl flex gap-2 text-xs text-green-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{applySuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </div>

      {/* Loyalty Purchase Progress */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-white">Loyalty Purchase Progress</h3>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400">Purchases ({purchases % 2}/2)</span>
            <span className="text-blue-400 font-medium">
              {purchases > 0 && purchases % 2 === 0 ? 'Reward Ready!' : `${2 - (purchases % 2)} more to next reward`}
            </span>
          </div>
          <div className="w-full h-2 bg-[#0d1117] rounded-full overflow-hidden border border-[#30363d]">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500" 
              style={{ width: `${((purchases % 2) / 2) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Past Referral Batches History */}
      {batches.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-sm">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span>All Referral Codes History ({batches.length})</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="p-4 pt-0 border-t border-[#30363d] space-y-3">
              {batches.map((batch, bIdx) => (
                <div key={batch.code + bIdx} className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">{batch.code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      batch.rewardClaimed 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : batch.users.length >= 3 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      {batch.rewardClaimed ? 'Rewarded ✓' : batch.users.length >= 3 ? 'Filled (3/3)' : `Active (${batch.users.length}/3)`}
                    </span>
                  </div>

                  {batch.users.length === 0 ? (
                    <div className="text-[11px] text-gray-500 italic">No users joined under this code yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {batch.users.map((u, uIdx) => (
                        <div key={u.userId + uIdx} className="flex items-center justify-between text-[11px] text-gray-300 bg-[#161b22] px-2.5 py-1.5 rounded-lg">
                          <span>{u.name}</span>
                          <span className={u.hasPurchased ? 'text-green-400 font-semibold' : 'text-gray-500'}>
                            {u.hasPurchased ? '✓ Purchased' : 'Joined'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
