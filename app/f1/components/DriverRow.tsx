import { Row } from "@/components/Row";
import { Driver } from "../data";


export const DriverRow = ({
    driver,
    selectDriver,
    selectedDriver
}: {
    driver: Driver, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectDriver: (driver: Driver) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectedDriver?: boolean // eslint-disable-line @typescript-eslint/no-explicit-any 
}) => {
    return (
        <Row
            item={driver}
            onSelect={selectDriver}
            isSelected={selectedDriver}
        >
            {driver?.image && (
                <span className={`w-[30px] h-[30px] rounded-full relative overflow-hidden `} style={{ backgroundColor: driver.teamColor }}>
                    <img
                        src={driver?.image}
                        alt={driver?.firstName}
                        style={{ width: '40px', height: 'auto' }}
                        className="absolute top-0 left-0"
                    />
                </span>
            )}

            <span className="break-keep whitespace-nowrap font-lato font-bold">
                {driver.firstName}
            </span>
            <span className="break-keep whitespace-nowrap font-lato font-regular">
                {driver.lastName}
            </span>


            <span className="break-keep whitespace-nowrap font-lato font-bold">
                {driver.numberImage ? <img src={driver.numberImage} style={{ width: '20px', height: 'auto' }} className=" invert" alt={driver.firstName} /> : driver.number}
            </span>
            <span className="break-keep whitespace-nowrap" style={{ color: driver.teamColor }}>
                {driver.team}
            </span>
        </Row>
    );
}