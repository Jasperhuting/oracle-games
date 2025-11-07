import { useState } from "react";
import { MyTeamSelectionRow } from "./MyTeamSelectionRow";
import { ChevronDown, ChevronUp } from "tabler-icons-react";
import { motion, AnimatePresence } from "framer-motion";

export const MyTeamSelection = ({ myTeamSelection, setMyTeamSelection }: { myTeamSelection: any[], setMyTeamSelection: (myTeamSelection: any[]) => void }) => {

    const [open, setOpen] = useState(true);

    return (
        <div className={`fixed bottom-0 px-4 pt-4 drop-shadow-header right-5 w-[calc(100%_-_600px)] max-w-[900px] min-w-[600px] bg-white rounded-t-lg border border-gray-200 transition-transform duration-300 ease-in-out ${open ? 'translate-y-0' : 'translate-y-[calc(100%_-_58px)]'}`}>
            <div onClick={() => setOpen(!open)} className="flex items-center justify-between pb-2 px-2">
                <h2 className="text-lg font-bold">Mijn Team</h2>
                <button className="text-gray-500 cursor-pointer">
                    {open ? <ChevronDown /> : <ChevronUp />}
                </button>
            </div>

            <div className="flex flex-col w-full divide-y divide-[#CAC4D0] max-h-[400px] overflow-y-auto">
                <AnimatePresence initial={false} mode="sync">
                    {myTeamSelection?.map((rider) => (
                        <motion.div
                            key={rider.id}
                            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                            animate={{ 
                                opacity: 1,
                                height: "auto",
                                overflow: "visible",
                                transition: {
                                    height: { duration: 0.3, ease: "easeOut" },
                                    opacity: { duration: 0.2, delay: 0.1 },
                                    overflow: { delay: 0.3 }
                                }
                            }}
                            exit={{ 
                                opacity: 0,
                                height: 0,
                                overflow: "hidden",
                                transition: {
                                    height: { duration: 0.3, ease: "easeIn", delay: 0.1 },
                                    opacity: { duration: 0.2 }
                                }
                            }}
                        >
                            <MyTeamSelectionRow rider={rider} removeItem={(rider) => setMyTeamSelection(myTeamSelection.filter((p) => p.id !== rider.id))} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

        </div>
    );
}