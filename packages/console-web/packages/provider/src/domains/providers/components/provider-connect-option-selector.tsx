import { scopedProviderConnectOptionLabel, type ProviderConnectOption } from "../provider-connect-options";
import { FormSelectField } from "@code-code/console-web-ui";

type Props = {
  connectOptions: ProviderConnectOption[];
  selectedOptionId: string;
  label: string;
  onChange: (connectOptionId: string) => void;
};

export function ProviderConnectOptionSelector({
  connectOptions,
  selectedOptionId,
  label,
  onChange,
}: Props) {
  return (
    <FormSelectField
      label={label}
      value={selectedOptionId}
      items={connectOptions.map((item) => ({
        value: item.id,
        label: scopedProviderConnectOptionLabel(item),
      }))}
      triggerStyle={{ width: "100%" }}
      onValueChange={onChange}
    />
  );
}
