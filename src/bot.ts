// @ts-ignore
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';

export interface ReferredUser {
  id: string;
  hasPurchased: boolean;
}

export interface ReferralBatch {
  code: string;
  users: ReferredUser[];
  rewardClaimed: boolean;
}

export interface UserProfile {
  id: string; // Telegram Chat ID
  name: string;
  language?: 'en' | 'my';
  activatableCount: number;
  activatedCount: number;
  referralCode: string;
  invitedBy: string | null;
  referralBatches: ReferralBatch[] | number; // Support legacy number and new array
  orders: Order[];
  refCode?: string; // Legacy
  isReseller?: boolean;
  resellerExpiry?: number; // timestamp in ms (30 days per sub)
}

export interface Order {
  id: string;
  date: string;
  amount: number;
  activations: number;
  status: 'pending' | 'approved' | 'rejected';
  telegramMessageId?: number; // Store message ID for admin approval
  type?: 'activation' | 'activations' | 'reseller_sub' | 'reseller_activations';
  months?: number;
}

export interface LedgerRecord {
  id: string;
  type: 'activation' | 'referral_reward' | 'purchase';
  amount: number;
  description: string;
  date: string;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  testers: string[]; // up to 3 Telegram user IDs
  requiredChannel?: string; // e.g. "@AutoMotionChannel" or "-100123456789"
  backupChannel?: string; // e.g. "@AutoMotionBackups" or "-100123456789"
  subscriptionEndDate?: string; // e.g. "August 2, 2027 (12 Months)"
  normalPrice1?: number; // default 5,000 Ks
  normalPrice5?: number; // default 20,000 Ks
  resellerSubPrice?: number; // default 10,000 Ks
}

const DB_FILE = path.join(process.cwd(), 'database.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (e) {}
}

const loadDB = (): { 
  transactions: Set<string>; 
  users: Record<string, UserProfile>; 
  ledger: LedgerRecord[];
  settings: SystemSettings;
} => {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return {
        transactions: new Set<string>(data.transactions || []),
        users: data.users || {},
        ledger: data.ledger || [],
        settings: {
          maintenanceMode: !!data.settings?.maintenanceMode,
          testers: Array.isArray(data.settings?.testers) ? data.settings.testers.slice(0, 3) : [],
          requiredChannel: data.settings?.requiredChannel || process.env.TELEGRAM_REQUIRED_CHANNEL || '',
          backupChannel: data.settings?.backupChannel || process.env.TELEGRAM_BACKUP_CHANNEL || '',
          subscriptionEndDate: data.settings?.subscriptionEndDate || 'August 2, 2027 (12 Months)',
          normalPrice1: typeof data.settings?.normalPrice1 === 'number' ? data.settings.normalPrice1 : 5000,
          normalPrice5: typeof data.settings?.normalPrice5 === 'number' ? data.settings.normalPrice5 : 20000,
          resellerSubPrice: typeof data.settings?.resellerSubPrice === 'number' ? data.settings.resellerSubPrice : 10000
        }
      };
    } catch (e) {
      console.error("Failed to load db.json, starting fresh", e);
    }
  }
  return {
    transactions: new Set<string>(),
    users: {},
    ledger: [],
    settings: {
      maintenanceMode: false,
      testers: [],
      requiredChannel: process.env.TELEGRAM_REQUIRED_CHANNEL || '',
      backupChannel: process.env.TELEGRAM_BACKUP_CHANNEL || '',
      subscriptionEndDate: 'August 2, 2027 (12 Months)',
      normalPrice1: 5000,
      normalPrice5: 20000,
      resellerSubPrice: 10000
    }
  };
};

const db = loadDB();

const saveDB = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      transactions: Array.from(db.transactions),
      users: db.users,
      ledger: db.ledger,
      settings: db.settings
    }, null, 2));
  } catch (e) {
    console.error("Failed to save db.json", e);
  }
};

const isCodeTaken = (code: string): boolean => {
  return Object.values(db.users).some(u => u.referralCode === code || u.refCode === code);
};

const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = Array.from({ length: 6 }).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  } while (isCodeTaken(code));
  return code;
};

const getUser = (chatId: number, name: string): UserProfile => {
  const id = chatId.toString();
  let user = db.users[id];
  
  if (!user) {
    user = {
      id,
      name,
      activatableCount: 0,
      activatedCount: 0,
      referralCode: generateReferralCode(),
      invitedBy: null,
      referralBatches: [],
      orders: []
    };
    db.users[id] = user;
    saveDB();
  }

  // Migrate legacy string or number referralBatches
  if (typeof user.referralBatches === 'number' || !Array.isArray(user.referralBatches)) {
    user.referralBatches = [{
      code: user.referralCode || user.refCode || generateReferralCode(),
      users: [],
      rewardClaimed: false
    }];
    saveDB();
  }
  
  return user;
};

const applyImportedDatabase = (importedData: any): { success: boolean; usersCount: number; ordersCount: number; error?: string } => {
  try {
    if (!importedData || typeof importedData !== 'object') {
      return { success: false, usersCount: 0, ordersCount: 0, error: 'Invalid JSON root object' };
    }
    if (!importedData.users || typeof importedData.users !== 'object') {
      return { success: false, usersCount: 0, ordersCount: 0, error: 'Missing or invalid users object in database JSON' };
    }

    db.transactions = new Set<string>(Array.isArray(importedData.transactions) ? importedData.transactions : []);
    db.users = importedData.users || {};
    db.ledger = Array.isArray(importedData.ledger) ? importedData.ledger : [];
    
    if (importedData.settings && typeof importedData.settings === 'object') {
      db.settings = {
        maintenanceMode: !!importedData.settings.maintenanceMode,
        testers: Array.isArray(importedData.settings.testers) ? importedData.settings.testers.slice(0, 3) : db.settings.testers,
        requiredChannel: importedData.settings.requiredChannel !== undefined ? importedData.settings.requiredChannel : db.settings.requiredChannel,
        backupChannel: importedData.settings.backupChannel !== undefined ? importedData.settings.backupChannel : db.settings.backupChannel,
        subscriptionEndDate: importedData.settings.subscriptionEndDate || db.settings.subscriptionEndDate,
        normalPrice1: typeof importedData.settings.normalPrice1 === 'number' ? importedData.settings.normalPrice1 : db.settings.normalPrice1,
        normalPrice5: typeof importedData.settings.normalPrice5 === 'number' ? importedData.settings.normalPrice5 : db.settings.normalPrice5,
        resellerSubPrice: typeof importedData.settings.resellerSubPrice === 'number' ? importedData.settings.resellerSubPrice : db.settings.resellerSubPrice
      };
    }

    saveDB();

    const usersCount = Object.keys(db.users).length;
    let ordersCount = 0;
    Object.values(db.users).forEach(u => {
      ordersCount += (u.orders || []).length;
    });

    return { success: true, usersCount, ordersCount };
  } catch (err: any) {
    return { success: false, usersCount: 0, ordersCount: 0, error: err?.message || 'Unknown import error' };
  }
};

interface BotState {
  step: 'IDLE' 
    | 'AWAITING_AMOUNT_SELECTION' 
    | 'AWAITING_SLIP_AMOUNT' 
    | 'AWAITING_AM_EMAIL' 
    | 'AWAITING_AM_LINK' 
    | 'AWAITING_PAYMENT_SLIP' 
    | 'AWAITING_TRANSACTION_ID' 
    | 'AWAITING_TESTER_ID' 
    | 'AWAITING_CHANNEL_INPUT' 
    | 'AWAITING_BACKUP_CHANNEL_INPUT'
    | 'AWAITING_SUB_DATE_INPUT'
    | 'AWAITING_NORMAL_PRICE_INPUT'
    | 'AWAITING_DB_IMPORT_FILE';
  data?: any;
}
const userStates: Record<number, BotState> = {};
const pendingImportPayloads: Record<string, { sourceName: string; summaryText: string; data: any; createdAt: number }> = {};

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN is missing. Bot cannot start.");
    return;
  }

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const API_KEY = process.env.DIYY_API_KEY;
  const API_URL = "https://api.diyymotion.biz.id";

  const bot = new TelegramBot(token, { polling: true });

  const getMyanmarDateInfo = () => {
    const now = new Date();
    const mmtDateStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Yangon',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(now);

    const formatterHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Yangon',
      hour: 'numeric',
      hour12: false
    });
    const hour = parseInt(formatterHour.format(now), 10);

    const formatterDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon'
    });
    const dateKey = formatterDate.format(now);

    return { dateKey, hour, mmtDateStr };
  };

  const sendDatabaseBackupToChannel = async (reason: string = "Scheduled Backup", targetChatId?: number | string) => {
    const destination = targetChatId || db.settings?.backupChannel || process.env.TELEGRAM_BACKUP_CHANNEL;
    if (!destination) {
      console.warn("[Backup] No backup channel configured.");
      return { success: false, error: "No backup channel configured" };
    }

    if (!fs.existsSync(DB_FILE)) {
      console.warn("[Backup] database.json file not found.");
      return { success: false, error: "database.json not found" };
    }

    const { mmtDateStr } = getMyanmarDateInfo();
    const totalUsers = Object.keys(db.users).length;
    let totalOrders = 0;
    let totalRevenue = 0;
    let activeResellersCount = 0;

    Object.values(db.users).forEach(u => {
      if (isUserReseller(u)) activeResellersCount++;
      (u.orders || []).forEach(o => {
        totalOrders++;
        if (o.status === 'approved') totalRevenue += o.amount;
      });
    });

    const caption = `📦 **AutoMotion Database Backup**\n\n` +
      `📅 **Myanmar Time (MMT):** \`${mmtDateStr}\`\n` +
      `👥 **Total Users:** ${totalUsers}\n` +
      `💼 **Active Resellers:** ${activeResellersCount}\n` +
      `🛒 **Total Orders:** ${totalOrders}\n` +
      `💰 **Total Revenue:** ${totalRevenue.toLocaleString()} Ks\n\n` +
      `⚡ **Trigger:** ${reason}`;

    try {
      const backupFilename = `database_backup_${Date.now()}.json`;
      // Also save local backup copy for offline / instant restore
      try {
        fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, backupFilename));
        // Keep at most 50 recent backups in BACKUP_DIR
        const existingFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
        if (existingFiles.length > 50) {
          existingFiles.slice(0, existingFiles.length - 50).forEach(oldF => {
            try { fs.unlinkSync(path.join(BACKUP_DIR, oldF)); } catch (e) {}
          });
        }
      } catch (e) {}

      await bot.sendDocument(destination, fs.createReadStream(DB_FILE), {
        caption,
        parse_mode: 'Markdown'
      }, {
        filename: backupFilename,
        contentType: 'application/json'
      });
      console.log(`[Backup] Successfully sent database backup to ${destination} (${reason})`);
      return { success: true, filename: backupFilename };
    } catch (err: any) {
      console.error(`[Backup] Failed to send database backup to ${destination}:`, err?.message || err);
      return { success: false, error: err?.message || "Send failed" };
    }
  };

  let lastBackupSlotKey = "";

  const checkAndRunAutoBackup = () => {
    const { dateKey, hour } = getMyanmarDateInfo();
    // Myanmar Day time (6AM - 12AM): every 2 hours (6, 8, 10, 12, 14, 16, 18, 20, 22)
    // Myanmar Night time (12AM - 6AM): every 3 hours (0/Midnight, 3, 6)
    const SCHEDULED_HOURS = [0, 3, 6, 8, 10, 12, 14, 16, 18, 20, 22];

    if (SCHEDULED_HOURS.includes(hour)) {
      const slotKey = `${dateKey}_H${hour}`;
      if (lastBackupSlotKey !== slotKey) {
        lastBackupSlotKey = slotKey;
        const intervalDesc = (hour === 0 || hour === 3)
          ? "Myanmar Night Time (3-Hour Interval: 12AM - 6AM)"
          : "Myanmar Day Time (2-Hour Interval: 6AM - 12AM)";
        sendDatabaseBackupToChannel(`Scheduled Backup - ${intervalDesc}`);
      }
    }
  };

  // Run auto backup check every 30 seconds
  setInterval(checkAndRunAutoBackup, 30 * 1000);

  const isUserReseller = (user: UserProfile): boolean => {
    if (!user.isReseller) return false;
    if (!user.resellerExpiry) return false;
    return user.resellerExpiry > Date.now();
  };

  const getNormalPrice = (amount: number): number => {
    const p1 = typeof db.settings?.normalPrice1 === 'number' ? db.settings.normalPrice1 : 5000;
    const p5 = typeof db.settings?.normalPrice5 === 'number' ? db.settings.normalPrice5 : 20000;
    if (amount === 1) return p1;
    if (amount === 2) return p1 * 2;
    if (amount === 5) return p5;
    if (amount === 10) return p5 * 2;
    return amount * p1;
  };

  const getResellerPrice = (amount: number): number => {
    if (amount === 1) return 1500;
    if (amount === 5) return 5000; // 1,000 each (Total 5,000 Ks)
    if (amount === 10) return 5000; // 500 each (Total 5,000 Ks)
    return amount * 1500;
  };

  const isAuthorizedUser = (chatId: number | string): boolean => {
    const idStr = chatId.toString();
    if (adminChatId && idStr === adminChatId) return true;
    if (db.settings?.testers && db.settings.testers.includes(idStr)) return true;
    return false;
  };

  const checkUserJoinedChannel = async (userId: number | string): Promise<boolean> => {
    const channel = db.settings?.requiredChannel?.trim();
    if (!channel) return true; // No channel requirement configured

    // Admins and testers bypass channel check
    if (isAuthorizedUser(userId)) return true;

    try {
      const member = await bot.getChatMember(channel, typeof userId === 'string' ? parseInt(userId) : userId);
      // Valid joined statuses: 'creator', 'administrator', 'member', 'restricted' (if still present in chat)
      if (['creator', 'administrator', 'member', 'restricted'].includes(member.status)) {
        return true;
      }
      return false;
    } catch (e: any) {
      console.error(`Error checking chat member for user ${userId} in ${channel}:`, e?.message || e);
      // If bot is not admin or channel is invalid, don't break the user experience
      return true;
    }
  };

  const sendJoinChannelPrompt = (chatId: number, lang: 'en' | 'my' = 'my', retryParam?: string) => {
    const channel = db.settings?.requiredChannel?.trim();
    if (!channel) {
      sendMainMenu(chatId, lang);
      return;
    }

    const channelUsername = channel.startsWith('@') ? channel.substring(1) : channel;
    const channelUrl = channel.startsWith('@') 
      ? `https://t.me/${channelUsername}`
      : channel.startsWith('http') 
        ? channel 
        : `https://t.me/${channelUsername}`;

    const text = lang === 'my'
      ? `📢 **Bot ကို အသုံးမပြုမီ ကျွန်ုပ်တို့၏ Telegram Channel သို့ Join ပေးပါခင်ဗျာ။**\n\nChannel သို့ Join ပြီးပါက အောက်ပါ **"✅ Joined ပြီးပါပြီ (Check)"** ခလုတ်ကို နှိပ်၍ ဆက်လက်အသုံးပြုနိုင်ပါသည်။`
      : `📢 **Please join our official Telegram Channel to use this bot.**\n\nAfter joining the channel, click the **"✅ I Have Joined (Check)"** button below to continue.`;

    const joinBtnText = lang === 'my' ? '📢 Join Channel' : '📢 Join Channel';
    const checkBtnText = lang === 'my' ? '✅ Joined ပြီးပါပြီ (Check)' : '✅ I Have Joined (Check)';

    const inline_keyboard = [
      [{ text: joinBtnText, url: channelUrl }],
      [{ text: checkBtnText, callback_data: retryParam ? `check_join_${retryParam}` : 'check_join' }]
    ];

    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard }
    });
  };

  const sendMaintenanceNotice = (chatId: number, lang?: 'en' | 'my') => {
    let notice = '';
    if (lang === 'my') {
      notice = '🛠 **Bot ကို ပြုပြင်ထိန်းသိမ်းနေပါသည်။ မကြာမီ ပြန်လည်အသုံးပြုနိုင်ပါမည်။**\n\n_(Bot is in maintenance mode. Will be accessible soon.)_';
    } else if (lang === 'en') {
      notice = '🛠 **Bot is in maintenance mode. Will be accessible soon.**\n\n_(Bot ကို ပြုပြင်ထိန်းသိမ်းနေပါသည်။ မကြာမီ ပြန်လည်အသုံးပြုနိုင်ပါမည်။)_';
    } else {
      notice = '🛠 **Bot is in maintenance mode. Will be accessible soon.**\n\n🛠 **Bot ကို ပြုပြင်ထိန်းသိမ်းနေပါသည်။ မကြာမီ ပြန်လည်အသုံးပြုနိုင်ပါမည်။**';
    }
    bot.sendMessage(chatId, notice, { parse_mode: 'Markdown' });
  };

  const sendResellerPanel = (chatId: number, user: UserProfile, msgIdToEdit?: number) => {
    const lang = user.language || 'my';
    const isReseller = isUserReseller(user);
    const subPrice = db.settings?.resellerSubPrice || 10000;

    let text = '';
    const inline_keyboard: any[][] = [];

    if (!isReseller) {
      if (lang === 'my') {
        text = `💼 **Reseller Panel (လက်ကားရောင်းချသူများအတွက်)**\n\n` +
          `Reseller Subscription ဝယ်ယူထားသူများသည် Alight Motion Activations များကို အထူးသက်သာသော လက်ကားစျေးနှုန်းများဖြင့် ရယူနိုင်ပါသည်:\n\n` +
          `💰 **Reseller Subscription ကြေး:** တစ်လလျှင် **${subPrice.toLocaleString()} Ks** (ရက်ပေါင်း ၃၀)\n\n` +
          `🔥 **Reseller အထူးလက်ကားစျေးနှုန်းများ:**\n` +
          `• 1 Activation = **1,500 Ks**\n` +
          `• 5 Bulk Activations = **5,000 Ks** (1 ခုလျှင် 1,000 Ks)\n` +
          `• 10 Bulk Activations = **5,000 Ks** (1 ခုလျှင် 500 Ks)\n\n` +
          `✨ Subscription စတင်ဝယ်ယူရန် အောက်ပါ **"💳 Reseller Sub ဝယ်ယူရန်"** ခလုတ်ကို နှိပ်ပါခင်ဗျာ။`;
      } else {
        text = `💼 **Reseller Panel (Wholesale Portal)**\n\n` +
          `Subscribed resellers get exclusive wholesale rates for Alight Motion activations:\n\n` +
          `💰 **Reseller Subscription Price:** **${subPrice.toLocaleString()} Ks / month** (30 Days)\n\n` +
          `🔥 **Exclusive Reseller Activation Rates:**\n` +
          `• 1 Activation = **1,500 Ks**\n` +
          `• 5 Bulk Activations = **5,000 Ks** (1,000 Ks each)\n` +
          `• 10 Bulk Activations = **5,000 Ks** (500 Ks each)\n\n` +
          `✨ Click **"💳 Buy Reseller Sub"** below to activate your reseller account.`;
      }

      inline_keyboard.push([
        { 
          text: lang === 'my' ? `💳 Reseller Sub ဝယ်ယူရန် (${subPrice.toLocaleString()} Ks)` : `💳 Buy Reseller Sub (${subPrice.toLocaleString()} Ks)`, 
          callback_data: 'buy_reseller_sub' 
        }
      ]);
    } else {
      const expiryDate = new Date(user.resellerExpiry!);
      const expiryFormatted = expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const daysLeft = Math.max(0, Math.ceil((user.resellerExpiry! - Date.now()) / (1000 * 60 * 60 * 24)));

      if (lang === 'my') {
        text = `💼 **Reseller Panel (Active 🟢)**\n\n` +
          `👑 **Reseller အကောင့် အခြေအနေ:** Active 🟢\n` +
          `⏳ **သက်တမ်းကုန်ဆုံးမည့်ရက်:** \`${expiryFormatted}\` (${daysLeft} ရက်ကျန်)\n\n` +
          `🔥 **သင့် Reseller လက်ကားစျေးနှုန်းများ:**\n` +
          `• 1 Activation = **1,500 Ks**\n` +
          `• 5 Bulk Activations = **5,000 Ks** (1,000 Ks each)\n` +
          `• 10 Bulk Activations = **5,000 Ks** (500 Ks each)\n\n` +
          `အောက်ပါခလုတ်များမှ ဝယ်ယူလိုသော Activation အရေအတွက်ကို ရွေးချယ်ပါ:`;
      } else {
        text = `💼 **Reseller Panel (Active 🟢)**\n\n` +
          `👑 **Reseller Status:** Active 🟢\n` +
          `⏳ **Subscription Expiry:** \`${expiryFormatted}\` (${daysLeft} days remaining)\n\n` +
          `🔥 **Your Reseller Wholesale Rates:**\n` +
          `• 1 Activation = **1,500 Ks**\n` +
          `• 5 Bulk Activations = **5,000 Ks** (1,000 Ks each)\n` +
          `• 10 Bulk Activations = **5,000 Ks** (500 Ks each)\n\n` +
          `Select the bulk activation package you want to purchase below:`;
      }

      inline_keyboard.push([
        { text: '🛒 1 Act (1,500 Ks)', callback_data: 'buy_reseller_act_1' },
        { text: '🛒 5 Acts (5,000 Ks)', callback_data: 'buy_reseller_act_5' }
      ]);
      inline_keyboard.push([
        { text: '🛒 10 Acts (5,000 Ks)', callback_data: 'buy_reseller_act_10' },
        { text: lang === 'my' ? '🔄 သက်တမ်းတိုးရန် (10,000 Ks)' : '🔄 Renew Sub (10,000 Ks)', callback_data: 'buy_reseller_sub' }
      ]);
    }

    inline_keyboard.push([
      { text: lang === 'my' ? '🔙 ပင်မစာမျက်နှာ' : '🔙 Main Menu', callback_data: 'back_to_main' }
    ]);

    if (msgIdToEdit) {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgIdToEdit,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard }
      }).catch(() => {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
      });
    } else {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
    }
  };

  const sendAdminDashboard = (chatId: number, msgIdToEdit?: number) => {
    const allUsers = Object.values(db.users);
    const totalUsers = allUsers.length;
    let totalOrders = 0;
    let pendingOrders = 0;
    let totalRevenue = 0;
    let activeResellersCount = 0;

    allUsers.forEach(u => {
      if (isUserReseller(u)) activeResellersCount++;
      u.orders.forEach(o => {
        totalOrders++;
        if (o.status === 'pending') pendingOrders++;
        if (o.status === 'approved') totalRevenue += o.amount;
      });
    });

    const isMaint = !!db.settings?.maintenanceMode;
    const maintStatus = isMaint ? "🔴 **ON** (Maintenance Active)" : "🟢 **OFF** (Public Normal)";
    const reqChannel = db.settings?.requiredChannel ? `\`${db.settings.requiredChannel}\`` : "_(None / Disabled)_";
    const bkpChannel = db.settings?.backupChannel ? `\`${db.settings.backupChannel}\`` : "_(None / Disabled)_";
    const subEndDate = db.settings?.subscriptionEndDate || "August 2, 2027 (12 Months)";
    const p1 = typeof db.settings?.normalPrice1 === 'number' ? db.settings.normalPrice1 : 5000;
    const p5 = typeof db.settings?.normalPrice5 === 'number' ? db.settings.normalPrice5 : 20000;

    const testers = db.settings?.testers || [];
    let testerSlotsText = "";
    for (let i = 0; i < 3; i++) {
      const tId = testers[i];
      if (tId) {
        const tUser = db.users[tId];
        const tName = tUser?.name ? ` (${tUser.name})` : "";
        testerSlotsText += `Slot ${i + 1}: \`${tId}\`${tName}\n`;
      } else {
        testerSlotsText += `Slot ${i + 1}: _[Empty Slot]_\n`;
      }
    }

    const text = `👑 **Admin Dashboard**\n\n` +
      `👥 **Total Users:** ${totalUsers}\n` +
      `💼 **Active Resellers:** ${activeResellersCount}\n` +
      `🛒 **Total Orders:** ${totalOrders}\n` +
      `⏳ **Pending Approvals:** ${pendingOrders}\n` +
      `💰 **Total Revenue:** ${totalRevenue.toLocaleString()} Ks\n\n` +
      `💵 **Normal Prices:** 1 Act = **${p1.toLocaleString()} Ks** | 5 Acts = **${p5.toLocaleString()} Ks**\n` +
      `🎁 *(10% Ref Disc: 1 Act = ${Math.round(p1 * 0.9).toLocaleString()} Ks | 5 Acts = ${Math.round(p5 * 0.9).toLocaleString()} Ks)*\n\n` +
      `📅 **Sub End Date:** \`${subEndDate}\`\n` +
      `🛠 **Maintenance Mode:** ${maintStatus}\n` +
      `📢 **Required Channel:** ${reqChannel}\n` +
      `📦 **Backup Channel:** ${bkpChannel}\n` +
      `⏰ **Auto-Backup Schedule (Myanmar Time):**\n` +
      `• Day Time (6AM - 12AM): Every 2 Hours (6, 8, 10, 12, 14, 16, 18, 20, 22)\n` +
      `• Night Time (12AM - 6AM): Every 3 Hours (0, 3, 6)\n\n` +
      `🧪 **Tester Slots (${testers.length}/3 used):**\n${testerSlotsText}\n` +
      `💵 *Set Normal Price:* \`/setprice <1_act_price> <5_acts_price>\`\n` +
      `💼 *Manage Reseller:* \`/addreseller <id> [days]\` or \`/removereseller <id>\`\n` +
      `📦 *Backup Channel:* \`/setbackupchannel @Channel\` or \`/backup\`\n` +
      `📥 *Import Database:* \`/importdb\`\n` +
      `📢 *Broadcast:* \`/broadcast <message>\`\n` +
      `📅 *Set Sub Date:* \`/setsubdate <Date (Duration)>\`\n` +
      `🛠 *Maintenance:* \`/maintenance on\` or \`/maintenance off\`\n` +
      `📢 *Set Channel:* \`/setchannel @ChannelName\` or \`/setchannel off\`\n` +
      `🧪 *Tester Commands:* \`/addtester <id>\` or \`/removetester <id>\``;

    const inline_keyboard: any[][] = [
      [
        {
          text: isMaint ? '🟢 Turn OFF Maintenance' : '🔴 Turn ON Maintenance',
          callback_data: 'admin_toggle_maint'
        },
        {
          text: '📅 Change Sub Date',
          callback_data: 'admin_prompt_set_sub_date'
        }
      ],
      [
        {
          text: `💵 Change Normal Prices`,
          callback_data: 'admin_prompt_change_prices'
        },
        {
          text: db.settings?.requiredChannel ? `📢 Channel (${db.settings.requiredChannel})` : '📢 Set Channel',
          callback_data: 'admin_prompt_set_channel'
        }
      ],
      [
        {
          text: db.settings?.backupChannel ? `📦 Backup Ch (${db.settings.backupChannel})` : '📦 Set Backup Channel',
          callback_data: 'admin_prompt_set_backup_channel'
        },
        {
          text: '⚡ Backup DB Now',
          callback_data: 'admin_backup_now'
        }
      ],
      [
        {
          text: '📥 Import Database',
          callback_data: 'admin_import_db_menu'
        }
      ]
    ];

    if (db.settings?.backupChannel) {
      inline_keyboard[2].push({
        text: '❌ Del Backup Ch',
        callback_data: 'admin_remove_backup_channel'
      });
    }

    if (db.settings?.requiredChannel) {
      inline_keyboard[1].push({
        text: '❌ Remove Channel',
        callback_data: 'admin_remove_channel'
      });
    }

    const testerButtons: any[] = [];
    if (testers.length < 3) {
      testerButtons.push({ text: `➕ Add Tester (${testers.length}/3)`, callback_data: 'admin_prompt_add_tester' });
    }
    if (testers.length > 0) {
      testerButtons.push({ text: '👥 Remove Testers', callback_data: 'admin_manage_testers' });
    }
    if (testerButtons.length > 0) {
      inline_keyboard.push(testerButtons);
    }

    inline_keyboard.push([{ text: '🔄 Refresh Dashboard', callback_data: 'admin_refresh_dashboard' }]);

    if (msgIdToEdit) {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgIdToEdit,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard }
      }).catch(() => {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
      });
    } else {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
    }
  };

  const getLatestLocalBackup = (): { filename: string; path: string; timeStr: string; sizeKb: number; data?: any } | null => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) return null;
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      if (files.length === 0) return null;
      files.sort((a, b) => {
        const timeA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
        const timeB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
        return timeB - timeA;
      });
      const latestName = files[0];
      const fullPath = path.join(BACKUP_DIR, latestName);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(content);
      const timeStr = new Date(stat.mtime).toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });
      return {
        filename: latestName,
        path: fullPath,
        timeStr,
        sizeKb: Math.round(stat.size / 1024),
        data: parsed
      };
    } catch (e) {
      return null;
    }
  };

  const sendImportDatabaseMenu = (chatId: number, msgIdToEdit?: number) => {
    const latest = getLatestLocalBackup();
    let text = `📥 **Import / Restore Database**\n\n` +
      `⚠️ **Important:** Restoring or importing a database will replace active user balances, orders, and ledger records.\n\n`;

    if (latest && latest.data) {
      const uCount = Object.keys(latest.data.users || {}).length;
      let oCount = 0;
      Object.values(latest.data.users || {}).forEach((u: any) => { oCount += (u.orders || []).length; });
      text += `📦 **Latest Available Backup:**\n` +
        `• File: \`${latest.filename}\`\n` +
        `• Time (MMT): \`${latest.timeStr}\`\n` +
        `• Users: **${uCount}** | Orders: **${oCount}**\n\n`;
    } else {
      text += `📦 **Latest Backup:** _No local backups found in cache. You can upload a .json file directly._\n\n`;
    }

    text += `Choose an import option below:`;

    const inline_keyboard: any[][] = [];

    if (latest) {
      inline_keyboard.push([{
        text: '⚡ Choose Latest Backup',
        callback_data: 'admin_import_choose_latest'
      }]);
    }

    inline_keyboard.push([
      {
        text: '📁 Upload JSON File',
        callback_data: 'admin_import_upload_file'
      }
    ]);

    inline_keyboard.push([
      {
        text: '🔙 Back to Dashboard',
        callback_data: 'admin_refresh_dashboard'
      }
    ]);

    if (msgIdToEdit) {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgIdToEdit,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard }
      }).catch(() => {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
      });
    } else {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
    }
  };

  const sendImportConfirmDialog = (
    chatId: number, 
    sourceName: string, 
    summaryText: string, 
    clicksRemaining: number, 
    importDataId: string, 
    msgIdToEdit?: number
  ) => {
    const stepNumber = 4 - clicksRemaining;
    let confirmPrompt = `🚨 **CONFIRM DATABASE IMPORT (Step ${stepNumber} of 3)**\n\n` +
      `📦 **Source:** \`${sourceName}\`\n` +
      `${summaryText}\n\n` +
      `⚠️ **Warning:** This action will replace live user records and orders!\n\n` +
      `🔒 **Triple-Confirmation Security:**\n` +
      `Please click the **Confirm** button **${clicksRemaining} more time${clicksRemaining > 1 ? 's' : ''}** to execute the import.`;

    const inline_keyboard = [
      [
        {
          text: `⚠️ Confirm Import (${clicksRemaining} Click${clicksRemaining > 1 ? 's' : ''} Left)`,
          callback_data: `admin_import_confirm_${clicksRemaining}_${importDataId}`
        }
      ],
      [
        {
          text: '❌ Cancel & Abort',
          callback_data: 'admin_import_cancel'
        }
      ]
    ];

    if (msgIdToEdit) {
      bot.editMessageText(confirmPrompt, {
        chat_id: chatId,
        message_id: msgIdToEdit,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard }
      }).catch(() => {
        bot.sendMessage(chatId, confirmPrompt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
      });
    } else {
      bot.sendMessage(chatId, confirmPrompt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
    }
  };

  const processReferral = (user: UserProfile, param: string, chatId: number) => {
    if (param && !user.invitedBy) {
      const inviter = Object.values(db.users).find(u => 
        Array.isArray(u.referralBatches) && u.referralBatches.some(b => b.code === param)
      );

      if (inviter && inviter.id !== user.id) {
        const batch = (inviter.referralBatches as ReferralBatch[]).find(b => b.code === param);
        
        if (batch && batch.users.length < 3) {
          batch.users.push({ id: user.id, hasPurchased: false });
          user.invitedBy = param;
          
          if (batch.users.length >= 3) {
             const newCode = generateReferralCode();
             inviter.referralCode = newCode;
             (inviter.referralBatches as ReferralBatch[]).push({ code: newCode, users: [], rewardClaimed: false });
             bot.sendMessage(parseInt(inviter.id), `🎉 Your referral code ${param} has been fully used (3/3 friends)! A new code ${newCode} has been generated for you.`);
          }
          saveDB();
          const lang = user.language || 'en';
          const successMsg = lang === 'my' ? `🎉 ${inviter.name} ၏ Referral Code ကို အသုံးပြုပြီးပါပြီ! ဝယ်ယူမှုတိုင်း 10% Discount ရပါမည်။` : `🎉 You used ${inviter.name}'s referral code! You'll get 10% off your purchases.`;
          bot.sendMessage(chatId, successMsg);
          
          const inviterLang = inviter.language || 'en';
          const inviterMsg = inviterLang === 'my' ? `🎉 ${user.name} သည် သင့် Referral ဖြင့် ဝင်ရောက်လာပါသည်! (${batch.users.length}/3)` : `🎉 ${user.name} just joined using your referral link! (${batch.users.length}/3)`;
          bot.sendMessage(parseInt(inviter.id), inviterMsg);
        } else {
          const errorMsg = user.language === 'my' ? `❌ ထို Referral Code သည် လူ ၃ ယောက် ပြည့်သွားပါပြီ။` : `❌ That referral code has already reached its 3-person limit.`;
          bot.sendMessage(chatId, errorMsg);
        }
      }
    }
  };

  const sendMainMenu = (chatId: number, lang: 'en' | 'my' = 'en') => {
    const welcomeText = lang === 'my'
      ? "👋 **AutoMotion Bot မှ ကြိုဆိုပါတယ်ခင်ဗျာ!**\n\n⚡ ဤ Bot မှတစ်ဆင့် **Alight Motion Premium** activation များကို လွယ်ကူလျင်မြန်စွာ ဝယ်ယူပြီး မိမိအကောင့်ကို တိုက်ရိုက် အသက်သွင်းနိုင်ပါသည်။\n\n📚 အသုံးပြုပုံအဆင့်ဆင့်ကို သိရှိလိုပါက အောက်ပါ **'📚 အသုံးပြုနည်း'** ခလုတ်ကို နှိပ်၍ လမ်းညွှန်များကို ဖတ်ရှုနိုင်ပါသည်။"
      : "👋 **Welcome to AutoMotion Bot!**\n\n⚡ With this bot, you can easily purchase **Alight Motion Premium** activations and activate your AM account quickly.\n\n📚 Click **'📚 Tutorial'** below to see step-by-step guides on how to use the bot, buy activations, and invite friends!";
    const keyboard = lang === 'my' ? [
      [{ text: '🛒 Activation ဝယ်ယူရန်' }, { text: '🚀 AM အသက်သွင်းရန်' }],
      [{ text: '💼 Reseller Panel' }, { text: '🎁 Referral အစီအစဥ်' }],
      [{ text: '👤 မိမိ အချက်အလက်' }, { text: '📚 အသုံးပြုနည်း' }],
      [{ text: '📞 Admin နှင့်ဆက်သွယ်ရန်' }, { text: '🌐 ဘာသာစကားပြောင်းရန်' }]
    ] : [
      [{ text: '🛒 Buy Activations' }, { text: '🚀 Activate AM Account' }],
      [{ text: '💼 Reseller Panel' }, { text: '🎁 Referral Program' }],
      [{ text: '👤 My Profile' }, { text: '📚 Tutorial' }],
      [{ text: '📞 Contact Admin' }, { text: '🌐 Change Language' }]
    ];

    if (chatId.toString() === adminChatId) {
      keyboard.push([{ text: '👑 Admin Dashboard' }]);
    }

    bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: { keyboard, resize_keyboard: true }
    });
  };

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = msg.from?.first_name || 'User';
    const user = getUser(chatId, name);
    const param = match?.[1]?.trim();

    // Check Maintenance Mode
    if (db.settings?.maintenanceMode && !isAuthorizedUser(chatId)) {
      sendMaintenanceNotice(chatId, user.language);
      return;
    }

    // Check if user has chosen a language first
    if (!user.language) {
      bot.sendMessage(chatId, "Please choose your language / ကျေးဇူးပြု၍ ဘာသာစကား ရွေးချယ်ပါ", {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇲🇲 မြန်မာ', callback_data: 'lang_my' }, { text: '🇬🇧 English', callback_data: 'lang_en' }]
          ]
        }
      });
      if (param) {
        userStates[chatId] = { step: 'IDLE', data: { refParam: param } };
      }
      return;
    }

    // Real Telegram API check for channel membership
    const hasJoined = await checkUserJoinedChannel(chatId);
    if (!hasJoined) {
      sendJoinChannelPrompt(chatId, user.language, param);
      return;
    }

    if (param) {
      processReferral(user, param, chatId);
    }

    sendMainMenu(chatId, user.language);
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const user = getUser(chatId, msg.from?.first_name || 'User');
    const state = userStates[chatId] || { step: 'IDLE' };

    // Check Maintenance Mode for regular users
    if (db.settings?.maintenanceMode && !isAuthorizedUser(chatId)) {
      if (!text.startsWith('/start')) {
        sendMaintenanceNotice(chatId, user.language);
      }
      return;
    }

    // Check Channel Membership for non-admin/testers before letting them use buttons or commands
    if (db.settings?.requiredChannel && !isAuthorizedUser(chatId)) {
      const hasJoined = await checkUserJoinedChannel(chatId);
      if (!hasJoined) {
        sendJoinChannelPrompt(chatId, user.language || 'my');
        return;
      }
    }

    // --- Admin: Awaiting Backup Channel Input ---
    if (chatId.toString() === adminChatId && state.step === 'AWAITING_BACKUP_CHANNEL_INPUT') {
      if (text === 'Order ပယ်ဖျက်ရန်' || text === '/cancel' || text.toLowerCase() === 'cancel') {
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "❌ Set backup channel cancelled.");
        sendAdminDashboard(chatId);
        return;
      }

      let backupInput = text.trim();
      if (backupInput.toLowerCase() === 'off' || backupInput.toLowerCase() === 'remove' || backupInput.toLowerCase() === 'disable') {
        db.settings.backupChannel = '';
        saveDB();
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "✅ Database backup channel has been **disabled**.");
        sendAdminDashboard(chatId);
        return;
      }

      if (!backupInput.startsWith('@') && !backupInput.startsWith('-100') && !backupInput.startsWith('https://t.me/')) {
        backupInput = `@${backupInput}`;
      }

      db.settings.backupChannel = backupInput;
      saveDB();
      userStates[chatId] = { step: 'IDLE' };
      bot.sendMessage(chatId, `✅ **Database Backup Channel Set!**\n\nChannel: \`${backupInput}\`\n\n⚠️ **Important:** Make sure to add this bot as an **Administrator** in your Telegram backup channel with permission to post messages/documents.\n\nTesting backup upload now...`, { parse_mode: 'Markdown' });
      
      // Test send immediately to verify permissions
      sendDatabaseBackupToChannel("Initial Backup Channel Verification Test").then(res => {
        if (res.success) {
          bot.sendMessage(chatId, `✅ **Backup Channel Test Succeeded!**\nFirst backup copy was successfully delivered to \`${backupInput}\`.`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, `⚠️ **Backup Channel Warning:**\nFailed to upload test backup to \`${backupInput}\` (${res.error}).\nPlease ensure the bot is added as an Admin in the channel.`, { parse_mode: 'Markdown' });
        }
      });

      sendAdminDashboard(chatId);
      return;
    }

    // --- Admin: Awaiting Channel Input ---
    if (chatId.toString() === adminChatId && state.step === 'AWAITING_CHANNEL_INPUT') {
      if (text === 'Order ပယ်ဖျက်ရန်' || text === '/cancel' || text.toLowerCase() === 'cancel') {
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "❌ Set required channel cancelled.");
        sendAdminDashboard(chatId);
        return;
      }

      let channelInput = text.trim();
      if (channelInput.toLowerCase() === 'off' || channelInput.toLowerCase() === 'remove' || channelInput.toLowerCase() === 'disable') {
        db.settings.requiredChannel = '';
        saveDB();
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "✅ Required channel requirement has been **disabled**.");
        sendAdminDashboard(chatId);
        return;
      }

      if (!channelInput.startsWith('@') && !channelInput.startsWith('-100') && !channelInput.startsWith('https://t.me/')) {
        channelInput = `@${channelInput}`;
      }

      db.settings.requiredChannel = channelInput;
      saveDB();
      userStates[chatId] = { step: 'IDLE' };
      bot.sendMessage(chatId, `✅ **Required Channel Set!**\n\nChannel: \`${channelInput}\`\n\n⚠️ **Important:** Make sure to add this bot as an **Administrator** in your Telegram channel with 'Invite Users' or standard admin permissions so Telegram allows the bot to verify memberships via \`getChatMember\`.`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // --- Admin: Awaiting Normal Price Input ---
    if (chatId.toString() === adminChatId && state.step === 'AWAITING_NORMAL_PRICE_INPUT') {
      if (text === 'Order ပယ်ဖျက်ရန်' || text === '/cancel' || text.toLowerCase() === 'cancel') {
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "❌ Change Prices cancelled.");
        sendAdminDashboard(chatId);
        return;
      }

      // Format expected: "5000 20000" or "1: 5000, 5: 20000" or "5000, 20000"
      const numbers = text.match(/\d+/g);
      if (!numbers || numbers.length < 2) {
        bot.sendMessage(chatId, "❌ Please provide 2 prices: price for 1 activation and price for 5 activations.\nExample: `5000 20000`\nOr type `/cancel` to cancel.", { parse_mode: 'Markdown' });
        return;
      }

      const p1 = parseInt(numbers[0]);
      const p5 = parseInt(numbers[1]);

      if (p1 <= 0 || p5 <= 0) {
        bot.sendMessage(chatId, "❌ Prices must be greater than 0.");
        return;
      }

      db.settings.normalPrice1 = p1;
      db.settings.normalPrice5 = p5;
      saveDB();
      userStates[chatId] = { step: 'IDLE' };

      const refP1 = Math.round(p1 * 0.9);
      const refP5 = Math.round(p5 * 0.9);

      bot.sendMessage(chatId, `✅ **Normal User Prices Updated!**\n\n• 1 Activation = **${p1.toLocaleString()} Ks** _(Ref 10%: ${refP1.toLocaleString()} Ks)_\n• 5 Activations = **${p5.toLocaleString()} Ks** _(Ref 10%: ${refP5.toLocaleString()} Ks)_\n\n*(Note: 2 Acts will be ${ (p1 * 2).toLocaleString() } Ks, 10 Acts will be ${ (p5 * 2).toLocaleString() } Ks. Reseller rates remain fixed.)*`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // --- Admin: Awaiting Subscription End Date Input ---
    if (chatId.toString() === adminChatId && state.step === 'AWAITING_SUB_DATE_INPUT') {
      if (text === 'Order ပယ်ဖျက်ရန်' || text === '/cancel' || text.toLowerCase() === 'cancel') {
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "❌ Change Subscription End Date cancelled.");
        sendAdminDashboard(chatId);
        return;
      }

      const newDate = text.trim();
      if (!newDate) {
        bot.sendMessage(chatId, "❌ Please enter a valid date or type `/cancel`.");
        return;
      }

      db.settings.subscriptionEndDate = newDate;
      saveDB();
      userStates[chatId] = { step: 'IDLE' };
      bot.sendMessage(chatId, `✅ **Subscription End Date Updated!**\n\nNew value:\n\`${newDate}\``, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // --- Admin: Awaiting Tester ID ---
    if (chatId.toString() === adminChatId && state.step === 'AWAITING_TESTER_ID') {
      if (text === 'Order ပယ်ဖျက်ရန်' || text === '/cancel' || text.toLowerCase() === 'cancel') {
        userStates[chatId] = { step: 'IDLE' };
        bot.sendMessage(chatId, "❌ Add tester cancelled.");
        sendAdminDashboard(chatId);
        return;
      }

      const targetId = text.trim();
      if (!/^\d+$/.test(targetId)) {
        bot.sendMessage(chatId, "❌ Invalid Telegram ID. Please enter numbers only (e.g. `123456789`) or send `/cancel`.", { parse_mode: 'Markdown' });
        return;
      }

      if (db.settings.testers.includes(targetId)) {
        bot.sendMessage(chatId, "⚠️ That Telegram ID is already registered as a tester.");
        return;
      }

      if (db.settings.testers.length >= 3) {
        bot.sendMessage(chatId, "❌ All 3 tester slots are already in use. Please remove a tester first.");
        userStates[chatId] = { step: 'IDLE' };
        sendAdminDashboard(chatId);
        return;
      }

      db.settings.testers.push(targetId);
      saveDB();
      userStates[chatId] = { step: 'IDLE' };

      const tUser = db.users[targetId];
      const tName = tUser?.name ? ` (${tUser.name})` : "";
      bot.sendMessage(chatId, `✅ **Tester Added to Slot #${db.settings.testers.length}!**\nTelegram ID: \`${targetId}\`${tName}\n\nThis tester can now access and use the bot normally even during Maintenance Mode.`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // --- Admin Commands ---
    if ((text === '/stats' || text === '👑 Admin Dashboard' || text === '/admin') && chatId.toString() === adminChatId) {
      sendAdminDashboard(chatId);
      return;
    }

    // Set Normal User Price Command: /setprice 5000 20000
    if (text.startsWith('/setprice') && chatId.toString() === adminChatId) {
      const numbers = text.replace('/setprice', '').match(/\d+/g);
      if (!numbers || numbers.length < 2) {
        bot.sendMessage(chatId, "❌ Usage: `/setprice <1_act_price> <5_acts_price>`\nExample: `/setprice 5000 20000`", { parse_mode: 'Markdown' });
        return;
      }
      const p1 = parseInt(numbers[0]);
      const p5 = parseInt(numbers[1]);
      db.settings.normalPrice1 = p1;
      db.settings.normalPrice5 = p5;
      saveDB();
      bot.sendMessage(chatId, `✅ **Prices Updated!**\n• 1 Act = **${p1.toLocaleString()} Ks** (Ref 10%: ${Math.round(p1 * 0.9).toLocaleString()} Ks)\n• 5 Acts = **${p5.toLocaleString()} Ks** (Ref 10%: ${Math.round(p5 * 0.9).toLocaleString()} Ks)`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // Add Reseller Command: /addreseller <id> [days]
    if (text.startsWith('/addreseller') && chatId.toString() === adminChatId) {
      const parts = text.replace('/addreseller', '').trim().split(/\s+/);
      const targetId = parts[0];
      const days = parseInt(parts[1]) || 30;

      if (!targetId || !/^\d+$/.test(targetId)) {
        bot.sendMessage(chatId, "❌ Usage: `/addreseller <user_id> [days]`\nExample: `/addreseller 123456789 30`", { parse_mode: 'Markdown' });
        return;
      }

      const targetUser = db.users[targetId];
      if (!targetUser) {
        bot.sendMessage(chatId, `❌ User with ID \`${targetId}\` not found in database. The user must start the bot first.`, { parse_mode: 'Markdown' });
        return;
      }

      targetUser.isReseller = true;
      const now = Date.now();
      const currentExpiry = targetUser.resellerExpiry && targetUser.resellerExpiry > now ? targetUser.resellerExpiry : now;
      targetUser.resellerExpiry = currentExpiry + (days * 24 * 60 * 60 * 1000);
      saveDB();

      const expiryStr = new Date(targetUser.resellerExpiry).toLocaleDateString();
      bot.sendMessage(chatId, `✅ **Reseller Added!**\nUser: ${targetUser.name} (\`${targetId}\`)\nDays Added: ${days} days\nNew Expiration: \`${expiryStr}\``, { parse_mode: 'Markdown' });
      
      const userMsg = targetUser.language === 'my'
        ? `🎉 **သင့်အကောင့်ကို Admin မှ Reseller အဖြစ် သတ်မှတ်ပေးလိုက်ပါပြီ!**\n\nသက်တမ်းကုန်ဆုံးမည့်ရက်: \`${expiryStr}\`\nယခုအခါ **'💼 Reseller Panel'** မှတစ်ဆင့် လက်ကားစျေးနှုန်းများဖြင့် ဝယ်ယူနိုင်ပါပြီခင်ဗျာ!`
        : `🎉 **You have been granted Reseller status by Admin!**\n\nExpires: \`${expiryStr}\`\nYou can now access wholesale rates in the Reseller Panel!`;
      bot.sendMessage(parseInt(targetId), userMsg, { parse_mode: 'Markdown' }).catch(() => {});
      return;
    }

    // Remove Reseller Command: /removereseller <id>
    if (text.startsWith('/removereseller') && chatId.toString() === adminChatId) {
      const targetId = text.replace('/removereseller', '').trim();
      if (!targetId || !/^\d+$/.test(targetId)) {
        bot.sendMessage(chatId, "❌ Usage: `/removereseller <user_id>`", { parse_mode: 'Markdown' });
        return;
      }

      const targetUser = db.users[targetId];
      if (!targetUser) {
        bot.sendMessage(chatId, `❌ User with ID \`${targetId}\` not found in database.`, { parse_mode: 'Markdown' });
        return;
      }

      targetUser.isReseller = false;
      targetUser.resellerExpiry = 0;
      saveDB();

      bot.sendMessage(chatId, `✅ Reseller status removed for user \`${targetId}\` (${targetUser.name}).`, { parse_mode: 'Markdown' });
      return;
    }

    // Set Channel Command
    if ((text.startsWith('/setchannel') || text.startsWith('/channel')) && chatId.toString() === adminChatId) {
      const channelParam = text.replace(/\/setchannel|\/channel/, '').trim();
      if (!channelParam) {
        bot.sendMessage(chatId, "❌ Usage: `/setchannel @YourChannelUsername` or `/setchannel off`", { parse_mode: 'Markdown' });
        return;
      }
      if (channelParam.toLowerCase() === 'off' || channelParam.toLowerCase() === 'disable') {
        db.settings.requiredChannel = '';
        saveDB();
        bot.sendMessage(chatId, "✅ Required channel has been disabled.");
        sendAdminDashboard(chatId);
        return;
      }
      let formatted = channelParam;
      if (!formatted.startsWith('@') && !formatted.startsWith('-100') && !formatted.startsWith('https://t.me/')) {
        formatted = `@${formatted}`;
      }
      db.settings.requiredChannel = formatted;
      saveDB();
      bot.sendMessage(chatId, `✅ Required channel set to \`${formatted}\`\n\nMake sure the bot is an Admin in that channel.`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // Set Subscription End Date Command
    if ((text.startsWith('/setsubdate') || text.startsWith('/subdate')) && chatId.toString() === adminChatId) {
      const dateParam = text.replace(/\/setsubdate|\/subdate/, '').trim();
      if (!dateParam) {
        bot.sendMessage(chatId, "❌ Usage: `/setsubdate August 2, 2027 (12 Months)`", { parse_mode: 'Markdown' });
        return;
      }
      db.settings.subscriptionEndDate = dateParam;
      saveDB();
      bot.sendMessage(chatId, `✅ **Subscription End Date Updated!**\n\nNew value:\n\`${dateParam}\``, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // Maintenance Toggle Commands
    if ((text.startsWith('/maintenance') || text.startsWith('/maint')) && chatId.toString() === adminChatId) {
      const parts = text.split(' ');
      const mode = parts[1]?.toLowerCase();
      if (mode === 'on') {
        db.settings.maintenanceMode = true;
        saveDB();
        bot.sendMessage(chatId, "🔴 **Maintenance Mode is now ON.**\n\nOnly the Admin and registered Testers can use the bot. Other users will see the maintenance message.", { parse_mode: 'Markdown' });
        sendAdminDashboard(chatId);
        return;
      } else if (mode === 'off') {
        db.settings.maintenanceMode = false;
        saveDB();
        bot.sendMessage(chatId, "🟢 **Maintenance Mode is now OFF.**\n\nThe bot is back online and accessible to all public users.", { parse_mode: 'Markdown' });
        sendAdminDashboard(chatId);
        return;
      } else {
        sendAdminDashboard(chatId);
        return;
      }
    }

    // Add Tester Command
    if (text.startsWith('/addtester') && chatId.toString() === adminChatId) {
      const targetId = text.replace('/addtester', '').trim();
      if (!targetId || !/^\d+$/.test(targetId)) {
        bot.sendMessage(chatId, "❌ Usage: `/addtester <telegram_user_id>` (numbers only)\nExample: `/addtester 123456789`", { parse_mode: 'Markdown' });
        return;
      }
      if (db.settings.testers.includes(targetId)) {
        bot.sendMessage(chatId, "⚠️ That Telegram ID is already registered as a tester.");
        return;
      }
      if (db.settings.testers.length >= 3) {
        bot.sendMessage(chatId, "❌ Tester slots full (3/3). Use `/removetester <id>` to remove one first.");
        return;
      }
      db.settings.testers.push(targetId);
      saveDB();
      const tUser = db.users[targetId];
      const tName = tUser?.name ? ` (${tUser.name})` : "";
      bot.sendMessage(chatId, `✅ **Tester Added to Slot #${db.settings.testers.length}!**\nTelegram ID: \`${targetId}\`${tName}`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // Remove Tester Command
    if (text.startsWith('/removetester') && chatId.toString() === adminChatId) {
      const targetId = text.replace('/removetester', '').trim();
      if (!targetId) {
        bot.sendMessage(chatId, "❌ Usage: `/removetester <telegram_user_id>`");
        return;
      }
      if (!db.settings.testers.includes(targetId)) {
        bot.sendMessage(chatId, "❌ That Telegram ID is not in the tester list.");
        return;
      }
      db.settings.testers = db.settings.testers.filter(id => id !== targetId);
      saveDB();
      bot.sendMessage(chatId, `✅ **Tester Removed!**\nTelegram ID \`${targetId}\` was removed. (${db.settings.testers.length}/3 slots in use).`, { parse_mode: 'Markdown' });
      sendAdminDashboard(chatId);
      return;
    }

    // Backup Channel Command: /setbackupchannel @Channel or /setbackupchannel off
    if ((text.startsWith('/setbackupchannel') || text.startsWith('/backupchannel')) && chatId.toString() === adminChatId) {
      const channelParam = text.replace(/\/setbackupchannel|\/backupchannel/, '').trim();
      if (!channelParam) {
        bot.sendMessage(chatId, "❌ Usage: `/setbackupchannel @YourBackupChannel` or `/setbackupchannel off`\n\nOr use `/backup` to trigger an immediate backup.", { parse_mode: 'Markdown' });
        return;
      }
      if (channelParam.toLowerCase() === 'off' || channelParam.toLowerCase() === 'disable') {
        db.settings.backupChannel = '';
        saveDB();
        bot.sendMessage(chatId, "✅ Database backup channel has been disabled.");
        sendAdminDashboard(chatId);
        return;
      }
      let formatted = channelParam;
      if (!formatted.startsWith('@') && !formatted.startsWith('-100') && !formatted.startsWith('https://t.me/')) {
        formatted = `@${formatted}`;
      }
      db.settings.backupChannel = formatted;
      saveDB();
      bot.sendMessage(chatId, `✅ Database backup channel set to \`${formatted}\`\n\nTesting upload now...`, { parse_mode: 'Markdown' });
      sendDatabaseBackupToChannel("Manual Channel Config Test").then(res => {
        if (res.success) {
          bot.sendMessage(chatId, `✅ **Test Backup Delivered!**\nBackup copy sent successfully to \`${formatted}\`.`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, `⚠️ **Upload Warning:**\nFailed to upload to \`${formatted}\` (${res.error}).\nPlease ensure the bot is added as an Admin in the channel.`, { parse_mode: 'Markdown' });
        }
      });
      sendAdminDashboard(chatId);
      return;
    }

    // Manual Backup Command: /backup
    if (text === '/backup' && chatId.toString() === adminChatId) {
      bot.sendMessage(chatId, "⏳ Generating and uploading database backup...");
      const target = db.settings?.backupChannel || adminChatId;
      sendDatabaseBackupToChannel("Manual Admin Request (/backup)", target).then(res => {
        if (res.success) {
          bot.sendMessage(chatId, `✅ **Database Backup Succeeded!**\nBackup document was sent to \`${target}\`.`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, `❌ **Backup Failed:** ${res.error}\nIf uploading to a channel, ensure the bot is an administrator.`, { parse_mode: 'Markdown' });
        }
      });
      return;
    }

    // Import Database Command: /importdb
    if (text === '/importdb' && chatId.toString() === adminChatId) {
      sendImportDatabaseMenu(chatId);
      return;
    }

    // List Testers Command
    if (text === '/testers' && chatId.toString() === adminChatId) {
      sendAdminDashboard(chatId);
      return;
    }

    if (text.startsWith('/broadcast') && chatId.toString() === adminChatId) {
      const broadcastMsg = text.replace('/broadcast', '').trim();
      if (!broadcastMsg) {
        bot.sendMessage(chatId, "❌ Please provide a message. Example: /broadcast Hello everyone!");
        return;
      }
      
      const allUsers = Object.values(db.users);
      let successCount = 0;
      bot.sendMessage(chatId, `📢 Broadcasting message to ${allUsers.length} users...`);
      
      for (const u of allUsers) {
        try {
          await bot.sendMessage(u.id, `📢 **Announcement**\n\n${broadcastMsg}`, { parse_mode: 'Markdown' });
          successCount++;
        } catch (e) {
          // User might have blocked the bot
        }
      }
      bot.sendMessage(chatId, `✅ Broadcast complete! Successfully sent to ${successCount} users.`);
      return;
    }

    // Handle global cancel and start commands to reset state
    if (text === 'Order ပယ်ဖျက်ရန်' || text === '/cancel' || text.startsWith('/start')) {
      userStates[chatId] = { step: 'IDLE' };
      if (!text.startsWith('/start')) {
        const cancelText = user.language === 'my' ? "❌ Order ပယ်ဖျက်လိုက်ပါပြီ။" : "❌ Action Cancelled.";
        bot.sendMessage(chatId, cancelText);
        sendMainMenu(chatId, user.language);
      }
      return;
    }

    // --- Main Menu Handling ---
    if (text === '🌐 Change Language' || text === '🌐 ဘာသာစကားပြောင်းရန်') {
      bot.sendMessage(chatId, "Please choose your language / ကျေးဇူးပြု၍ ဘာသာစကား ရွေးချယ်ပါ", {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇲🇲 မြန်မာ', callback_data: 'lang_my' }, { text: '🇬🇧 English', callback_data: 'lang_en' }]
          ]
        }
      });
      return;
    }

    if (text === '💼 Reseller Panel') {
      sendResellerPanel(chatId, user);
      return;
    }

    if (text === '📞 Contact Admin' || text === '📞 Admin နှင့်ဆက်သွယ်ရန်') {
      const contactMsg = user.language === 'my' 
        ? "အဆင်မပြေမှုများရှိပါက Admin သို့ တိုက်ရိုက်ဆက်သွယ်နိုင်ပါသည်။\n\n💬 Admin: @levil_ft_sushitrash"
        : "If you need any help, you can contact the Admin directly.\n\n💬 Admin: @levil_ft_sushitrash";
      bot.sendMessage(chatId, contactMsg);
      return;
    }

    if (text === '📚 Tutorial' || text === '📚 အသုံးပြုနည်း') {
      const introMsg = user.language === 'my'
        ? "AutoMotion Bot အသုံးပြုနည်းလမ်းညွှန်များ ဤနေရာတွင်ဖတ်ရှုနိုင်ပါသည်။ မိမိသိရှိလိုသောအကြောင်းအရာကို အောက်ပါခလုတ်များမှ ရွေးချယ်ပါ။"
        : "You can read the AutoMotion Bot usage guides here. Please select a topic from the buttons below.";
      bot.sendMessage(chatId, introMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: user.language === 'my' ? '🛒 Activation ဝယ်ယူနည်း' : '🛒 How to Buy', callback_data: 'tut_buy' }],
            [{ text: user.language === 'my' ? '🚀 AM အသက်သွင်းနည်း' : '🚀 How to Activate AM', callback_data: 'tut_activate' }],
            [{ text: user.language === 'my' ? '🎁 Referral အသုံးပြုနည်း' : '🎁 How to Use Referral', callback_data: 'tut_referral' }]
          ]
        }
      });
      return;
    }

    if (text === '🛒 Buy Activations' || text === '🛒 Activation ဝယ်ယူရန်') {
      userStates[chatId] = { step: 'AWAITING_AMOUNT_SELECTION' };
      const subEndDate = db.settings?.subscriptionEndDate || 'August 2, 2027 (12 Months)';
      
      const p1 = typeof db.settings?.normalPrice1 === 'number' ? db.settings.normalPrice1 : 5000;
      const p5 = typeof db.settings?.normalPrice5 === 'number' ? db.settings.normalPrice5 : 20000;

      let priceMsg = '';
      if (user.language === 'my') {
        priceMsg = `⚡ **Alight Motion Activations ဝယ်ယူရန်**\n\n` +
          `💵 **လက်လီ စျေးနှုန်းများ:**\n` +
          `• 1 Activation = **${p1.toLocaleString()} Ks**\n` +
          `• 5 Activations = **${p5.toLocaleString()} Ks**\n`;
        
        if (user.invitedBy) {
          priceMsg += `\n🎁 *(သင့်အတွက် 10% Referral လျှော့စျေး ထည့်သွင်းတွက်ချက်ပေးထားပါသည်!)*\n`;
        }

        priceMsg += `\n📅 **Subscription End Date:**\n\`${subEndDate}\`\n\n` +
          `ဝယ်ယူလိုသော Activation အရေအတွက်ကို အောက်ပါခလုတ်များမှ ရွေးချယ်ပါ:`;
      } else {
        priceMsg = `⚡ **Buy Alight Motion Activations**\n\n` +
          `💵 **Standard Prices:**\n` +
          `• 1 Activation = **${p1.toLocaleString()} Ks**\n` +
          `• 5 Activations = **${p5.toLocaleString()} Ks**\n`;

        if (user.invitedBy) {
          priceMsg += `\n🎁 *(10% Referral Discount applied to your account!)*\n`;
        }

        priceMsg += `\n📅 **Subscription End Date:**\n\`${subEndDate}\`\n\n` +
          `Choose the quantity you want to purchase below:`;
      }

      const cancelBtn = user.language === 'my' ? '❌ ပယ်ဖျက်ရန်' : '❌ Cancel';
      bot.sendMessage(chatId, priceMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `1 Act (${(user.invitedBy ? Math.round(p1 * 0.9) : p1).toLocaleString()} Ks)`, callback_data: 'buy_1' }, { text: `2 Acts (${(user.invitedBy ? Math.round(p1 * 2 * 0.9) : p1 * 2).toLocaleString()} Ks)`, callback_data: 'buy_2' }],
            [{ text: `5 Acts (${(user.invitedBy ? Math.round(p5 * 0.9) : p5).toLocaleString()} Ks)`, callback_data: 'buy_5' }, { text: `10 Acts (${(user.invitedBy ? Math.round(p5 * 2 * 0.9) : p5 * 2).toLocaleString()} Ks)`, callback_data: 'buy_10' }],
            [{ text: cancelBtn, callback_data: 'cancel_buy' }]
          ]
        }
      });
      return;
    }

    if (text === '🚀 Activate AM Account' || text === '🚀 AM အသက်သွင်းရန်') {
      if (user.activatableCount <= 0) {
        const errorMsg = user.language === 'my' ? "❌ သင့်ထံတွင် Activation မရှိတော့ပါ။ ကျေးဇူးပြု၍ အရင်ဝယ်ယူပါ။" : "❌ You have 0 activations left. Please buy activations first.";
        bot.sendMessage(chatId, errorMsg);
        sendMainMenu(chatId, user.language);
        return;
      }

      // Forward tutorial video message from channel (https://t.me/levil_s_shop/4729)
      try {
        const channelSource = db.settings?.requiredChannel || '@levil_s_shop';
        await bot.forwardMessage(chatId, channelSource, 4729);
      } catch (err: any) {
        console.error('Failed to forward tutorial message from channel:', err?.message || err);
        if (db.settings?.requiredChannel && db.settings.requiredChannel !== '@levil_s_shop') {
          await bot.forwardMessage(chatId, '@levil_s_shop', 4729).catch(() => {});
        }
      }

      userStates[chatId] = { step: 'AWAITING_AM_EMAIL' };
      const promptMsg = user.language === 'my' 
        ? "🎬 အထက်ပါ Video သည် AM အကောင့် အသက်သွင်းနည်း Tutorial ဖြစ်ပါသည်ခင်ဗျာ။\n\nအသက်သွင်းလိုသော Alight Motion အကောင့်၏ Email ကို ရိုက်ထည့်ပါ:" 
        : "🎬 The video above is the tutorial on how to activate your account.\n\nPlease type the Email address of the Alight Motion account you want to activate:";
      bot.sendMessage(chatId, promptMsg, {
        reply_markup: {
          keyboard: [[{ text: 'Order ပယ်ဖျက်ရန်' }]],
          resize_keyboard: true
        }
      });
      return;
    }

    if (text === '🎁 Referral Program' || text === '🎁 Referral အစီအစဥ်') {
      const botUser = await bot.getMe();
      const refLink = `https://t.me/${botUser.username}?start=${user.referralCode}`;
      
      let msgText = '';
      if (user.language === 'my') {
        msgText = `🎁 **Referral အစီအစဉ်**\n\n`;
        msgText += `သင့် Referral Link ကို သူငယ်ချင်းများထံ မျှဝေပါ (Link တစ်ခုလျှင် အများဆုံး ၃ ယောက်):\n\`${refLink}\`\n\n`;
        msgText += `**စည်းမျဉ်းများ:**\n`;
        msgText += `1. **အများဆုံး ၃ ယောက်:** Referral Code တစ်ခုကို သူငယ်ချင်း ၃ ယောက်သာ အသုံးပြုနိုင်ပါသည်။\n`;
        msgText += `2. **10% Discount:** သင့် Link ဖြင့်ဝင်သော သူငယ်ချင်းများ ဝယ်ယူမှုတိုင်း 10% လျှော့စျေး ရရှိပါမည်။\n`;
        msgText += `3. **Free Activation:** ထို ၃ ယောက်ထဲမှ အနည်းဆုံး ၁ ယောက် Activation ဝယ်ယူပါက သင် **+1 FREE Activation** ရရှိပါမည်!\n`;
        msgText += `*(မှတ်ချက် - လူ ၃ ယောက်ပြည့်ပါက Referral Code အသစ်တစ်ခု အလိုအလျောက် ထပ်မံထုတ်ပေးပါမည်!)*\n\n`;
      } else {
        msgText = `🎁 **Referral Program**\n\n`;
        msgText += `Share this link with your friends (Max 3 people per link):\n\`${refLink}\`\n\n`;
        msgText += `**Rules:**\n`;
        msgText += `1. **Max 3 Friends:** Each code can only be used by 3 friends.\n`;
        msgText += `2. **10% Discount:** Your friends get 10% off their purchases.\n`;
        msgText += `3. **Free Activation:** If at least 1 of the 3 friends buys an activation, you get **+1 FREE Activation**!\n`;
        msgText += `*(Note: When your code is used by 3 friends, a new one will be generated automatically!)*\n\n`;
      }
      
      let availableRewards = 0;
      let totalFriends = 0;
      
      if (Array.isArray(user.referralBatches)) {
        user.referralBatches.forEach(batch => {
          totalFriends += batch.users.length;
          const hasPurchaser = batch.users.some(u => u.hasPurchased);
          if (hasPurchaser && !batch.rewardClaimed) {
             availableRewards += 1;
          }
        });
      }
      
      if (user.language === 'my') {
        msgText += `ဖိတ်ခေါ်ထားသော သူငယ်ချင်း: ${totalFriends} ယောက်\n`;
        msgText += `ရယူနိုင်သော အခမဲ့ Rewards: ${availableRewards} ခု\n`;
      } else {
        msgText += `Current Invites: ${totalFriends}\n`;
        msgText += `Available Free Rewards: ${availableRewards}\n`;
      }

      if (availableRewards > 0) {
         const redeemBtnText = user.language === 'my' 
           ? `🎁 Free Activation (${availableRewards}) ခု ရယူရန်` 
           : `Redeem ${availableRewards} Free Activation(s)`;
         bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown', reply_markup: {
           inline_keyboard: [[{ text: redeemBtnText, callback_data: 'redeem_reward' }]]
         }});
      } else {
         bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
      }
      return;
    }

    if (text === '👤 My Profile' || text === '👤 မိမိ အချက်အလက်') {
      const isReseller = isUserReseller(user);
      let profileText = user.language === 'my' 
        ? `👤 **မိမိ အချက်အလက်: ${user.name}**\n\n`
        : `👤 **Profile: ${user.name}**\n\n`;
      
      if (isReseller) {
        const expiryStr = new Date(user.resellerExpiry!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        profileText += user.language === 'my'
          ? `💼 **အကောင့်အမျိုးအစား:** Reseller 🟢 (သက်တမ်း: \`${expiryStr}\`)\n`
          : `💼 **Account Type:** Reseller 🟢 (Expires: \`${expiryStr}\`)\n`;
      } else {
        profileText += user.language === 'my'
          ? `👤 **အကောင့်အမျိုးအစား:** Standard User\n`
          : `👤 **Account Type:** Standard User\n`;
      }

      profileText += user.language === 'my' ? `⚡ လက်ကျန် Activations: **${user.activatableCount}** ခု\n` : `⚡ Available Activations: **${user.activatableCount}**\n`;
      profileText += user.language === 'my' ? `✅ အသက်သွင်းပြီး စုစုပေါင်း: **${user.activatedCount}** ခု\n` : `✅ Total Activated: **${user.activatedCount}**\n`;
      bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
      return;
    }

    // --- State Handling ---
    const processOrderCreation = (
      chatId: number, 
      user: any, 
      amount: number, 
      finalPrice: number, 
      photoId: string, 
      transactionId: string,
      orderType: 'activations' | 'reseller_sub' | 'reseller_activations' = 'activations',
      months: number = 1
    ) => {
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const newOrder: Order = {
        id: orderId,
        date: new Date().toISOString(),
        amount: finalPrice,
        activations: amount,
        status: 'pending',
        type: orderType,
        months: months
      };
      
      user.orders.unshift(newOrder);
      saveDB();

      let userConfirmMsg = '';
      if (orderType === 'reseller_sub') {
        userConfirmMsg = user.language === 'my'
          ? `✅ **Reseller Subscription Order ${orderId} ကို တင်ပြီးပါပြီ!**\n\nကြေး: ${finalPrice.toLocaleString()} Ks (၁ လ သက်တမ်း)\n\nAdmin မှ စစ်ဆေးပြီး Reseller Status အတည်ပြုပေးပါမည်ခင်ဗျာ...`
          : `✅ Reseller Subscription Order **${orderId}** placed (${finalPrice.toLocaleString()} Ks).\nWaiting for Admin approval...`;
      } else {
        userConfirmMsg = user.language === 'my'
          ? `✅ **Order ${orderId} ကို တင်ပြီးပါပြီ!**\n\nအရေအတွက်: ${amount} Activations\nကျသင့်ငွေ: ${finalPrice.toLocaleString()} Ks\n\nAdmin မှ စစ်ဆေးပြီး အတည်ပြုပေးသည်အထိ ခေတ္တစောင့်ဆိုင်းပေးပါခင်ဗျာ...`
          : `✅ Order **${orderId}** placed for ${amount} activations (${finalPrice.toLocaleString()} Ks).\nWaiting for Admin approval...`;
      }

      bot.sendMessage(chatId, userConfirmMsg, { parse_mode: 'Markdown' });
      userStates[chatId] = { step: 'IDLE' };
      sendMainMenu(chatId, user.language);

      // Notify Admin
      if (adminChatId) {
        let adminCaption = '';
        if (orderType === 'reseller_sub') {
          adminCaption = `💼 **New Reseller Subscription Order ${orderId}**\nUser: ${user.name} (\`${user.id}\`)\nPlan: 1 Month (30 Days)\nPrice: ${finalPrice.toLocaleString()} Ks\nTransaction ID (Last 5 digits): ${transactionId}`;
        } else if (orderType === 'reseller_activations') {
          adminCaption = `💼 **New Reseller Bulk Order ${orderId}**\nUser: ${user.name} (\`${user.id}\`)\nActivations: ${amount}\nReseller Rate: ${finalPrice.toLocaleString()} Ks\nTransaction ID (Last 5 digits): ${transactionId}`;
        } else {
          adminCaption = `🛒 **New Order ${orderId}**\nUser: ${user.name} (\`${user.id}\`)\nActivations: ${amount}\nCalculated Price: ${finalPrice.toLocaleString()} Ks\nTransaction ID (Last 5 digits): ${transactionId}`;
          if (user.invitedBy) adminCaption += `\n(Applied 10% Referral Discount)`;
        }

        bot.sendPhoto(adminChatId, photoId, {
          caption: adminCaption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Approve', callback_data: `admin_approve_${user.id}_${orderId}` }],
              [{ text: '❌ Reject', callback_data: `admin_reject_${user.id}_${orderId}` }]
            ]
          }
        });
      }
    };

    // 1. Receiving a Slip Photo
    if (state.step === 'AWAITING_PAYMENT_SLIP' && msg.photo && msg.photo.length > 0) {
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      const caption = msg.caption?.trim();
      const amount = state.data?.amount || 0;
      const finalPrice = state.data?.finalPrice || 0;
      const orderType = state.data?.type || 'activations';
      const months = state.data?.months || 1;

      if (caption) {
        processOrderCreation(chatId, user, amount, finalPrice, photoId, caption, orderType, months);
      } else {
        userStates[chatId] = { step: 'AWAITING_TRANSACTION_ID', data: { photoId, amount, finalPrice, type: orderType, months } };
        const promptTxId = user.language === 'my'
          ? "✅ ငွေလွှဲပြေစာ ဓာတ်ပုံရရှိပါပြီခင်ဗျာ။\n\nTransaction ID ၏ နောက်ဆုံးနံပါတ် ၅ လုံးကို ရိုက်ပို့ပေးပါခင်ဗျာ:"
          : "Photo received. Please send the last 5 digits of your Transaction ID:";
        bot.sendMessage(chatId, promptTxId);
      }
      return;
    }

    if (state.step === 'AWAITING_TRANSACTION_ID' && text) {
      const transactionId = text.trim();
      const { photoId, amount, finalPrice, type, months } = state.data || {};
      
      processOrderCreation(chatId, user, amount, finalPrice, photoId, transactionId, type, months);
      return;
    }

    // 2. Awaiting AM Email
    if (state.step === 'AWAITING_AM_EMAIL' && text) {
      if (!text.includes('@')) {
        const invalidEmailMsg = user.language === 'my'
          ? "❌ Email ပုံစံ မမှန်ကန်ပါ။ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပြီး ရိုက်ထည့်ပါ သို့မဟုတ် ပယ်ဖျက်ရန် Order ပယ်ဖျက်ရန် ကို နှိပ်ပါ။"
          : "❌ Invalid email format. Please try again or type /cancel.";
        bot.sendMessage(chatId, invalidEmailMsg);
        return;
      }
      if (!API_KEY) {
        bot.sendMessage(chatId, "API Error: DIYY_API_KEY is not configured.");
        return;
      }

      const sendingMsg = user.language === 'my' ? "⏳ Verification link ပေးပို့နေပါသည်..." : "Sending verification link...";
      bot.sendMessage(chatId, sendingMsg);
      try {
        const res = await fetch(`${API_URL}/feature`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY 
          },
          body: JSON.stringify({ action: 'am', op: 'send', email: text.trim() })
        });
        const data = await res.json();
        if (data.status) {
          userStates[chatId] = { step: 'AWAITING_AM_LINK', data: { email: text.trim() } };
          const linkSentMsg = user.language === 'my'
            ? `✅ **Verification Link ကို ${text.trim()} သို့ ပေးပို့ပြီးပါပြီ!**\n\nသင့် Email inbox ကိုဖွင့်ပြီး ရောက်ရှိလာသော "Sign In" link ကို **မဖွင့်ဘဲ Copy ကူး၍** ဤနေရာတွင် Paste လုပ်ပြီး ပြန်ပို့ပေးပါခင်ဗျာ:`
            : `✅ **Link sent to ${text.trim()}!**\n\nOpen your email, copy the "Sign In" URL (do NOT open the URL, just copy it), and paste it here:`;
          
          bot.sendMessage(chatId, linkSentMsg, {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [[{ text: 'Order ပယ်ဖျက်ရန်' }]],
              resize_keyboard: true
            }
          });
        } else {
          const failMsg = user.language === 'my' 
            ? `❌ Link ပေးပို့ခြင်း မအောင်မြင်ပါ: ${data.message || 'အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်'}` 
            : `❌ Failed to send link: ${data.message || 'Unknown error'}`;
          bot.sendMessage(chatId, failMsg);
          sendMainMenu(chatId, user.language);
          userStates[chatId] = { step: 'IDLE' };
        }
      } catch (err: any) {
        const errMsg = user.language === 'my' ? `❌ အမှား: ${err.message}` : `❌ Error: ${err.message}`;
        bot.sendMessage(chatId, errMsg);
        sendMainMenu(chatId, user.language);
        userStates[chatId] = { step: 'IDLE' };
      }
      return;
    }

    // 3. Awaiting AM Link
    if (state.step === 'AWAITING_AM_LINK' && text) {
      if (!text.startsWith('http')) {
        const invalidLinkMsg = user.language === 'my'
          ? "❌ Link ပုံစံ မမှန်ကန်ပါ။ ကျေးဇူးပြု၍ စစ်မှန်သော URL Link ကို ပေးပို့ပါ သို့မဟုတ် ပယ်ဖျက်ရန် Order ပယ်ဖျက်ရန် ကို နှိပ်ပါ။"
          : "That doesn't look like a valid link. Try again or type /cancel.";
        bot.sendMessage(chatId, invalidLinkMsg);
        return;
      }

      const email = state.data?.email;
      const verifyingMsg = user.language === 'my' ? "⏳ Link ကို စစ်ဆေးပြီး အသက်သွင်းနေပါသည်..." : "Verifying your link...";
      bot.sendMessage(chatId, verifyingMsg);
      try {
        const res = await fetch(`${API_URL}/feature`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY 
          },
          body: JSON.stringify({ action: 'am', op: 'verify', email: email, link: text.trim() })
        });
        const data = await res.json();
        if (data.status) {
          // Success! Deduct balance
          user.activatableCount -= 1;
          user.activatedCount += 1;
          saveDB();

          const successMsg = user.language === 'my'
            ? `🎉 **အကောင့် အောင်မြင်စွာ အသက်သွင်းပြီးပါပြီ!**\n\nအကောင့် Email: \`${email}\`\nကျန်ရှိသော Activation အရေအတွက်: **${user.activatableCount}** ခု\n\nAlight Motion Premium ကို စတင်အသုံးပြုနိုင်ပါပြီခင်ဗျာ။`
            : `✅ **Success!** Account \`${email}\` is now activated. You have **${user.activatableCount}** activations left.`;

          bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
          userStates[chatId] = { step: 'IDLE' };
          sendMainMenu(chatId, user.language);
        } else {
          const failMsg = user.language === 'my'
            ? `❌ အသက်သွင်းခြင်း မအောင်မြင်ပါ: ${data.message || 'အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်'}။ ကျေးဇူးပြု၍ အစမှ ပြန်လည်ကြိုးစားပါ။`
            : `❌ Verification failed: ${data.message || 'Unknown error'}. Please try the entire process again.`;
          bot.sendMessage(chatId, failMsg);
          userStates[chatId] = { step: 'IDLE' };
          sendMainMenu(chatId, user.language);
        }
      } catch (err: any) {
        const errMsg = user.language === 'my' ? `❌ အမှား: ${err.message}` : `❌ Error: ${err.message}`;
        bot.sendMessage(chatId, errMsg);
        userStates[chatId] = { step: 'IDLE' };
        sendMainMenu(chatId, user.language);
      }
      return;
    }

    // Document Handler for Database JSON Import
    if (msg.document && chatId.toString() === adminChatId) {
      const doc = msg.document;
      const fileName = doc.file_name || 'database.json';
      
      if (state.step === 'AWAITING_DB_IMPORT_FILE' || fileName.endsWith('.json')) {
        const fileId = doc.file_id;
        bot.sendMessage(chatId, "⏳ Downloading and inspecting uploaded database file...");
        try {
          const fileLink = await bot.getFileLink(fileId);
          const response = await fetch(fileLink);
          if (!response.ok) throw new Error("Failed to download file from Telegram");
          const jsonText = await response.text();
          const parsed = JSON.parse(jsonText);

          if (!parsed || typeof parsed !== 'object' || !parsed.users || typeof parsed.users !== 'object') {
            bot.sendMessage(chatId, "❌ **Invalid Database JSON!**\nThe file does not contain a valid `users` dictionary. Import rejected.", { parse_mode: 'Markdown' });
            userStates[chatId] = { step: 'IDLE' };
            return;
          }

          const uCount = Object.keys(parsed.users).length;
          let oCount = 0;
          Object.values(parsed.users).forEach((u: any) => { oCount += (u.orders || []).length; });

          const importId = `imp_${Date.now()}`;
          const summaryText = `• Users in backup: **${uCount}**\n• Orders in backup: **${oCount}**\n• Transactions: **${Array.isArray(parsed.transactions) ? parsed.transactions.length : 0}**`;
          
          pendingImportPayloads[importId] = {
            sourceName: `Uploaded File (${fileName})`,
            summaryText,
            data: parsed,
            createdAt: Date.now()
          };

          userStates[chatId] = { step: 'IDLE' };
          sendImportConfirmDialog(chatId, `Uploaded File (${fileName})`, summaryText, 3, importId);
          return;
        } catch (err: any) {
          bot.sendMessage(chatId, `❌ **File Processing Error:** ${err.message || 'Invalid JSON file'}`);
          userStates[chatId] = { step: 'IDLE' };
          return;
        }
      }
    }

    // General cancel fallback
    if (text === '/cancel') {
      userStates[chatId] = { step: 'IDLE' };
      const cancelMsg = user.language === 'my' ? "❌ လုပ်ဆောင်ချက်ကို ပယ်ဖျက်လိုက်ပါပြီ။" : "Action cancelled.";
      bot.sendMessage(chatId, cancelMsg);
      sendMainMenu(chatId, user.language);
    }
  });

  // Callback Queries (Inline buttons)
  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    const msgId = query.message?.message_id;
    if (!chatId || !msgId) return;

    const data = query.data || '';
    const user = getUser(chatId, query.from.first_name);

    // Check Maintenance Mode for regular users
    if (db.settings?.maintenanceMode && !isAuthorizedUser(chatId)) {
      bot.answerCallbackQuery(query.id, { 
        text: "🛠 Bot is in maintenance mode. Will be accessible soon. / Bot ကို ပြုပြင်ထိန်းသိမ်းနေပါသည်။", 
        show_alert: true 
      });
      return;
    }

    // --- Admin Dashboard Callbacks ---
    if (data === 'admin_toggle_maint' && chatId.toString() === adminChatId) {
      db.settings.maintenanceMode = !db.settings.maintenanceMode;
      saveDB();
      const statusText = db.settings.maintenanceMode ? "🔴 Maintenance Mode is now ON." : "🟢 Maintenance Mode is now OFF.";
      bot.answerCallbackQuery(query.id, { text: statusText, show_alert: false });
      sendAdminDashboard(chatId, msgId);
      return;
    }

    if (data === 'admin_refresh_dashboard' && chatId.toString() === adminChatId) {
      bot.answerCallbackQuery(query.id, { text: "Dashboard refreshed." });
      sendAdminDashboard(chatId, msgId);
      return;
    }

    if (data === 'admin_prompt_add_tester' && chatId.toString() === adminChatId) {
      if (db.settings.testers.length >= 3) {
        bot.answerCallbackQuery(query.id, { text: "All 3 tester slots are already used!", show_alert: true });
        return;
      }
      userStates[chatId] = { step: 'AWAITING_TESTER_ID' };
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `🧪 **Add Tester Slot (${db.settings.testers.length}/3 used)**\n\nPlease reply with the **Telegram User ID** (numeric only) of the tester you want to add.\n\n_Tip: They can find their Telegram ID by messaging @userinfobot._\n\nType \`/cancel\` to cancel.`, { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'admin_manage_testers' && chatId.toString() === adminChatId) {
      const testers = db.settings?.testers || [];
      const inline_keyboard: any[][] = [];

      testers.forEach((tId, idx) => {
        const tUser = db.users[tId];
        const label = tUser?.name ? `Slot ${idx + 1}: ${tUser.name} (${tId})` : `Slot ${idx + 1}: ${tId}`;
        inline_keyboard.push([
          { text: `❌ Remove ${label}`, callback_data: `admin_remove_tester_${tId}` }
        ]);
      });

      if (testers.length < 3) {
        inline_keyboard.push([{ text: `➕ Add Tester (${testers.length}/3)`, callback_data: 'admin_prompt_add_tester' }]);
      }

      inline_keyboard.push([{ text: '🔙 Back to Dashboard', callback_data: 'admin_refresh_dashboard' }]);

      bot.answerCallbackQuery(query.id);
      bot.editMessageText(`👥 **Manage Tester Slots (${testers.length}/3 used)**\n\nClick a button below to remove a tester or add a new one:`, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard }
      }).catch(() => {});
      return;
    }

    if (data.startsWith('admin_remove_tester_') && chatId.toString() === adminChatId) {
      const targetId = data.replace('admin_remove_tester_', '');
      db.settings.testers = db.settings.testers.filter(id => id !== targetId);
      saveDB();
      bot.answerCallbackQuery(query.id, { text: `Tester ${targetId} removed.` });
      sendAdminDashboard(chatId, msgId);
      return;
    }

    if (data === 'admin_prompt_change_prices' && chatId.toString() === adminChatId) {
      userStates[chatId] = { step: 'AWAITING_NORMAL_PRICE_INPUT' };
      bot.answerCallbackQuery(query.id);
      const cur1 = typeof db.settings?.normalPrice1 === 'number' ? db.settings.normalPrice1 : 5000;
      const cur5 = typeof db.settings?.normalPrice5 === 'number' ? db.settings.normalPrice5 : 20000;
      bot.sendMessage(chatId, `💵 **Change Normal User Prices**\n\nCurrent Prices:\n• 1 Activation = **${cur1.toLocaleString()} Ks**\n• 5 Activations = **${cur5.toLocaleString()} Ks**\n\nPlease reply with the new prices for 1 Activation and 5 Activations.\nExample format: \`5000 20000\`\n\n*(Note: 10% referral discount is calculated automatically from these base prices. Reseller prices remain fixed at 1=1,500 Ks, 5=5,000 Ks, 10=5,000 Ks)*\n\nType \`/cancel\` to cancel.`, { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'admin_prompt_set_sub_date' && chatId.toString() === adminChatId) {
      userStates[chatId] = { step: 'AWAITING_SUB_DATE_INPUT' };
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `📅 **Set Subscription End Date & Duration**\n\nCurrent value: \`${db.settings?.subscriptionEndDate || "August 2, 2027 (12 Months)"}\`\n\nPlease reply with the new Subscription End Date text.\nExample format:\n\`August 2, 2027 (12 Months)\`\n\nType \`/cancel\` to cancel.`, { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'admin_prompt_set_channel' && chatId.toString() === adminChatId) {
      userStates[chatId] = { step: 'AWAITING_CHANNEL_INPUT' };
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `📢 **Set Required Telegram Channel**\n\nPlease reply with the **Channel Username** (e.g. \`@AutoMotionChannel\`) or **Channel ID** (e.g. \`-100123456789\`).\n\nTo disable, type \`off\` or \`/cancel\`.\n\n⚠️ *Make sure this bot is added as an Administrator in that channel!*`, { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'admin_prompt_set_backup_channel' && chatId.toString() === adminChatId) {
      userStates[chatId] = { step: 'AWAITING_BACKUP_CHANNEL_INPUT' };
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `📦 **Set Database Backup Telegram Channel**\n\nPlease reply with the **Channel Username** (e.g. \`@AutoMotionBackups\`) or **Channel ID** (e.g. \`-100123456789\`).\n\nTo disable, type \`off\` or \`/cancel\`.\n\n⚠️ *Make sure this bot is added as an Administrator in that channel with message/document posting permissions!*`, { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'admin_remove_backup_channel' && chatId.toString() === adminChatId) {
      db.settings.backupChannel = '';
      saveDB();
      bot.answerCallbackQuery(query.id, { text: "Backup channel removed." });
      sendAdminDashboard(chatId, msgId);
      return;
    }

    if (data === 'admin_backup_now' && chatId.toString() === adminChatId) {
      bot.answerCallbackQuery(query.id, { text: "Uploading backup..." });
      const target = db.settings?.backupChannel || adminChatId;
      sendDatabaseBackupToChannel("Manual Dashboard Click (Backup DB Now)", target).then(res => {
        if (res.success) {
          bot.sendMessage(chatId, `✅ **Database Backup Succeeded!**\nBackup copy uploaded to \`${target}\`.`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, `❌ **Backup Failed:** ${res.error}\nMake sure the bot is an admin in the channel if configured.`, { parse_mode: 'Markdown' });
        }
      });
      return;
    }

    if (data === 'admin_remove_channel' && chatId.toString() === adminChatId) {
      db.settings.requiredChannel = '';
      saveDB();
      bot.answerCallbackQuery(query.id, { text: "Required channel removed." });
      sendAdminDashboard(chatId, msgId);
      return;
    }

    // --- Database Import Callbacks ---
    if (data === 'admin_import_db_menu' && chatId.toString() === adminChatId) {
      bot.answerCallbackQuery(query.id);
      sendImportDatabaseMenu(chatId, msgId);
      return;
    }

    if (data === 'admin_import_upload_file' && chatId.toString() === adminChatId) {
      userStates[chatId] = { step: 'AWAITING_DB_IMPORT_FILE' };
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `📁 **Upload Database JSON File**\n\nPlease attach/send your \`.json\` database backup file to this chat now.\n\nType \`/cancel\` to abort.`, { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'admin_import_choose_latest' && chatId.toString() === adminChatId) {
      const latest = getLatestLocalBackup();
      if (!latest || !latest.data) {
        bot.answerCallbackQuery(query.id, { text: "No recent backup found on server.", show_alert: true });
        return;
      }
      bot.answerCallbackQuery(query.id);

      const uCount = Object.keys(latest.data.users || {}).length;
      let oCount = 0;
      Object.values(latest.data.users || {}).forEach((u: any) => { oCount += (u.orders || []).length; });

      const importId = `latest_${Date.now()}`;
      const summaryText = `• File: \`${latest.filename}\`\n• Time (MMT): \`${latest.timeStr}\`\n• Users: **${uCount}**\n• Orders: **${oCount}**`;

      pendingImportPayloads[importId] = {
        sourceName: `Latest Backup (${latest.filename})`,
        summaryText,
        data: latest.data,
        createdAt: Date.now()
      };

      sendImportConfirmDialog(chatId, `Latest Backup (${latest.filename})`, summaryText, 3, importId, msgId);
      return;
    }

    if (data.startsWith('admin_import_confirm_') && chatId.toString() === adminChatId) {
      const parts = data.split('_'); // ['admin', 'import', 'confirm', clicksRemaining, ...importIdParts]
      const clicksRemaining = parseInt(parts[3], 10);
      const importId = parts.slice(4).join('_');
      const pending = pendingImportPayloads[importId];

      if (!pending) {
        bot.answerCallbackQuery(query.id, { text: "Import session expired or not found. Please try again.", show_alert: true });
        sendImportDatabaseMenu(chatId, msgId);
        return;
      }

      if (clicksRemaining > 1) {
        const nextClicks = clicksRemaining - 1;
        bot.answerCallbackQuery(query.id, { text: `Confirmed (${3 - nextClicks}/3)! Click ${nextClicks} more time${nextClicks > 1 ? 's' : ''} to execute.` });
        sendImportConfirmDialog(chatId, pending.sourceName, pending.summaryText, nextClicks, importId, msgId);
        return;
      }

      // Final (3rd) Confirmation Click -> Execute Database Import
      bot.answerCallbackQuery(query.id, { text: "Executing database import..." });
      
      // Auto-save pre-import snapshot before overwriting
      try {
        if (fs.existsSync(DB_FILE)) {
          fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, `pre_import_backup_${Date.now()}.json`));
        }
      } catch (e) {}

      const result = applyImportedDatabase(pending.data);
      delete pendingImportPayloads[importId];

      if (result.success) {
        const successMsg = `🎉 **Database Import Completed Successfully!**\n\n` +
          `📦 **Source:** \`${pending.sourceName}\`\n` +
          `👥 **Total Users Restored:** ${result.usersCount}\n` +
          `🛒 **Total Orders Restored:** ${result.ordersCount}\n` +
          `💾 **Database File:** \`database.json\` updated and active.`;

        bot.editMessageText(successMsg, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👑 Return to Admin Dashboard', callback_data: 'admin_refresh_dashboard' }]
            ]
          }
        }).catch(() => {
          bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
        });
      } else {
        const errorMsg = `❌ **Database Import Failed:** ${result.error || 'Unknown error'}\nPrevious database state preserved.`;
        bot.editMessageText(errorMsg, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Back to Import Menu', callback_data: 'admin_import_db_menu' }]
            ]
          }
        }).catch(() => {
          bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        });
      }
      return;
    }

    if (data === 'admin_import_cancel' && chatId.toString() === adminChatId) {
      bot.answerCallbackQuery(query.id, { text: "Import cancelled." });
      sendImportDatabaseMenu(chatId, msgId);
      return;
    }

    // Check Join Channel Verification Callback
    if (data.startsWith('check_join')) {
      const isJoined = await checkUserJoinedChannel(chatId);
      if (isJoined) {
        bot.answerCallbackQuery(query.id, { 
          text: user.language === 'my' ? "✅ Join ထားခြင်းကို အတည်ပြုပြီးပါပြီ!" : "✅ Channel membership verified!", 
          show_alert: false 
        });
        bot.deleteMessage(chatId, msgId).catch(() => {});

        // Handle referral param if passed in callback
        const refParam = data.replace('check_join_', '').replace('check_join', '').trim();
        if (refParam) {
          processReferral(user, refParam, chatId);
        }

        sendMainMenu(chatId, user.language || 'my');
      } else {
        const errorAlert = user.language === 'my'
          ? "⚠️ Channel သို့ မ Join ရသေးပါခင်ဗျာ။ ကျေးဇူးပြု၍ Join ခလုတ်ကိုနှိပ်၍ အရင် Join ပေးပါ။"
          : "⚠️ You have not joined the channel yet. Please click 'Join Channel' first.";
        bot.answerCallbackQuery(query.id, { text: errorAlert, show_alert: true });
      }
      return;
    }

    // Language Selection
    if (data === 'lang_en' || data === 'lang_my') {
      user.language = data === 'lang_en' ? 'en' : 'my';
      saveDB();
      
      bot.deleteMessage(chatId, msgId).catch(() => {});
      bot.sendMessage(chatId, user.language === 'my' ? "မြန်မာဘာသာစကားကို ရွေးချယ်ပြီးပါပြီ။" : "English language selected.");
      
      const state = userStates[chatId];
      const refParam = state?.data?.refParam;
      userStates[chatId] = { step: 'IDLE' };

      // Real Telegram API check for channel membership
      const hasJoined = await checkUserJoinedChannel(chatId);
      if (!hasJoined) {
        sendJoinChannelPrompt(chatId, user.language, refParam);
        return;
      }

      if (refParam) {
        processReferral(user, refParam, chatId);
      }
      
      sendMainMenu(chatId, user.language);
      bot.answerCallbackQuery(query.id);
      return;
    }

    // Back to main
    if (data === 'back_to_main') {
      userStates[chatId] = { step: 'IDLE' };
      bot.deleteMessage(chatId, msgId).catch(() => {});
      sendMainMenu(chatId, user.language);
      return;
    }

    // Tutorial Callbacks
    if (data === 'tut_buy') {
      const msg = user.language === 'my' 
        ? "🛒 **Activation ဝယ်ယူနည်း**\n\n1. '🛒 Activation ဝယ်ယူရန်' ကို နှိပ်ပါ။\n2. ဝယ်ယူလိုသော အရေအတွက်ကို ရွေးချယ်ပါ။\n3. ကျသင့်ငွေကို ပြထားသော အကောင့်များသို့ လွှဲပေးပါ။\n4. ငွေလွှဲပြေစာ (Screenshot) ကို ပေးပို့ပါ။\n5. ပြေစာပေါ်မှ Transaction ID နောက်ဆုံးနံပါတ် ၅ လုံးကို ပေးပို့ပါ။\n6. Admin မှ အတည်ပြုပြီးပါက Activation ရရှိပါမည်။"
        : "🛒 **How to Buy Activations**\n\n1. Click '🛒 Buy Activations'.\n2. Choose the amount.\n3. Transfer the total amount to the accounts shown.\n4. Send the payment slip screenshot.\n5. Send the last 5 digits of the transaction ID.\n6. After Admin approval, you will receive the Activations.";
      bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      bot.answerCallbackQuery(query.id);
      return;
    }
    if (data === 'tut_activate') {
       try {
         const channelSource = db.settings?.requiredChannel || '@levil_s_shop';
         await bot.forwardMessage(chatId, channelSource, 4729);
       } catch (err: any) {
         console.error('Failed to forward tutorial message:', err?.message || err);
         if (db.settings?.requiredChannel && db.settings.requiredChannel !== '@levil_s_shop') {
           await bot.forwardMessage(chatId, '@levil_s_shop', 4729).catch(() => {});
         }
       }
       const msg = user.language === 'my'
        ? "🚀 **Alight Motion အသက်သွင်းနည်း**\n\n1. '🚀 AM အသက်သွင်းရန်' ကို နှိပ်ပါ။\n2. မိမိအသုံးပြုလိုသော Email ကို ရိုက်ထည့်ပါ။\n3. Email သို့ရောက်လာသော Verification Link ကို ဖွင့်စရာမလိုဘဲ Copy ကူးပြီး Bot သို့ ပေးပို့ပါ။\n4. အောင်မြင်ပါက Alight Motion Premium အကောင့်ကို အသုံးပြုနိုင်ပါပြီ။"
        : "🚀 **How to Activate Alight Motion**\n\n1. Click '🚀 Activate AM Account'.\n2. Enter the Email you want to activate.\n3. Copy the Verification Link from your email inbox without opening it, and send it to the Bot.\n4. Done! Your Alight Motion Premium is ready.";
       bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
       bot.answerCallbackQuery(query.id);
       return;
    }
    if (data === 'tut_referral') {
       const msg = user.language === 'my'
        ? "🎁 **Referral အသုံးပြုနည်း**\n\n1. '🎁 Referral အစီအစဥ်' ကို နှိပ်ပါ။\n2. ပြသထားသော Link ကို မိမိသူငယ်ချင်းများထံ မျှဝေပါ။\n3. သူငယ်ချင်းများမှ ထို Link ဖြင့် ဝင်ရောက်ပြီး Activation ဝယ်ယူပါက ၎င်းတို့အတွက် 10% Discount ရရှိပါမည်။\n4. ထိုသူငယ်ချင်း ၃ ယောက်ထဲမှ အနည်းဆုံး တစ်ယောက် ဝယ်ယူပါက သင့်အတွက် 1 Free Activation ရရှိပါမည်။ (၃ ယောက်ပြည့်သွားတိုင်း Referral Code အသစ်တစ်ခု ထပ်မံရရှိပါမည်။)"
        : "🎁 **How to Use Referral**\n\n1. Click '🎁 Referral Program'.\n2. Share the provided link with your friends.\n3. Friends who use your link get a 10% discount.\n4. If at least 1 friend buys an activation, you get 1 Free Activation! (A new code is generated every 3 friends).";
       bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
       bot.answerCallbackQuery(query.id);
       return;
    }

    // Cancel Buy
    if (data === 'cancel_buy') {
      userStates[chatId] = { step: 'IDLE' };
      bot.deleteMessage(chatId, msgId).catch(() => {});
      sendMainMenu(chatId, user.language);
      return;
    }

    // Reseller Subscription Purchase Flow
    if (data === 'buy_reseller_sub') {
      const subPrice = db.settings?.resellerSubPrice || 10000;
      const paymentMsg = user.language === 'my'
        ? `💼 **Reseller Subscription ဝယ်ယူရန် (၁ လ သက်တမ်း)**\n\n` +
          `💳 **ငွေလွှဲရန် အကောင့်များ:**\n\n📱 **09447173023**\n🌊 **Wave** - Daw Kyaing\n🟡 **Kpay** - Min Naing\n\n` +
          `💰 ကျသင့်ငွေ: **${subPrice.toLocaleString()} Ks** (ရက်ပေါင်း ၃၀)\n\n` +
          `ငွေလွှဲပြီးပါက **ငွေလွှဲပြေစာ (Screenshot/Photo)** ကို ပေးပို့ပေးပါခင်ဗျာ။ (ပြေစာနှင့်အတူ သို့မဟုတ် သီးခြား message ဖြင့် Transaction ID နောက်ဆုံးနံပါတ် ၅ လုံးကိုလည်း ပေးပို့နိုင်ပါသည်)`
        : `💼 **Purchase Reseller Subscription (1 Month / 30 Days)**\n\n` +
          `💳 **Payment Accounts:**\n\n📱 **09447173023**\n🌊 **Wave** - Daw Kyaing\n🟡 **Kpay** - Min Naing\n\n` +
          `💰 Total Amount: **${subPrice.toLocaleString()} Ks**\n\n` +
          `Please send a screenshot (photo) of your transfer slip. You can include the 5 digits as a caption, or send it as a separate message.`;

      userStates[chatId] = { step: 'AWAITING_PAYMENT_SLIP', data: { amount: 0, finalPrice: subPrice, type: 'reseller_sub', months: 1 } };
      bot.editMessageText(paymentMsg, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown'
      }).catch(() => {
        bot.sendMessage(chatId, paymentMsg, { parse_mode: 'Markdown' });
      });
      return;
    }

    // Reseller Bulk Activations Purchase Flow
    if (data.startsWith('buy_reseller_act_')) {
      if (!isUserReseller(user)) {
        bot.answerCallbackQuery(query.id, {
          text: user.language === 'my' ? "သင့် Reseller Subscription သက်တမ်းကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ သက်တမ်းတိုးပေးပါ။" : "Your Reseller Subscription has expired. Please renew.",
          show_alert: true
        });
        sendResellerPanel(chatId, user, msgId);
        return;
      }

      const amount = parseInt(data.replace('buy_reseller_act_', ''));
      const finalPrice = getResellerPrice(amount);

      const paymentMsg = user.language === 'my'
        ? `💼 **Reseller အထူးလက်ကား Activation ဝယ်ယူရန်**\n\n` +
          `💳 **ငွေလွှဲရန် အကောင့်များ:**\n\n📱 **09447173023**\n🌊 **Wave** - Daw Kyaing\n🟡 **Kpay** - Min Naing\n\n` +
          `⚡ အရေအတွက်: **${amount} Activations**\n` +
          `💰 လက်ကားကျသင့်ငွေ: **${finalPrice.toLocaleString()} Ks**\n\n` +
          `ငွေလွှဲပြီးပါက **ငွေလွှဲပြေစာ (Screenshot/Photo)** ကို ပေးပို့ပေးပါခင်ဗျာ။ (ပြေစာနှင့်အတူ သို့မဟုတ် သီးခြား message ဖြင့် Transaction ID နောက်ဆုံးနံပါတ် ၅ လုံးကိုလည်း ပေးပို့နိုင်ပါသည်)`
        : `💼 **Reseller Wholesale Activation Purchase**\n\n` +
          `💳 **Payment Accounts:**\n\n📱 **09447173023**\n🌊 **Wave** - Daw Kyaing\n🟡 **Kpay** - Min Naing\n\n` +
          `⚡ Activations: **${amount}**\n` +
          `💰 Wholesale Price: **${finalPrice.toLocaleString()} Ks**\n\n` +
          `Please send a screenshot (photo) of your transfer slip. You can include the 5 digits as a caption, or send it as a separate message.`;

      userStates[chatId] = { step: 'AWAITING_PAYMENT_SLIP', data: { amount, finalPrice, type: 'reseller_activations' } };
      bot.editMessageText(paymentMsg, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown'
      }).catch(() => {
        bot.sendMessage(chatId, paymentMsg, { parse_mode: 'Markdown' });
      });
      return;
    }

    // Process slip amount selection for Normal Users
    if (data?.startsWith('buy_')) {
      const state = userStates[chatId];
      if (state?.step !== 'AWAITING_AMOUNT_SELECTION') {
        bot.answerCallbackQuery(query.id, { 
          text: user.language === 'my' ? "အချိန်ကုန်ဆုံးသွားပါပြီ။ အစမှ ပြန်စပေးပါ။" : "Session expired. Please start over." 
        });
        return;
      }
      const amount = parseInt(data.split('_')[1]);
      const basePrice = getNormalPrice(amount);
      const finalPrice = user.invitedBy ? Math.round(basePrice * 0.9) : basePrice;
      
      const paymentMsg = user.language === 'my'
        ? `💳 **ငွေလွှဲရန် အကောင့်များ:**\n\n📱 **09447173023**\n🌊 **Wave** - Daw Kyaing\n🟡 **Kpay** - Min Naing\n\n⚡ ဝယ်ယူမည့် အရေအတွက်: **${amount} Activations**\n💰 စုစုပေါင်း ကျသင့်ငွေ: **${finalPrice.toLocaleString()} Ks** ${user.invitedBy ? '_(10% Referral လျှော့စျေး ထည့်သွင်းပြီး)_' : ''}\n\nငွေလွှဲပြီးပါက **ငွေလွှဲပြေစာ (Screenshot/Photo)** ကို ပေးပို့ပေးပါခင်ဗျာ။ (ပြေစာနှင့်အတူ သို့မဟုတ် သီးခြား message ဖြင့် Transaction ID နောက်ဆုံးနံပါတ် ၅ လုံးကိုလည်း ပေးပို့နိုင်ပါသည်)`
        : `💳 **Payment Accounts:**\n\n📱 **09447173023**\n🌊 **Wave** - Daw Kyaing\n🟡 **Kpay** - Min Naing\n\n⚡ Activations: **${amount}**\n💰 Total Amount: **${finalPrice.toLocaleString()} Ks** ${user.invitedBy ? '_(Included 10% discount)_' : ''}\n\nPlease send a screenshot (photo) of your transfer slip. You can include the 5 digits as a caption, or send it as a separate message.`;
      
      userStates[chatId] = { step: 'AWAITING_PAYMENT_SLIP', data: { amount, finalPrice, type: 'activations' } };
      
      bot.editMessageText(paymentMsg, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown'
      });
      return;
    }

    // Admin Approvals
    if (data?.startsWith('admin_approve_') || data?.startsWith('admin_reject_')) {
      // Must be admin
      if (chatId.toString() !== adminChatId) {
        bot.answerCallbackQuery(query.id, { text: "Unauthorized" });
        return;
      }
      
      const parts = data.split('_');
      const action = parts[1]; // approve or reject
      const targetUserId = parts[2];
      const orderId = parts[3];

      const targetUser = db.users[targetUserId];
      if (!targetUser) return bot.answerCallbackQuery(query.id, { text: "User not found" });

      const targetOrder = targetUser.orders.find(o => o.id === orderId);
      if (!targetOrder) return bot.answerCallbackQuery(query.id, { text: "Order not found" });
      if (targetOrder.status !== 'pending') return bot.answerCallbackQuery(query.id, { text: "Order already processed" });

      const targetLang = targetUser.language || 'my';

      if (action === 'approve') {
        targetOrder.status = 'approved';

        if (targetOrder.type === 'reseller_sub') {
          // Handle Reseller Subscription Approval (Grant 30 Days)
          targetUser.isReseller = true;
          const now = Date.now();
          const currentExpiry = targetUser.resellerExpiry && targetUser.resellerExpiry > now ? targetUser.resellerExpiry : now;
          targetUser.resellerExpiry = currentExpiry + (30 * 24 * 60 * 60 * 1000);
          saveDB();

          bot.editMessageCaption(`✅ **Approved Reseller Sub** Order ${orderId}\nUser: ${targetUser.name} (\`${targetUser.id}\`)\nNew Expiry: ${new Date(targetUser.resellerExpiry).toLocaleDateString()}`, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown'
          });

          const expiryStr = new Date(targetUser.resellerExpiry).toLocaleDateString();
          const subApprovedMsg = targetLang === 'my'
            ? `🎉 **Reseller Subscription ကို Admin မှ အတည်ပြုပေးလိုက်ပါပြီ!**\n\n💼 သင့် Reseller Status ကို အောင်မြင်စွာ စတင်ဖွင့်လှစ်ပေးလိုက်ပါပြီ။\n⏳ သက်တမ်းကုန်ဆုံးမည့်ရက်: \`${expiryStr}\` (ရက်ပေါင်း ၃၀)\n\nယခုအခါ **'💼 Reseller Panel'** မှတစ်ဆင့် လက်ကားစျေးနှုန်းများဖြင့် အသက်သွင်းခွင့်များကို ဝယ်ယူနိုင်ပါပြီခင်ဗျာ!`
            : `🎉 **Your Reseller Subscription was approved!**\n\nExpires: \`${expiryStr}\` (30 Days)\nYou can now purchase activations at wholesale rates from the Reseller Panel!`;

          bot.sendMessage(targetUserId, subApprovedMsg, { parse_mode: 'Markdown' });
          return;
        }

        // Activations Approval (Normal or Reseller Activations)
        targetUser.activatableCount += targetOrder.activations;
        
        // Update referral purchase status if they were invited
        if (targetUser.invitedBy) {
           const inviter = Object.values(db.users).find(u => 
             Array.isArray(u.referralBatches) && u.referralBatches.some(b => b.code === targetUser.invitedBy)
           );
           if (inviter) {
              const batch = (inviter.referralBatches as ReferralBatch[]).find(b => b.code === targetUser.invitedBy);
              if (batch) {
                 const refUser = batch.users.find(u => u.id === targetUser.id);
                 if (refUser && !refUser.hasPurchased) {
                    refUser.hasPurchased = true;
                    const inviterMsg = inviter.language === 'my'
                      ? `🎉 သတင်းကောင်း! သင့် Referral ဖြင့် ဝင်ရောက်ထားသော ${targetUser.name} သည် ပထမဆုံးအကြိမ် ဝယ်ယူမှု ပြုလုပ်သွားပါပြီ!`
                      : `🎉 Good news! Your referred friend ${targetUser.name} just made their first purchase!`;
                    bot.sendMessage(parseInt(inviter.id), inviterMsg);
                 }
              }
           }
        }
        
        saveDB();

        bot.editMessageCaption(`✅ **Approved** Order ${orderId}\nUser: ${targetUser.name}`, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown'
        });

        // Notify user in their chosen language
        const userApprovedMsg = targetLang === 'my'
          ? `🎉 **Order ${orderId} ကို Admin မှ အတည်ပြုပေးလိုက်ပါပြီ!**\n\n⚡ သင့်အကောင့်သို့ **+${targetOrder.activations} Activations** ထည့်သွင်းပြီးပါပြီခင်ဗျာ။\nယခုအခါ **'🚀 AM အသက်သွင်းရန်'** ခလုတ်ကို နှိပ်၍ အကောင့်အသက်သွင်းနိုင်ပါပြီ။`
          : `🎉 Your order **${orderId}** was approved!\n${targetOrder.activations} activations have been added to your account.`;

        bot.sendMessage(targetUserId, userApprovedMsg, { parse_mode: 'Markdown' });
      } else {
        targetOrder.status = 'rejected';
        saveDB();

        bot.editMessageCaption(`❌ **Rejected** Order ${orderId}\nUser: ${targetUser.name}`, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown'
        });

        // Notify user
        const userRejectedMsg = targetLang === 'my'
          ? `❌ သင့် Order **${orderId}** ကို Admin မှ ပယ်ဖျက်လိုက်ပါသည်။ အသေးစိတ်သိရှိလိုပါက Admin သို့ ဆက်သွယ်မေးမြန်းနိုင်ပါသည်။`
          : `❌ Your order **${orderId}** was rejected. Please contact support.`;

        bot.sendMessage(targetUserId, userRejectedMsg, { parse_mode: 'Markdown' });
      }
      return;
    }

    // Redeem Reward
    if (data === 'redeem_reward') {
      let claimed = 0;
      if (Array.isArray(user.referralBatches)) {
        user.referralBatches.forEach(batch => {
          const hasPurchaser = batch.users.some(u => u.hasPurchased);
          if (hasPurchaser && !batch.rewardClaimed) {
             batch.rewardClaimed = true;
             claimed += 1;
          }
        });
      }
      
      if (claimed > 0) {
        user.activatableCount += claimed;
        saveDB();
        const alertMsg = user.language === 'my' 
          ? `Reward ရယူပြီးပါပြီ! +${claimed} Activations ထည့်သွင်းပေးလိုက်ပါသည်။` 
          : `Reward redeemed! ${claimed} Activations added.`;
        bot.answerCallbackQuery(query.id, { text: alertMsg });
        
        const notifyMsg = user.language === 'my'
          ? `🎉 Referral Rewards မှ **${claimed} Free Activation(s)** ကို အောင်မြင်စွာ ရယူပြီးပါပြီခင်ဗျာ!`
          : `🎉 You successfully redeemed ${claimed} Free Activation(s) from your referrals!`;
        bot.sendMessage(chatId, notifyMsg);
      } else {
        const noRewardMsg = user.language === 'my' ? "ရယူနိုင်သော Reward မရှိသေးပါ။" : "No rewards available.";
        bot.answerCallbackQuery(query.id, { text: noRewardMsg });
      }
      return;
    }
  });

  console.log("Telegram Bot started successfully!");
}
