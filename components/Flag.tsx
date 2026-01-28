import clsx from "clsx";

export const Flag = ({ countryCode, className, width = 20 }: { countryCode: string, className?: string, width?: number }) => {

  if (countryCode === 'ru') {
    return <span 
    style={{
        width: width,
        height: width,
        borderRadius: "50%",
        border: "2px solid white",
        boxShadow: "0 0 2px rgba(0,0,0,0.3)",
        display: "inline-block",
        backgroundSize: "cover",
      }}
      className={clsx(`fi `, className)}
    ><img className="absolute left-0 top-0" width={20} height={20} src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Seal_of_the_Individual_Neutral_Athletes_at_the_2024_Summer_Olympics.svg/250px-Seal_of_the_Individual_Neutral_Athletes_at_the_2024_Summer_Olympics.svg.png" alt="" /></span>
  }


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