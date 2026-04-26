import { Card, Flex, Heading, Table, Text } from "@radix-ui/themes";
import type { CredentialView } from "../api";
import { CredentialDetail, CredentialName, CredentialVendor } from "./credential-table-cells";
import { DeleteCredentialDialog } from "./delete-credential-dialog";

type CredentialTableProps = {
  credentials: CredentialView[];
  kind: "api-key" | "oauth" | "cookie";
  onDelete: (id: string) => Promise<void>;
};

const tableConfig = {
  "api-key": { title: "API Keys", empty: "No API keys.", columns: ["Name", "Vendor", "Status"] },
  oauth: { title: "OAuth Credentials", empty: "No OAuth credentials.", columns: ["Name", "Provider", "Account"] },
  cookie: { title: "Cookie Credentials", empty: "No cookie credentials.", columns: ["Name", "Vendor", "Cookie Type"] }
};

export function CredentialsTable({ credentials, kind, onDelete }: CredentialTableProps) {
  const config = tableConfig[kind];
  return (
    <Card size="2" variant="classic">
      <Flex justify="between" align="center" mb="3">
        <Heading size="3" weight="medium">{config.title}</Heading>
        <Text size="1" color="gray">{credentials.length} total</Text>
      </Flex>
      {credentials.length ? (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              {config.columns.map((column) => <Table.ColumnHeaderCell key={column}>{column}</Table.ColumnHeaderCell>)}
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {credentials.map((credential) => (
              <CredentialRow key={credential.credentialId} credential={credential} kind={kind} onDelete={onDelete} />
            ))}
          </Table.Body>
        </Table.Root>
      ) : (
        <Text size="2" color="gray">{config.empty}</Text>
      )}
    </Card>
  );
}

type CredentialRowProps = {
  credential: CredentialView;
  kind: CredentialTableProps["kind"];
  onDelete: CredentialTableProps["onDelete"];
};

function CredentialRow({ credential, kind, onDelete }: CredentialRowProps) {
  return (
    <Table.Row align="center">
      <Table.RowHeaderCell><CredentialName credential={credential} /></Table.RowHeaderCell>
      <Table.Cell><CredentialVendor credential={credential} /></Table.Cell>
      <Table.Cell><CredentialDetail credential={credential} kind={kind} /></Table.Cell>
      <Table.Cell justify="end">
        <DeleteCredentialDialog credentialId={credential.credentialId} displayName={credential.displayName} onDelete={onDelete} />
      </Table.Cell>
    </Table.Row>
  );
}
