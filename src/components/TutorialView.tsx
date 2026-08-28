import React, { useState } from 'react';
import { BookOpen, Key, CreditCard, Users, Gift, ChevronDown, ChevronUp, HelpCircle, CheckCircle, Smartphone, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FAQItem {
  id: string;
  icon: any;
  titleBurmese: string;
  badge?: string;
  contentBurmese: React.ReactNode;
}

export default function TutorialView() {
  const [openIds, setOpenIds] = useState<string[]>(['activate', 'order', 'referral']);

  const toggleTopic = (id: string) => {
    setOpenIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const tutorials: FAQItem[] = [
    {
      id: 'overview',
      icon: Sparkles,
      titleBurmese: 'AutoMotion ဆိုတာ ဘာလဲ?',
      badge: 'အကျဉ်းချုပ်',
      contentBurmese: (
        <div className="space-y-2.5 text-xs text-gray-300 leading-relaxed">
          <p>
            <strong className="text-white">AutoMotion</strong> သည် Alight Motion App အတွက် အကောင့်ဖွင့်ခြင်းနှင့် Premium Activation ပြုလုပ်ခြင်းများကို လွယ်ကူလျင်မြန်စွာ အလိုအလျောက် ဆောင်ရွက်ပေးနိုင်သော ဝန်ဆောင်မှု App ဖြစ်ပါသည်။
          </p>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d] space-y-1.5 text-gray-400">
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> အချိန်ကုန်သက်သာပြီး ချက်ချင်းအသုံးပြုနိုင်ခြင်း
            </div>
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> အော်ဒါများ & Activation များကို စနစ်တကျ မှတ်တမ်းတင်ထားရှိခြင်း
            </div>
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Two-Way Referral & Discount အစီအစဉ်များ ပါဝင်ခြင်း
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'activate',
      icon: Key,
      titleBurmese: 'Alight Motion အကောင့် အသက်သွင်းနည်း (How to Activate)',
      badge: 'အဓိက အဆင့်များ',
      contentBurmese: (
        <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
          <p className="text-gray-400">
            သင့်အကောင့်တွင် <span className="text-green-400 font-bold">Available Activation</span> အနည်းဆုံး (၁) ကြိမ် ရှိထားရပါမည်။
          </p>
          
          <div className="space-y-2">
            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex gap-3">
              <span className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs shrink-0">၁</span>
              <div>
                <strong className="text-white block mb-0.5">အဆင့် (၁) - အီးမေးလ် ထည့်သွင်းပြီး Link ပို့ပါ</strong>
                <span>Home tab တွင် သင် Activate ပြုလုပ်လိုသော Alight Motion အီးမေးလ်လိပ်စာကို ရိုက်ထည့်ပြီး <strong>"Send Link"</strong> ခလုတ်ကို နှိပ်ပါ။</span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex gap-3">
              <span className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs shrink-0">၂</span>
              <div>
                <strong className="text-white block mb-0.5">အဆင့် (၂) - Gmail တွင် ရောက်လာသော Link ကို Copy ယူပါ</strong>
                <span>သင့် Gmail ထဲသို့ Alight Motion မှ ရောက်ရှိလာသော Sign-in Link (သို့မဟုတ် Verify URL) ကို Copy ယူပါ။</span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex gap-3">
              <span className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs shrink-0">၃</span>
              <div>
                <strong className="text-white block mb-0.5">အဆင့် (၃) - Link ကို Paste လုပ်ပြီး Activate လုပ်ပါ</strong>
                <span>Copy ယူလာသော Link ကို Step 2 အကွက်ထဲတွင် ထည့်ပြီး <strong>"Verify & Activate"</strong> ကို နှိပ်လိုက်သည်နှင့် ချက်ချင်း အောင်မြင်စွာ အသက်သွင်းပြီး ဖြစ်ပါမည်။</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'order',
      icon: CreditCard,
      titleBurmese: 'Activation ဝယ်ယူနည်း (How to Order)',
      badge: 'KBZPay / WavePay',
      contentBurmese: (
        <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
          <p>
            Activation တစ်ကြိမ်လျှင် ပုံမှန်စျေးနှုန်း <strong className="text-green-400 font-mono">5,000 Ks</strong> ဖြစ်ပြီး၊ Referral Code အသုံးပြုထားပါက <strong className="text-green-400 font-mono">4,500 Ks (10% OFF)</strong> ဖြင့် ဝယ်ယူနိုင်ပါသည်။
          </p>

          <div className="space-y-2">
            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">၁</span>
              <div>
                <strong className="text-white block mb-0.5">ငွေလွှဲခြင်း</strong>
                <span><strong>Order tab</strong> သို့ သွား၍ KBZPay သို့မဟုတ် WavePay နံပါတ်သို့ ငွေလွှဲပေးပို့ပါ။</span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">၂</span>
              <div>
                <strong className="text-white block mb-0.5">စလစ်ပုံ & နောက်ဆုံး ၅ လုံး ထည့်သွင်းခြင်း</strong>
                <span>ငွေလွှဲပြေစာ Screenshot ပုံကို Upload တင်ပြီး Transaction စဉ်နံပါတ်၏ <strong>နောက်ဆုံး ဂဏန်း (၅) လုံး</strong> ကို ရိုက်ထည့်ကာ Confirm နှိပ်ပါ။</span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">၃</span>
              <div>
                <strong className="text-white block mb-0.5">အတည်ပြုခြင်း</strong>
                <span>Admin မှ စစ်ဆေးအတည်ပြုပြီးသည်နှင့် သင့်အကောင့်ထဲသို့ Available Activation (+1) ချက်ချင်း ရောက်ရှိလာပါမည်။</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'referral',
      icon: Users,
      titleBurmese: 'Two-Way Referral စနစ် အသုံးပြုနည်း (How to Refer)',
      badge: '10% Discount & Free Gift',
      contentBurmese: (
        <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
          <p>
            သူငယ်ချင်းများကို ဖိတ်ခေါ်ပြီး နှစ်ဦးနှစ်ဖက် အကျိုးခံစားခွင့် ရယူနိုင်သော စနစ်ဖြစ်ပါသည်။
          </p>

          <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3.5 space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
              <span><strong>Code တစ်ခုလျှင် လူ ၃ ယောက်ကန့်သတ်ချက်:</strong> သင့် Referral Code တစ်ခုကို အများဆုံး လူ (၃) ယောက် အသုံးပြုနိုင်ပါသည်။</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
              <span><strong>အခမဲ့ ၁ ကြိမ် ရရှိခြင်း (Inviter):</strong> ဖိတ်ခေါ်ထားသော သူငယ်ချင်း (၃) ယောက်ထဲမှ အနည်းဆုံး (၁) ယောက်က ပထမဆုံး အကြိမ် အော်ဒါဝယ်ယူသည်နှင့် သင့်ထံသို့ <strong className="text-green-400 font-semibold">+1 Free Activation Reward</strong> ရရှိပါမည်။</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
              <span><strong>၁၀% လျှော့စျေး (Invitee):</strong> သင့် Code ကို အသုံးပြုထားသော သူငယ်ချင်းတိုင်းသည် Activation ဝယ်ယူရာတွင် <strong className="text-blue-400 font-semibold">၁၀% လျှော့စျေး (၄,၅၀၀ Ks)</strong> ဖြင့် အမြဲဝယ်ယူခွင့် ရရှိပါမည်။</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
              <span><strong>Code အသစ် အလိုအလျောက် ထုတ်ပေးခြင်း:</strong> လူ (၃) ယောက် ပြည့်သွားပါက စနစ်မှ သင့်အတွက် Referral Code အသစ်တစ်ခုကို အလိုအလျောက် ထပ်မံထုတ်ပေးပါသည်။</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'rewards',
      icon: Gift,
      titleBurmese: 'အခမဲ့ Activation Reward များကို မည်သို့ Redeem ပြုလုပ်ရမလဲ?',
      badge: 'Redeem Guide',
      contentBurmese: (
        <div className="space-y-2.5 text-xs text-gray-300 leading-relaxed">
          <p>
            Referral အောင်မြင်မှုများ သို့မဟုတ် ဝယ်ယူမှု (၂) ကြိမ်ပြည့်တိုင်း ရရှိလာသော Rewards များကို <strong>Refer tab</strong> ထိပ်တွင် ပြသပေးပါသည်။
          </p>
          <div className="p-3 bg-[#0d1117] border border-green-500/20 rounded-xl">
            <span className="text-green-400 font-semibold block mb-1">💡 Redeem လုပ်နည်း:</span>
            <span>Reward Ready ဖြစ်နေသည့်အခါ <strong>"Redeem Now"</strong> ခလုတ်ကို နှိပ်လိုက်ရုံဖြင့် သင်၏ Available Activation အရေအတွက်ထဲသို့ ချက်ချင်း +1 ပေါင်းထည့်ပေးပါမည်။</span>
          </div>
        </div>
      )
    },
    {
      id: 'faq',
      icon: HelpCircle,
      titleBurmese: 'မကြာခဏ မေးလေ့ရှိသော မေးခွန်းများ (FAQ)',
      contentBurmese: (
        <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
          <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
            <strong className="text-white block mb-1">မေး - အကောင့်ဖွင့်ဖွင့်ချင်း အခမဲ့ Activation ရရှိပါသလား?</strong>
            <span className="text-gray-400">ဖြေ - မရရှိပါ။ အကောင့်စဖွင့်ချိန်တွင် Available Activation (၀) ကြိမ် ဖြစ်ပြီး၊ Referral ပြုလုပ်ခြင်း သို့မဟုတ် Order တင်ဝယ်ယူခြင်းဖြင့်သာ Activation ရယူနိုင်ပါသည်။</span>
          </div>

          <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
            <strong className="text-white block mb-1">မေး - အော်ဒါတင်ပြီးရင် အတည်ပြုဖို့ ဘယ်လောက်စောင့်ရမလဲ?</strong>
            <span className="text-gray-400">ဖြေ - ပုံမှန်အားဖြင့် Admin မှ စက္ကန့်ပိုင်းအတွင်း အတည်ပြုပေးပါသည်။ စနစ်ထဲတွင်လည်း မိမိ အော်ဒါအခြေအနေကို Order History တွင် ကြည့်ရှုနိုင်ပါသည်။</span>
          </div>

          <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
            <strong className="text-white block mb-1">မေး - သူငယ်ချင်း Code ကို ဘယ်နေရာမှာ ထည့်ရမလဲ?</strong>
            <span className="text-gray-400">ဖြေ - <strong>Refer tab</strong> ထဲရှိ <em>"Have a Friend's Referral Code?"</em> အကွက်တွင် ရိုက်ထည့်၍ <strong>Apply</strong> နှိပ်နိုင်ပါသည်။ အောင်မြင်ပါက ဝယ်ယူရာတွင် ၁၀% လျှော့စျေး ချက်ချင်း ရရှိပါမည်။</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-md mx-auto space-y-5 pb-24">
      {/* Header Banner */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
        <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-6 h-6 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">AutoMotion အသုံးပြုနည်းလမ်းညွှန်</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
          အကောင့်အသက်သွင်းနည်း၊ အော်ဒါဝယ်ယူနည်းနှင့် Referral စနစ် အသုံးပြုပုံများကို အသေးစိတ် ဖတ်ရှုနိုင်ပါသည်။
        </p>
      </div>

      {/* Accordion Topics List */}
      <div className="space-y-3">
        {tutorials.map((item) => {
          const isOpen = openIds.includes(item.id);
          const Icon = item.icon;

          return (
            <div 
              key={item.id}
              className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-sm transition-all"
            >
              <button
                onClick={() => toggleTopic(item.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1f242c]/50 transition-colors"
              >
                <div className="flex items-center gap-3 pr-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isOpen ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-[#0d1117] text-gray-400 border border-[#30363d]'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white leading-tight">
                      {item.titleBurmese}
                    </h3>
                    {item.badge && (
                      <span className="inline-block text-[10px] font-medium text-green-400/90 mt-0.5">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-gray-400 ml-2">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-4 pt-1 border-t border-[#30363d]/60 bg-[#161b22]/40">
                      {item.contentBurmese}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
