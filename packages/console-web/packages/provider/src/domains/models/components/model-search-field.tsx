import { SearchTextField } from "@code-code/console-web-ui";

type ModelSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ModelSearchField({ value, onChange }: ModelSearchFieldProps) {
  return (
    <SearchTextField
      aria-label="Query model id"
      placeholder="Search by name or model ID"
      size="2"
      value={value}
      onValueChange={onChange}
    />
  );
}
