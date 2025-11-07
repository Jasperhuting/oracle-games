import clsx from "clsx";

export const Flag = ({ countryCode, className, width = 20 }: { countryCode: string, className?: string, width?: number }) => {
    return <span
      className={clsx(`fi fi-${countryCode.toLowerCase()}`, className)}
      style={{
        width: width,
        height: width,
        borderRadius: "50%",
        border: "2px solid white",
        boxShadow: "0 0 2px rgba(0,0,0,0.3)",
        display: "inline-block",
        backgroundSize: "cover",
      }}
    />;
};