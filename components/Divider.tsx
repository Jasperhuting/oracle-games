export const Divider = ({margin} : {margin?: number}) => {
    return <div className={`h-[1px] bg-gray-200 ${margin ? `my-[${margin}px]` : ''}`}></div>
}