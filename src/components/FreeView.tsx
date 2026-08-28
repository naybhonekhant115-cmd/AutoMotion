import React from 'react';
import { Gift, Users, CreditCard, Sparkles, CheckCircle2, Tag } from 'lucide-react';

export default function FreeView() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6 pb-20">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-sm text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Gift className="w-24 h-24 text-green-400" />
        </div>
        <div className="relative z-10">
          <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">အခမဲ့ & လျှော့စျေး အစီအစဉ်များ</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            AutoMotion တွင် အခမဲ့ Activation နှင့် ၁၀% Discount ရယူနိုင်သော အစီအစဉ်များ။
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Method 1: Two-Way Referrals */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">၁။ Two-Way Referral စနစ်</h3>
              <p className="text-xs text-purple-400 font-medium mt-0.5">၃ ယောက်ဖိတ်ပြီး ၁ ယောက်ဝယ်ယူတိုင်း အခမဲ့ ၁ ကြိမ် ရယူပါ</p>
            </div>
          </div>
          
          <ul className="space-y-2.5 text-xs text-gray-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>သင့် Referral Code တစ်ခုလျှင် သူငယ်ချင်း (၃) ယောက်အထိ အသုံးပြုနိုင်ပါသည်။</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>ဖိတ်ခေါ်ထားသော (၃) ယောက်ထဲမှ အနည်းဆုံး (၁) ယောက်က ပထမဆုံး အကြိမ် ဝယ်ယူပြီးသည်နှင့် သင်သည် <strong className="text-green-400">အခမဲ့ (၁) ကြိမ်</strong> ရရှိပါမည်။</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span><strong className="text-blue-400">၁၀% Discount အထူးခံစားခွင့်:</strong> Referral Code အသုံးပြုသော User တိုင်းအတွက် Activation ဝယ်ယူရာတွင် ၁၀% လျှော့စျေး (၅,၀၀၀ ကျပ်အစား <strong>၄,၅၀၀ ကျပ်</strong>) ဖြင့် ဝယ်ယူခွင့် ရရှိပါမည်။</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Code တစ်ခု လူ (၃) ယောက်ပြည့်ပါက စနစ်မှ သင့်အတွက် Referral Code အသစ်တစ်ခု အလိုအလျောက် ထပ်မံထုတ်ပေးပါသည်။</span>
            </li>
          </ul>
        </div>

        {/* Method 2: Purchases */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">၂။ ပုံမှန်ဝယ်ယူမှု လက်ဆောင်အစီအစဉ်</h3>
              <p className="text-xs text-blue-400 font-medium mt-0.5">၂ ကြိမ် ဝယ်ယူတိုင်း အခမဲ့ ၁ ကြိမ် ရရှိမည်</p>
            </div>
          </div>
          <ul className="space-y-2.5 text-xs text-gray-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>စနစ်ထဲမှ Activation (၂) ကြိမ် ဝယ်ယူပြီးတိုင်း နောက်ထပ် (၁) ကြိမ်ကို အလိုအလျောက် Reward အဖြစ် ရရှိပါမည်။</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>ရရှိလာသော Reward များကို Refer tab ထဲတွင် Redeem ပြုလုပ်ပြီး ချက်ချင်း အသုံးပြုနိုင်ပါသည်။</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
