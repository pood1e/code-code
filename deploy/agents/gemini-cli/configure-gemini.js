const fs = require("fs");
const path = require("path");

const SELECTED_AUTH_TYPE = "oauth-personal";
const PLACEHOLDER_VALUE = "PLACEHOLDER";
const PLACEHOLDER_TOKEN_TYPE = "Bearer";
const PLACEHOLDER_EXPIRY_DATE = 4102444800000;

if (!process.env.HOME) {
  throw new Error("missing HOME");
}

const homeDir = path.join(process.env.HOME, ".gemini");
const settingsPath = path.join(homeDir, "settings.json");
const credentialsPath = path.join(homeDir, "oauth_creds.json");

function writeJSONAtomically(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

const settings = {
  security: {
    auth: {
      selectedType: SELECTED_AUTH_TYPE,
    },
  },
  privacy: {
    usageStatisticsEnabled: false,
  },
};

const credentials = {
  access_token: PLACEHOLDER_VALUE,
  refresh_token: PLACEHOLDER_VALUE,
  token_type: PLACEHOLDER_TOKEN_TYPE,
  expiry_date: PLACEHOLDER_EXPIRY_DATE,
};

fs.mkdirSync(homeDir, { recursive: true, mode: 0o700 });
writeJSONAtomically(settingsPath, settings);
writeJSONAtomically(credentialsPath, credentials);
