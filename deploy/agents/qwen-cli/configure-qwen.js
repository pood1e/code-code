const fs = require("fs");
const path = require("path");

if (!process.env.HOME) {
  throw new Error("missing HOME");
}

const homeDir = path.join(process.env.HOME, ".qwen");
const settingsPath = path.join(homeDir, "settings.json");
const credentialsPath = path.join(homeDir, "oauth_creds.json");
const modelName = (process.env.QWEN_MODEL || "").trim();
const authMaterializationKey = (process.env.QWEN_AUTH_MATERIALIZATION_KEY || "").trim();
const placeholderValue = (process.env.QWEN_PLACEHOLDER_VALUE || "").trim();
const baseURLValue = (process.env.QWEN_BASE_URL || "").trim();
const baseURLFile = process.env.QWEN_BASE_URL_FILE || "";
const apiKeyEnvName = (process.env.QWEN_API_KEY_ENV_NAME || "QWEN_PLACEHOLDER_API_KEY").trim();

function readTrimmed(filePath) {
  if (!filePath) {
    return "";
  }
  try {
    return fs.readFileSync(filePath, "utf8").replace(/\r/g, "").trim();
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function requireString(value, field) {
  if (!value) {
    throw new Error(`missing ${field}`);
  }
  return value;
}

function parseURL(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  const hasScheme = trimmed.includes("://");
  return new URL(hasScheme ? trimmed : `https://${trimmed}`);
}

function normalizeOpenAIBaseURL(rawValue) {
  const parsed = parseURL(rawValue);
  if (!parsed) {
    return "";
  }
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (parsed.search || parsed.hash) {
    throw new Error("invalid baseUrl query or fragment");
  }
  if (parsed.username || parsed.password) {
    throw new Error("invalid baseUrl credentials");
  }
  const authority = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  if (!authority) {
    throw new Error("invalid baseUrl host");
  }
  if (!normalizedPath) {
    return `${parsed.protocol}//${authority}`;
  }
  return `${parsed.protocol}//${authority}${normalizedPath}`;
}

function loadBaseURL() {
  if (baseURLValue) {
    return baseURLValue;
  }
  const fileValue = readTrimmed(baseURLFile);
  if (fileValue) {
    return fileValue;
  }
  throw new Error(`missing baseUrl: set QWEN_BASE_URL or mount ${baseURLFile}`);
}

function writeJSONAtomically(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function removeIfExists(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }
}

function buildOpenAICompatibleSettings() {
  if (authMaterializationKey !== "qwen-cli.openai-compatible-api-key") {
    throw new Error(`unsupported Qwen auth materialization key: ${authMaterializationKey}`);
  }

  const modelId = requireString(modelName, "QWEN_MODEL");
  const baseUrl = requireString(normalizeOpenAIBaseURL(loadBaseURL()), "baseUrl");

  return {
    $version: 3,
    env: {
      [requireString(apiKeyEnvName, "QWEN_API_KEY_ENV_NAME")]: requireString(
        placeholderValue,
        "QWEN_PLACEHOLDER_VALUE",
      ),
    },
    modelProviders: {
      openai: [
        {
          id: modelId,
          name: modelId,
          baseUrl,
          envKey: apiKeyEnvName,
        },
      ],
    },
    security: {
      auth: {
        selectedType: "openai",
      },
    },
    model: {
      name: modelId,
    },
  };
}

fs.mkdirSync(homeDir, { recursive: true, mode: 0o700 });
writeJSONAtomically(settingsPath, buildOpenAICompatibleSettings());
removeIfExists(credentialsPath);
