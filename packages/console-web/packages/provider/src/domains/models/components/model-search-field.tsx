import { SearchTextField } from "@code-code/console-web-ui";

type ModelSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ModelSearchField({ value, onChange }: ModelSearchFieldProps) {
  return (
    <SearchTextField
      ariaLabel="Search models or services"
      placeholder="Search models or services"
      size="2"
      value={value}
      onValueChange={onChange}
    />
  );
}
