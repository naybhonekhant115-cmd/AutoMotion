export interface ReferredUser {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  hasPurchased: boolean;
  firstPurchasedAt?: string;
}

export interface ReferralBatch {
  code: string;
  createdAt: string;
  users: ReferredUser[];
  status: 'active' | 'completed' | 'rewarded';
  rewardClaimed: boolean;
}

export interface ReferredByInfo {
  inviterId: string;
  inviterName: string;
  code: string;
  appliedAt: string;
  bonusClaimed: boolean;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'telegram' | 'guest';
  purchases: number;
  referrals: number;
  rewardsToClaim: number;
  activatableCount: number;
  refCode: string;
  referredBy?: ReferredByInfo;
  referralBatches: ReferralBatch[];
  orders: Order[];
  ledger: LedgerEntry[];
}

export interface Order {
  id: string;
  digits: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

export interface LedgerEntry {
  id: string;
  type: 'order' | 'reward' | 'usage' | 'bonus';
  description: string;
  date: string;
}

export interface AccountInfo {
  quota?: {
    daily?: {
      limit?: number | string;
      remaining?: number | string;
    };
  };
}
