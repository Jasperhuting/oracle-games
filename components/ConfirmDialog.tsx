'use client'

import * as Ariakit from "@ariakit/react";
import { Button } from "./Button";
import { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'primary'
}: ConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-xs" />
      )}
      <Ariakit.Dialog
        open={open}
        onClose={onClose}
        backdrop={<div className="fixed inset-0 z-[998] bg-black/50 backdrop-blur-sm" />}
        className="fixed inset-3 sm:top-[10vh] sm:bottom-[10vh] sm:mt-0 sm:max-h-[80vh] sm:w-[420px] z-[999] m-auto flex h-fit max-h-[calc(100dvh-1.5rem)] flex-col gap-4 overflow-auto rounded-xl bg-white p-4 sm:p-6 text-black shadow-[0_25px_50px_-12px_rgb(0_0_0/0.25)] dark:border dark:border-solid dark:border-[hsl(204,4%,24%)] dark:bg-[hsl(204,4%,16%)] dark:text-white"
      >
      <Ariakit.DialogHeading className="m-0 text-xl font-semibold">
        {title}
      </Ariakit.DialogHeading>

      <div className="text-gray-700 dark:text-gray-300">
        {typeof description === 'string' ? <p>{description}</p> : description}
      </div>

      <div className="flex gap-2 justify-end mt-2">
        <Ariakit.DialogDismiss
          className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-4 text-base font-medium text-black border border-gray-300 hover:border-gray-400 active:pt-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(204,100%,40%)] dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:border-white/25"
        >
          {cancelText}
        </Ariakit.DialogDismiss>

        <Button
          onClick={handleConfirm}
          variant={variant}
        >
          {confirmText}
        </Button>
      </div>
      </Ariakit.Dialog>
    </>
  );
};
