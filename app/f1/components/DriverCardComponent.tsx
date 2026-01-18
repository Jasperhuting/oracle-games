import { Driver } from "../data"
import { Flag } from "@/components/Flag"

export const DriverCard = ({ driver, small }: { driver: Driver, small?: boolean }) => {

    return <>
    <div className={`group rounded-md p-1 pl-2 justify-center items-center content-center md:p-3 relative overflow-hidden ${small ? '' : ''}`}>
                    <div
                        style={{ background: `linear-gradient(to left, ${driver.teamColor}, ${driver.teamColorAlt})` }}
                        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-75 bg-gray-600"
                    />
                    <div className="relative z-10 flex flex-row md:flex-col">
                        <span className="block text-xs lg:hidden text-white font-nunito font-black">{driver.shortName}</span>
                        <span className="text-md lg:text-3xl xl:text-2xl text-white font-nunito font-black hidden lg:block">
                            {driver.firstName}
                        </span>
                        <span className="text-md lg:text-2xl xl:text-xl text-white font-nunito font-regular hidden lg:block">{driver.lastName}</span>
                        <span className="text-xs lg:text-lg xl:text-base text-white font-nunito font-regular whitespace-nowrap ml-2 md:ml-0 hidden md:block">{driver.team}</span>
                        <span className="text-md lg:text-lg xl:text-base text-white absolute md:top-4 md:bottom-1 top-2 right-2 md:right-0 font-lato font-black hidden md:block">{driver.numberImage ? <img className="z-0 w-[25px] h-[25px] md:w-[20px] md:h-[20px] lg:h-[25px] lg:w-[25px]" src={driver.numberImage} alt={driver.lastName} /> : <span className="text-xl md:text-xl lg:text-3xl font-sans">{driver.number}</span>}</span>
                        <span className="text-md lg:text-lg xl:text-base text-white hidden lg:block"><Flag countryCode={driver.country} /></span>
                    </div>
                    <img className={`absolute hidden lg:block top-0 z-[5] ${small ? 'w-1/5 right-20' : ' w-2/5 sm:w-3/5 right-5 lg:w-3/5 xl:w-4/5'}`} src={driver.image} alt={driver.firstName} />
                </div>
    </>

}