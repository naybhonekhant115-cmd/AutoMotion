import React from 'react';
import { User, LogOut, ShieldCheck, Mail, Sparkles, Gift } from 'lucide-react';
import { clearAuthToken } from '../lib/api';

interface ProfileViewProps {
  user: any;
  onLogout: () => void;
}

export default function ProfileView({ user, onLogout }: ProfileViewProps) {
  const handleLogout = () => {
    clearAuthToken();
    onLogout();
  };

  const isGoogle = user?.provider === 'google' || user?.email?.includes('@');

  return (
    <div className="w-full max-w-md mx-auto space-y-6 pb-20">
      {/* Profile Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        <div className="relative mb-4">
          {user?.picture ? (
            <img 
              src={user.picture} 
              alt={user?.name || 'User'} 
              className="w-20 h-20 rounded-full border-2 border-green-500/40 object-cover shadow-md"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 bg-[#0d1117] border-2 border-[#30363d] rounded-full flex items-center justify-center shadow-inner">
              <User className="w-10 h-10 text-gray-400" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0d1117] rounded-full border border-[#30363d] flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-bold text-white">
              G
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-0.5">{user?.name || 'Google User'}</h2>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <Mail className="w-3.5 h-3.5 text-gray-500" />
          <span>{user?.email || 'user@gmail.com'}</span>
        </div>
        
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verified Google Account</span>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Available Activations</span>
          </div>
          <span className="text-green-400 font-mono font-bold text-base">{user?.activatableCount ?? 0}</span>
        </div>

        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <span className="text-sm text-gray-300">Total Purchases</span>
          <span className="text-white font-mono font-bold">{user?.purchases || 0}</span>
        </div>

        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <span className="text-sm text-gray-300">Total Referrals</span>
          <span className="text-white font-mono font-bold">{user?.referrals || 0}</span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">Rewards Claimed</span>
          </div>
          <span className="text-white font-mono font-bold">{user?.rewardsToClaim || 0}</span>
        </div>
      </div>

      {/* Logout Button */}
      <button 
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/20 active:scale-[0.99]"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">Log Out</span>
      </button>
    </div>
  );
}
