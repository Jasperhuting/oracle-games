import * as Ariakit from "@ariakit/react";
import clsx from "clsx";
import * as React from "react";

export { MenuProvider } from "@ariakit/react";

export const Menu = React.forwardRef<HTMLDivElement, Ariakit.MenuProps>(
  function Menu(props, ref) {
    const menu = Ariakit.useMenuContext();
    return (
      <Ariakit.Menu
        ref={ref}
        portal
        fitViewport
        unmountOnHide
        overlap={!!menu?.parent}
        gutter={menu?.parent ? 12 : 4}
        shift={menu?.parent ? -9 : -2}
        flip={menu?.parent ? true : "bottom-end"}
        {...props}
        className={clsx(
          "cursor-pointer relative z-50 flex flex-col min-w-[180px] w-max overflow-auto overscroll-contain rounded-lg border border-solid border-[hsl(204,20%,88%)] bg-white  text-black shadow-lg outline-none",
          "dark:border-[hsl(204,4%,24%)]]",
          props.className
        )}
      />
    );
  },
);

interface MenuButtonProps extends Ariakit.MenuButtonProps {}

export const MenuButton = React.forwardRef<HTMLDivElement, MenuButtonProps>(
  function MenuButton(props, ref) {
    const menu = Ariakit.useMenuContext();
    return (
      <Ariakit.MenuButton ref={ref} {...props}>
        <span className="flex-1 pr-8 p-2">{props.children}</span>
        {!!menu?.parent && <Ariakit.MenuButtonArrow />}
      </Ariakit.MenuButton>
    );
  },
);

export const MenuItem = React.forwardRef<HTMLDivElement, Ariakit.MenuItemProps>(
  function MenuItem(props, ref) {
    return (
      <Ariakit.MenuItem
        ref={ref}
        {...props}
        className={clsx(
          "flex cursor-pointer scroll-m-2 items-center gap-2 rounded outline-none pb-[6px]",
          "aria-disabled:opacity-25",
          "data-[active-item]:bg-white data-[active-item]:hover:bg-gray-50 data-[active-item]:text-black",
          props.className
        )}
      />
    );
  },
);

export const MenuSeparator = React.forwardRef<
  HTMLHRElement,
  Ariakit.MenuSeparatorProps
>(function MenuSeparator(props, ref) {
  return (
    <Ariakit.MenuSeparator
      ref={ref}
      {...props}
      className={clsx(
        "my-2 h-0 w-full border-t border-[hsl(204,20%,88%)]",
        "dark:border-[hsl(204,4%,28%)]",
        props.className
      )}
    />
  );
});
