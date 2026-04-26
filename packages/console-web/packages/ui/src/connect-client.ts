import type { DescService } from "@bufbuild/protobuf";
import { createClient, type Client, type Transport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { getApiRequestUrl } from "./api-base-url";

let transport: Transport | undefined;

export function connectClient<T extends DescService>(service: T): Client<T> {
  return createClient(service, getTransport());
}

function getTransport() {
  transport ??= createConnectTransport({
    baseUrl: getApiRequestUrl("/api/connect"),
    useBinaryFormat: true
  });
  return transport;
}
