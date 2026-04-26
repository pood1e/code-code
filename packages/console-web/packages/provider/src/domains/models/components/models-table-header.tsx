import { Table } from "@radix-ui/themes";

export function ModelsTableHeader() {
  return (
    <Table.Header>
      <Table.Row>
        <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
        <Table.ColumnHeaderCell>Capabilities</Table.ColumnHeaderCell>
        <Table.ColumnHeaderCell>Context Window</Table.ColumnHeaderCell>
        <Table.ColumnHeaderCell>Price</Table.ColumnHeaderCell>
        <Table.ColumnHeaderCell justify="end" />
      </Table.Row>
    </Table.Header>
  );
}
