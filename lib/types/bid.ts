/**
 * Bid & Backup Types
 * Types for bidding, auctions, and bid backup functionality
 */

export interface BidBackupToolProps {
  gameId: string;
  adminUserId: string;
  auctionPeriods: Array<{
    name: string;
    startDate: any;
    endDate: any;
  }>;
}

export interface BidBackupGame {
  id: string;
  name: string;
  gameType: string;
  year?: number;
  status?: string;
  division?: string;
  config: {
    auctionPeriods?: Array<{
      name: string;
      startDate: any;
      endDate: any;
    }>;
  };
}
