import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useState } from "react";

type ConfirmActionButtonProps = {
  title: string;
  description: ReactNode;
  confirmText?: string;
  confirmLoadingText?: string;
  cancelText?: string;
  confirmColor?: "red" | "blue" | "gray";
  disabled?: boolean;
  children: ReactNode;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmActionButton({
  title,
  description,
  confirmText = "Confirm",
  confirmLoadingText = "Loading...",
  cancelText = "Cancel",
  confirmColor = "red",
  disabled,
  children,
  onConfirm,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <span
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? true : undefined}
        style={{
          display: "inline-flex",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => {
          if (disabled || isConfirming) {
            return;
          }
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled || isConfirming) {
            return;
          }
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </span>
      <AlertDialog.Content>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
        <Flex mt="3" justify="end" gap="2">
          <AlertDialog.Cancel>
            <Button size="2" variant="soft" color="gray">
              {cancelText}
            </Button>
          </AlertDialog.Cancel>
          <Button
            size="2"
            color={confirmColor}
            variant="solid"
            disabled={isConfirming || disabled}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {isConfirming ? confirmLoadingText : confirmText}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
