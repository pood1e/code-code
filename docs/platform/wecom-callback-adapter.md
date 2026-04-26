# WeCom Callback Adapter

## responsibility

`wecom-callback-adapter` owns the public Enterprise WeChat callback protocol boundary.

It provides the Enterprise WeChat callback URL, validates callback signatures, decrypts callback payloads, acknowledges valid callbacks, and publishes decrypted messages to NATS.

## external fields

- HTTP endpoint: `GET /wecom/callback`
- HTTP endpoint: `POST /wecom/callback`
- HTTP endpoint: `GET /wecom/robots/default/callback`
- HTTP endpoint: `POST /wecom/robots/default/callback`
- callback URL: `https://bot.pood1e.monster:8443/wecom/callback`
- robot callback URL: `https://bot.pood1e.monster:8443/wecom/robots/default/callback`
- Secret `wecom-callback`: `token`, `encoding-aes-key`
- Secret `wecom-robot-default-callback`: `token`, `encoding-aes-key`
- NATS subject: `platform.wecom.messages.received`
- NATS subject: `platform.wecom.robots.default.messages.received`
- protobuf event: `platform.notification.v1.InboundMessageEvent`
- `InboundMessageEvent.provider`
- `InboundMessageEvent.received_at`
- `InboundMessageEvent.wecom.timestamp`
- `InboundMessageEvent.wecom.nonce`
- `InboundMessageEvent.wecom.receive_id`
- `InboundMessageEvent.wecom.message_xml`
- `InboundMessageEvent.wecom.message`

## implementation notes

- `GET /wecom/callback` validates `msg_signature`, `timestamp`, `nonce`, and encrypted `echostr`, then returns decrypted plaintext.
- `POST /wecom/callback` extracts JSON `encrypt` or XML `Encrypt`, validates signature, decrypts the payload, publishes one protobuf event, and returns `success`.
- Robot callbacks use one exact path and one Secret per robot.
- Enterprise WeChat callback crypto uses AES-CBC with the WeCom PKCS#7 padding block size `32`.
- The callback URL is provided by this platform through Ingress; it is configured in Enterprise WeChat and is not stored as a Secret.
- `wecom.receive_id` is parsed from the decrypted callback payload; operators do not configure it.
- Public ingress exposes only the WeCom callback path. Internal notification trigger paths stay internal.
