import { useState } from "react";
import { Pagination } from "./Pagination";
import { PlayerCard } from "./PlayerCard";
import { PlayerRow } from "./PlayerRow";
import { MyTeamSelection } from "./MyTeamSelection";
import { ActionPanel } from "./ActionPanel";

export const RidersOverview = () => {

    // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [startingList, setStartingList] = useState<any[]>([]);
  const [showPlayerCard, setShowPlayerCard] = useState(false);
  const [myTeamSelection, setMyTeamSelection] = useState<any[]>([]);


    return (
        <>
        <ActionPanel 
                  showPlayerCard={showPlayerCard} 
                  setShowPlayerCard={setShowPlayerCard} 
                  />
          <Pagination
          currentPage={currentPage}
          totalItems={startingList?.length || 0}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        <div className={`w-full ${showPlayerCard ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4' : 'flex flex-col items-start bg-white rounded-md divide-y divide-[#CAC4D0] justify-start flex-wrap my-4 pb-4'}`}>
          {startingList?.length > 0 ?
            startingList
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .map((player, index) => {
              return (
                <div key={player.id || index} className="flex w-full">
                  {showPlayerCard ?
                    <PlayerCard player={player} selected={myTeamSelection.includes(player)} onClick={(player) => myTeamSelection.includes(player) ? setMyTeamSelection(myTeamSelection.filter((p) => p.id !== player.id)) : setMyTeamSelection([...myTeamSelection, player])} />
                    :
                    <PlayerRow index={index} showButton showRank fullWidth selectedPlayer={myTeamSelection.includes(player)} player={player} selectPlayer={(player) => myTeamSelection.includes(player) ? setMyTeamSelection(myTeamSelection.filter((p) => p.id !== player.id)) : setMyTeamSelection([...myTeamSelection, player])} />}
                </div>
              );
            })
            :
            <p>No riders found</p>
          }
        </div>
        <MyTeamSelection myTeamSelection={myTeamSelection} setMyTeamSelection={setMyTeamSelection} />
        </>
    );
}