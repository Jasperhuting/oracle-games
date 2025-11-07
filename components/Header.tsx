import Link from "next/link";

export const Header = () => {


    const MenuItems =  [
        {
            name: "home",
            href: "/"
        },
        {
            name: "profile",
            href: "/profile"
        },
        {
            name: "forum",
            href: "/forum"
        },
        {
            name: "gameCalendar",
            href: "/gameCalendar"
        },
        {
            name: "myGames",
            href: "/myGames"
        },
        {
            name: "admin",
            href: "/admin"
        }        
    ]

    const userSettings = [
        {
            name: "profile",
            href: "/profile"
        },
        {
            name: "logout",
            href: "/logout"
        }
    ]


    return (
        <header className="w-full bg-white drop-shadow-header">
            <div className="container mx-auto">
                <div className="flex flex-1 justify-between py-2">
                    <div className="flex-0 flex p-2">
                       logo
                    </div>
                    <div className="menu-container flex flex-1 gap-3 justify-end my-2">
                    <div className="flex divide-solid divide-[#CAC4D0] divide-x my-3 justify-center align-middle">
                        {MenuItems.map((item) => (
                            <div key={item.name} className="gap-1 flex flex-col items-center px-3 hover:[text-shadow:0_0_0.4px_currentColor] group">
                            <Link key={item.name} href={item.href}>
                                {item.name}
                            </Link>
                            <span className="w-full h-[1px] bg-white  group-hover:bg-primary"></span>
                            </div>
                        ))}
                    </div>
                    <div className="flex divide-solid divide-[#CAC4D0] divide-x my-3 justify-center align-middle">
                        {userSettings.map((item) => (
                            <div key={item.name} className="gap-1 flex flex-col items-center px-3 hover:[text-shadow:0_0_0.4px_currentColor] group">
                            <Link key={item.name} href={item.href}>
                                {item.name}
                            </Link>
                            <span className="w-full h-[1px] bg-white  group-hover:bg-primary"></span>
                            </div>
                        ))}
                    </div>
                    </div>
                </div>
            </div>
        </header>
    );
}