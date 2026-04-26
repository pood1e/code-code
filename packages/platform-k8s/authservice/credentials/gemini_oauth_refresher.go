package credentials

import "time"

const (
	geminiTokenURL     = "https://oauth2.googleapis.com/token"
	geminiClientID     = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com"
	geminiClientSecret = "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"
	geminiRefreshLead  = 5 * time.Minute
)

type GeminiOAuthRefresherConfig = GoogleOAuthRefresherConfig

type GeminiOAuthRefresher struct {
	*GoogleOAuthRefresher
}

func init() {
	registerOAuthTokenRefresherFactory("gemini-cli", func() OAuthTokenRefresher {
		return NewGeminiOAuthRefresher(GeminiOAuthRefresherConfig{})
	})
}

func NewGeminiOAuthRefresher(config GeminiOAuthRefresherConfig) *GeminiOAuthRefresher {
	refresher, err := NewGoogleOAuthRefresher(GoogleOAuthRefresherConfig{
		CliID:        "gemini-cli",
		TokenURL:     valueOrDefault(config.TokenURL, geminiTokenURL),
		ClientID:     valueOrDefault(config.ClientID, geminiClientID),
		ClientSecret: valueOrDefault(config.ClientSecret, geminiClientSecret),
		RefreshLead:  durationOrDefault(config.RefreshLead, geminiRefreshLead),
		NonRetryableMarkers: []string{
			"invalid_grant",
			"invalid_client",
			"unauthorized_client",
		},
	})
	if err != nil {
		panic(err)
	}
	return &GeminiOAuthRefresher{GoogleOAuthRefresher: refresher}
}
