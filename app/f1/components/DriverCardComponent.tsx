import { Driver } from "../page"
import { Flag } from "@/components/Flag"

export const DriverCard = ({ driver, small }: { driver: Driver, small?: boolean }) => {

    return <>
    <div className={`group rounded-md p-3 ${small ? '' : 'min-h-[120px] sm:min-h-[280px] md:min-h-[225px] lg:min-h-[230px] xl:min-h-[270px]'} relative overflow-hidden`}>
                    <div
                        style={{ background: `linear-gradient(to left, ${driver.teamColor}, ${driver.teamColorAlt})` }}
                        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-75 bg-gray-600"
                    />
                    <div className="relative z-10 flex flex-col">
                        <span className="text-2xl md:text-3xl text-white font-nunito font-black">{driver.firstName}</span>
                        <span className="text-xl md:text-2xl text-white font-nunito font-regular">{driver.lastName}</span>
                        <span className="text-md md:text-lg text-white font-nunito font-regular">{driver.team}</span>
                        <span className="text-md md:text-lg text-white absolute top-2 right-2 font-lato font-black">{driver.numberImage ? <img className="z-0 w-[25px] h-[25px] md:w-[50px] md:h-[50px]" src={driver.numberImage} alt={driver.lastName} /> : <span className="text-xl md:text-5xl font-sans">{driver.number}</span>}</span>
                        <span className="text-md md:text-lg text-white"><Flag countryCode={driver.country} /></span>
                    </div>
                    <img className={`absolute top-0 z-[5] ${small ? 'w-1/5 right-20' : ' w-2/5 sm:w-3/5 right-5 lg:w-3/5 xl:w-4/5'}`} src={driver.image} alt={driver.firstName} />
                </div>
    </>

}