/**
 * Bid & Backup Types
 * Types for bidding, auctions, and bid backup functionality
 */

import { AuctionPeriod } from "./games";

export interface BidBackupToolProps {
  gameId: string;
  adminUserId: string;
  auctionPeriods: AuctionPeriod[];
}

export interface BidBackupGame {
  id: string;
  name: string;
  gameType: string;
  year?: number;
  status?: string;
  division?: string;
  config: {
    auctionPeriods?: AuctionPeriod[];
  };
}
