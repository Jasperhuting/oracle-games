import { Row } from "./Row";

export const ClassRow = ({ 
    name,
    selectClass,
    selectedClass
}: { 
    name: string, 
    selectClass: (name: string) => void, 
    selectedClass?: boolean 
}) => {
    return (
        <Row
            item={name}
            onSelect={selectClass}
            isSelected={selectedClass}
        >
            <span className="break-keep whitespace-nowrap">{name}</span>
        </Row>
    );
};