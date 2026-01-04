import { AuctionGameData as GameData, RiderWithBid } from "@/lib/types/pages";
import { Bid } from "@/lib/types";
import CurrencyInput from "react-currency-input-field";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Star, SortAscending, SortDescending, ChevronLeft, ChevronRight } from "tabler-icons-react";
import { calculateAge, qualifiesAsNeoProf } from "@/lib/utils";
import { useState, useMemo, useEffect, useCallback } from "react";

type DisplayMode = 'all' | 'scroll' | 'pagination';
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50];
const SCROLL_ITEM_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];
const ITEM_HEIGHT = 38;

type SortOption = 'price' | 'name' | 'age' | 'team' | 'neoprof' | 'rank';
type SortDirection = 'asc' | 'desc';

interface DisplayPreferences {
  displayMode: DisplayMode;
  itemsPerPage: number;
  scrollItemCount: number;
  sortBy: SortOption;
  sortDirection: SortDirection;
}

export const BiddingListViewWorldTourSmall = ({
  myBids,
  game,
  availableRiders,
  adjustingBid,
  placingBid,
  bidAmountsRef,
  handlePlaceBid,
  setAdjustingBid,
  cancellingBid,
  handleCancelBidClick,
  userId,
}:
  {
    myBids: Bid[],
    game: GameData,
    availableRiders: RiderWithBid[],
    adjustingBid: string | null,
    placingBid: string | null,
    bidAmountsRef: React.RefObject<Record<string, string>>,
    handlePlaceBid: (rider: any) => void,
    setAdjustingBid: React.Dispatch<React.SetStateAction<string | null>>,
    cancellingBid: string | null,
    handleCancelBidClick: (bidId: string, riderName: string) => void,
    userId?: string,
  }) => {

  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortOption>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('all');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollItemCount, setScrollItemCount] = useState(10);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load preferences from database on mount
  useEffect(() => {
    if (!userId) return;
    
    const loadPreferences = async () => {
      try {
        const response = await fetch(`/api/getUser?userId=${userId}`);
        if (response.ok) {
          const userData = await response.json();
          const prefs = userData.displayPreferences?.biddingList;
          if (prefs) {
            if (prefs.displayMode) setDisplayMode(prefs.displayMode);
            if (prefs.itemsPerPage) setItemsPerPage(prefs.itemsPerPage);
            if (prefs.scrollItemCount) setScrollItemCount(prefs.scrollItemCount);
            if (prefs.sortBy) setSortBy(prefs.sortBy);
            if (prefs.sortDirection) setSortDirection(prefs.sortDirection);
          }
        }
      } catch (error) {
        console.error('Failed to load display preferences:', error);
      } finally {
        setPreferencesLoaded(true);
      }
    };
    
    loadPreferences();
  }, [userId]);

  // Save preferences to database when they change
  const savePreferences = useCallback(async (prefs: Partial<DisplayPreferences>) => {
    if (!userId || !preferencesLoaded) return;
    
    // Use dot notation for Firestore to update nested fields without overwriting siblings
    const updates: Record<string, unknown> = {};
    if (prefs.displayMode !== undefined) updates['displayPreferences.biddingList.displayMode'] = prefs.displayMode;
    if (prefs.itemsPerPage !== undefined) updates['displayPreferences.biddingList.itemsPerPage'] = prefs.itemsPerPage;
    if (prefs.scrollItemCount !== undefined) updates['displayPreferences.biddingList.scrollItemCount'] = prefs.scrollItemCount;
    if (prefs.sortBy !== undefined) updates['displayPreferences.biddingList.sortBy'] = prefs.sortBy;
    if (prefs.sortDirection !== undefined) updates['displayPreferences.biddingList.sortDirection'] = prefs.sortDirection;
    
    try {
      const response = await fetch('/api/updateUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          updates
        })
      });
      
      if (!response.ok) {
        console.error('Failed to save preferences:', await response.text());
      }
    } catch (error) {
      console.error('Failed to save display preferences:', error);
    }
  }, [userId, preferencesLoaded]);

  const sortedBids = useMemo(() => {
    const filtered = myBids.filter((bid) => bid.status !== 'won' && bid.status !== 'lost');

    return filtered.sort((a, b) => {
      const riderA = availableRiders.find((rider: any) => rider.id === a.riderNameId || rider.nameID === a.riderNameId);
      const riderB = availableRiders.find((rider: any) => rider.id === b.riderNameId || rider.nameID === b.riderNameId);

      if (!riderA || !riderB) return 0;

      let comparison = 0;

      switch (sortBy) {
        case 'price':
          comparison = (riderB.myBid || 0) - (riderA.myBid || 0);
          break;
        case 'name':
          comparison = (riderA.name || '').localeCompare(riderB.name || '');
          break;
        case 'age': {
          const ageA = typeof riderA.age === 'number' ? riderA.age : parseInt(String(riderA.age || '0'), 10);
          const ageB = typeof riderB.age === 'number' ? riderB.age : parseInt(String(riderB.age || '0'), 10);
          comparison = ageA - ageB;
          break;
        }
        case 'team': {
          const teamA = riderA.team?.name || '';
          const teamB = riderB.team?.name || '';
          // Zet lege teams onderaan
          if (!teamA && teamB) return 1;
          if (teamA && !teamB) return -1;
          comparison = teamA.localeCompare(teamB);
          break;
        }
        case 'neoprof': {
          const isNeoProfA = qualifiesAsNeoProf(riderA, game.config) ? 1 : 0;
          const isNeoProfB = qualifiesAsNeoProf(riderB, game.config) ? 1 : 0;
          comparison = isNeoProfB - isNeoProfA;
          break;
        }
        case 'rank':
          comparison = (riderA.rank || 0) - (riderB.rank || 0);
          break;
        default:
          return 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [myBids, availableRiders, sortBy, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedBids.length / itemsPerPage);
  const paginatedBids = displayMode === 'pagination'
    ? sortedBids.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : sortedBids;

  // Reset to page 1 when changing items per page or display mode
  const handleItemsPerPageChange = (newValue: number) => {
    setItemsPerPage(newValue);
    setCurrentPage(1);
    savePreferences({ itemsPerPage: newValue });
  };

  const handleDisplayModeChange = (newMode: DisplayMode) => {
    setDisplayMode(newMode);
    setCurrentPage(1);
    savePreferences({ displayMode: newMode });
  };

  const handleScrollItemCountChange = (newValue: number) => {
    setScrollItemCount(newValue);
    savePreferences({ scrollItemCount: newValue });
  };

  const handleSortByChange = (newValue: SortOption) => {
    setSortBy(newValue);
    savePreferences({ sortBy: newValue });
  };

  const handleSortDirectionToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    savePreferences({ sortDirection: newDirection });
  };

  return <>



    <div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 items-center justify-start flex-wrap gap-4 py-4">
      {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
        {game?.gameType === 'worldtour-manager' ? 'No riders selected yet.' : 'No bids placed yet.'}
      </div>}
      {myBids.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm font-medium">Sorteren op:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSortByChange(e.target.value as SortOption)}
            className="pl-3 pr-5 min-w-[120px] py-1.5 text-sm font-normal border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.25rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em'
            }}
          >
            <option value="price">{game.gameType === 'marginal-gains' ? 'Points' : 'Prijs'}</option>
            <option value="rank">Rank</option>
            <option value="name">Naam</option>
            <option value="age">Leeftijd</option>
            <option value="team">Ploeg</option>
            <option value="neoprof">Neo-Prof</option>
          </select>
          <button
            onClick={handleSortDirectionToggle}
            className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
            title={sortDirection === 'asc' ? 'Oplopend' : 'Aflopend'}
          >
            {sortDirection === 'asc' ? <SortAscending size={18} /> : <SortDescending size={18} />}
          </button>

          <div className="border-l border-gray-300 h-6 mx-2" />

          <label className="text-sm font-medium">Weergave:</label>
          <select
            value={displayMode}
            onChange={(e) => handleDisplayModeChange(e.target.value as DisplayMode)}
            className="pl-3 pr-5 min-w-[120px] py-1.5 text-sm font-normal border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.25rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em'
            }}
          >
            <option value="all">Alles tonen</option>
            <option value="scroll">Scroll</option>
            <option value="pagination">Pagination</option>
          </select>

          {displayMode === 'scroll' && (
            <>
              <label className="text-sm font-medium ml-2">Aantal items:</label>
              <select
                value={scrollItemCount}
                onChange={(e) => handleScrollItemCountChange(Number(e.target.value))}
                className="pl-3 pr-5 min-w-[70px] py-1.5 text-sm font-normal border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.25rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                {SCROLL_ITEM_COUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </>
          )}

          {displayMode === 'pagination' && (
            <>
              <label className="text-sm font-medium ml-2">Per pagina:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="pl-3 pr-5 min-w-[70px] py-1.5 text-sm font-normal border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.25rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
      {myBids.length > 0 && game.gameType !== 'worldtour-manager' && (
        <div className="flex flex-row w-full p-2">
          <span className="font-bold basis-[90px]">{t('global.price')}</span>
          <span className="font-bold basis-[90px]">{t('global.bid')}</span>
          <span className="font-bold flex-1">{t('global.name')}</span>
          <span className="font-bold basis-[300px]">{t('global.team')}</span>
          <span className="font-bold basis-[200px]"></span>
        </div>
      )}
      <div className={`flex flex-col ${displayMode === 'scroll' ? 'overflow-y-auto' : ''}`} style={displayMode === 'scroll' ? { maxHeight: `${scrollItemCount * ITEM_HEIGHT}px` } : undefined}>



        {paginatedBids.map((myBidRider) => {
          const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId || rider.nameID === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
          const canCancel = myBidRider.status === 'active' || myBidRider.status === 'outbid';
          const riderNameId = rider?.nameID || rider?.id || '';

          return rider ?
            <div key={myBidRider.id} className="bg-white px-2 relative border rounded-lg border-gray-200 flex flex-row gap-2 items-center justify-between">
              <div className="flex items-center">
                 {rider.rank && (
                <span className="text-gray-500 text-xs whitespace-nowrap min-w-[34px] mr-2">
                  #{rider.rank}
                </span>
              )}
              <div className="flex items-center">
                {qualifiesAsNeoProf(rider, game.config) && <Star size={15} color="#ff9900" className="flex-shrink-0" />}
                <span className={`truncate font-medium ${qualifiesAsNeoProf(rider, game.config) ? 'ml-1' : ''}`}>
                  {rider.name}
                </span>
              </div>

              <span className="text-gray-600 text-xs truncate ml-2">{rider.team?.name || '-'}</span>

              {rider.age && (
                <span className="text-gray-500 text-xs whitespace-nowrap ml-2">
                  {calculateAge(rider.age)} jr
                </span>
              )}
              </div>

              <div className="flex gap-2 items-center justify-between mt-1">
                <span className="font-medium whitespace-nowrap text-sm">
                  {game.gameType === 'marginal-gains' ? `${rider.myBid} ${rider.myBid === 1 ? 'point' : 'points'}` : rider.myBid === 0 ? formatCurrencyWhole(1) : formatCurrencyWhole(rider.myBid || 1)}
                </span>
                {canCancel && (
                  <>
                    {adjustingBid === rider.myBidId ? (
                      <div className="flex gap-2 items-center flex-1">
                        <CurrencyInput
                          id={`adjust-bid-list-${rider.myBidId}`}
                          name="adjust-bid"
                          className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`${rider.myBid || 0}`}
                          decimalsLimit={0}
                          disabled={placingBid === riderNameId}
                          defaultValue={bidAmountsRef.current[riderNameId] || ''}
                          onValueChange={(value) => {
                            bidAmountsRef.current[riderNameId] = value || '0';
                          }}
                        />
                        <Button
                          type="button"
                          text={placingBid === riderNameId ? t('global.loading') : t('global.save')}
                          onClick={() => {
                            handlePlaceBid(rider);
                            setAdjustingBid(null);
                          }}
                          disabled={placingBid === riderNameId}
                          className="px-2 py-1 text-sm"
                          size="sm"
                          variant="primary"
                        />
                        <Button
                          type="button"
                          text={t('global.cancel')}
                          onClick={() => setAdjustingBid(null)}
                          className="px-2 py-1 text-sm"
                          size="sm"
                          ghost
                        />
                      </div>
                    ) : (
                      <Button
                        type="button"
                        text={cancellingBid === rider.myBidId ? t('global.loading') : t('global.reset')}
                        onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                        disabled={cancellingBid === rider.myBidId}
                        className="px-2 mb-[2px] py-1 text-sm whitespace-nowrap"
                        ghost
                        size="sm"
                        title={t('global.cancelBid')}
                        variant="danger"
                      />
                    )}
                  </>
                )}
              </div>
            </div> : null

        })}
      </div>

      {/* Pagination controls */}
      {displayMode === 'pagination' && totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {sortedBids.length} renners totaal • Pagina {currentPage} van {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>


  </>
}