import React from 'react';
import { Bot, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center space-y-6 shadow-xl">
        
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
          <Bot className="w-10 h-10 text-green-400" />
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">AutoMotion is now a Telegram Bot!</h1>
          <p className="text-gray-400 text-sm">
            We have completely migrated this web application into a fully-functional Telegram Bot. 
            All features, including buying activations, verifying accounts, and the referral system, are now handled directly through Telegram.
          </p>
        </div>

        <div className="space-y-3 bg-[#0d1117] border border-[#30363d] p-4 rounded-xl text-left">
          <h3 className="font-semibold text-sm text-gray-200">How to use it on your VPS:</h3>
          <ul className="text-xs text-gray-400 space-y-2">
            <li className="flex gap-2 items-start">
              <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
              <span>Make sure <code className="bg-[#161b22] px-1 rounded">TELEGRAM_BOT_TOKEN</code> is set in your <code className="bg-[#161b22] px-1 rounded">.env</code> file.</span>
            </li>
            <li className="flex gap-2 items-start">
              <Zap className="w-4 h-4 text-green-400 shrink-0" />
              <span>Start the server with <code className="bg-[#161b22] px-1 rounded">npm run dev</code> or via PM2.</span>
            </li>
            <li className="flex gap-2 items-start">
              <ExternalLink className="w-4 h-4 text-green-400 shrink-0" />
              <span>Open Telegram and search for your Bot's username to start using it!</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
