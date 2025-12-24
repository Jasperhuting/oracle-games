import { getLiveScores } from "@/lib/scraper/livescore/getLiveScore";
import Image from 'next/image';


export default async function LiveScorePage() {
    const games = await getLiveScores();


    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Live Score Page</h1>
            {games.map((game) => {

                const homeTeam = game.T1[0];
                const awayTeam = game.T2[0];

                const homeScore = game.Tr1;
                const awayScore = game.Tr2;

                const isHomeWin = homeScore > awayScore;
                const isAwayWin = awayScore > homeScore;
                const isDraw = homeScore === awayScore;

                const gameIsFinished = game.Eps === 'FT';
                const gameIsHalftime = game.Eps === 'HT';


                return (<div key={game.Eid} className="mb-4 p-4 border rounded bg-gray-900 text-white flex items-center gap-4 justify-center">
                    <div className="flex items-center justify-end gap-2 w-[30%]">
                        <Image
                            src={`https://storage.livescore.com/images/team/medium/${homeTeam.Img}`}
                            alt={homeTeam.Nm}
                            width={32}
                            height={32}
                            className="w-8 h-8"
                        />
                        <strong className="text-lg">{homeTeam.Nm}</strong>
                        <span className={`ml-4 text-lg font-bold ${!gameIsFinished ? (isHomeWin ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-gray-200') : ''}`}>{homeScore}</span>
                    </div>
                    <div className="flex flex-col items-center">
                    <span className={`font-semibold ${gameIsFinished ? 'text-gray-500' : gameIsHalftime ? 'text-yellow-400' : 'text-orange-200'}`}>{game.Eps}</span>
                    <span className="text-gray-200">vs</span>
                    </div>
                    <div className="flex items-center justify-start gap-2 w-[30%]">
                        <span className={`mr-4 text-lg font-bold ${!gameIsFinished ? (isAwayWin ? 'text-green-600' : isDraw ? 'text-yellow-400' : 'text-gray-200') : ''}`}>{awayScore}</span>
                        <strong className={`text-lg`}>{awayTeam.Nm}</strong>
                        <Image
                            src={`https://storage.livescore.com/images/team/medium/${awayTeam.Img}`}
                            alt={awayTeam.Nm}
                            width={32}
                            height={32}
                            className="w-8 h-8"
                        />
                    </div>
                </div>)
            })}
        </div>
    );
}
