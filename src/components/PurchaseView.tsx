import React, { useState, useRef, useEffect } from 'react';
import { Copy, Upload, CheckCircle, AlertCircle, Loader2, History, CreditCard as CardIcon, Clock, XCircle, Tag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../lib/api';
import { UserData } from '../types';

export default function PurchaseView({ user, onPurchaseSuccess }: { user?: UserData; onPurchaseSuccess?: () => void }) {
  const [view, setView] = useState<'buy' | 'history'>('buy');
  const [digits, setDigits] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasReferralDiscount = Boolean(user?.referredBy);
  const standardPrice = 5000;
  const discountedPrice = 4500; // 10% off
  const finalPrice = hasReferralDiscount ? discountedPrice : standardPrice;

  useEffect(() => {
    if (view === 'history') {
      fetchOrders();
    }
  }, [view]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await authFetch('/api/orders');
      const data = await res.json();
      if (data.status) {
        setOrders(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!digits || digits.length !== 5 || !image) {
      setError("Please provide both the screenshot and the 5-digit code.");
      return;
    }
    
    setLoading(true); setError(null); setSuccess(null);
    
    try {
      const res = await authFetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digits, imageBase64: image })
      });
      const data = await res.json();
      
      if (data.status) {
        setSuccess("Order submitted successfully! Admin will verify it shortly. (Note: Simulated approval takes 10s)");
        setDigits('');
        setImage(null);
        if (onPurchaseSuccess) onPurchaseSuccess();
      } else {
        setError(data.message || 'Failed to submit order.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 pb-20">
      <div className="flex bg-[#161b22] border border-[#30363d] rounded-2xl p-1 shadow-sm">
        <button 
          onClick={() => setView('buy')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${view === 'buy' ? 'bg-[#0d1117] text-white border border-[#30363d]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <CardIcon className="w-4 h-4" /> Buy
        </button>
        <button 
          onClick={() => setView('history')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${view === 'history' ? 'bg-[#0d1117] text-white border border-[#30363d]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <History className="w-4 h-4" /> Order History
        </button>
      </div>

      {view === 'buy' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
            {hasReferralDiscount && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-300 text-xs font-semibold mb-2">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>10% Referral Discount Applied</span>
              </div>
            )}
            
            <h2 className="text-xl font-bold text-white mb-1">Buy Activation</h2>
            
            <div className="flex items-center justify-center gap-2 mt-1">
              {hasReferralDiscount ? (
                <>
                  <span className="text-gray-500 line-through font-mono text-sm">5,000 Ks</span>
                  <span className="text-green-400 font-mono text-xl font-bold">4,500 Ks</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-green-500/15 border border-green-500/30 text-green-400 rounded-md">
                    -10% OFF
                  </span>
                </>
              ) : (
                <p className="text-green-400 font-mono text-lg font-semibold">5,000 Ks / each</p>
              )}
            </div>

            {hasReferralDiscount && user?.referredBy && (
              <p className="text-xs text-gray-400 mt-2">
                Special 10% discount courtesy of <strong className="text-white">{user.referredBy.inviterName}</strong>'s referral code.
              </p>
            )}
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Payment Methods</h3>
              <span className="text-xs text-gray-400 font-mono">Amount: <span className="text-green-400 font-bold">{finalPrice.toLocaleString()} Ks</span></span>
            </div>
            
            {/* KBZ Pay */}
            <div className="bg-[#0d1117] rounded-xl p-4 border border-[#30363d] flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-400 font-semibold mb-1">KBZ Pay</div>
                <div className="text-white text-sm">Account Name: Min Naing</div>
                <div className="text-gray-400 text-sm font-mono mt-1">09447173023</div>
              </div>
              <button onClick={() => handleCopy('09447173023')} className="p-2 bg-[#21262d] hover:bg-[#30363d] rounded-lg transition-colors text-gray-400 hover:text-white">
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Wave Pay */}
            <div className="bg-[#0d1117] rounded-xl p-4 border border-[#30363d] flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-500 font-semibold mb-1">Wave Pay</div>
                <div className="text-white text-sm">Account Name: Daw Kyaing</div>
                <div className="text-gray-400 text-sm font-mono mt-1">09447173023</div>
              </div>
              <button onClick={() => handleCopy('09447173023')} className="p-2 bg-[#21262d] hover:bg-[#30363d] rounded-lg transition-colors text-gray-400 hover:text-white">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm space-y-5">
            <h3 className="text-sm font-medium text-gray-300">Confirm Payment</h3>
            
            <AnimatePresence mode="wait">
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 text-sm text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex gap-3 text-sm text-green-400">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <p>{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs text-gray-400 mb-2">Upload Screenshot</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-[#30363d] hover:border-green-500/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0d1117] overflow-hidden"
              >
                {image ? (
                  <img src={image} alt="Receipt" className="h-full object-contain" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-500 mb-2" />
                    <span className="text-sm text-gray-500">Tap to upload receipt</span>
                  </>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">Last 5 Digits of Transaction</label>
              <input
                type="text"
                required
                maxLength={5}
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 12345"
                className="block w-full px-4 py-3 bg-[#0d1117] border border-[#30363d] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-center text-xl tracking-widest font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !image || digits.length !== 5}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0d1117] bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#161b22] focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Submit Payment (${finalPrice.toLocaleString()} Ks)`}
            </button>
          </form>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">Your Recent Orders</h3>
            <button onClick={fetchOrders} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
          </div>
          
          {loadingOrders ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500">No orders found.</div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="text-sm font-bold text-white mb-1 font-mono">{order.id}</div>
                    <div className="text-xs text-gray-500">{new Date(order.date).toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">Digits: <span className="font-mono text-gray-300">{order.digits}</span></div>
                  </div>
                  <div>
                    {order.status === 'pending' && <span className="flex items-center gap-1.5 text-yellow-500 text-xs font-medium bg-yellow-500/10 px-2 py-1 rounded-full border border-yellow-500/20"><Clock className="w-3 h-3" /> Pending</span>}
                    {order.status === 'approved' && <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20"><CheckCircle className="w-3 h-3" /> Approved</span>}
                    {order.status === 'rejected' && <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20"><XCircle className="w-3 h-3" /> Rejected</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
