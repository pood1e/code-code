import { Avatar } from "@radix-ui/themes";

type VendorAvatarProps = {
  displayName: string;
  iconUrl?: string;
  size?: "1" | "2";
};

export function VendorAvatar({ displayName, iconUrl, size = "1" }: VendorAvatarProps) {
  const fallback = displayName.trim().slice(0, 2).toUpperCase() || "M";
  return <Avatar size={size} src={iconUrl} fallback={fallback} radius="full" />;
}
