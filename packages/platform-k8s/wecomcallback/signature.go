package wecomcallback

import "net/http"

type callbackSignature struct {
	signature string
	timestamp string
	nonce     string
}

func signatureFromRequest(r *http.Request) callbackSignature {
	query := r.URL.Query()
	return callbackSignature{
		signature: query.Get("msg_signature"),
		timestamp: query.Get("timestamp"),
		nonce:     query.Get("nonce"),
	}
}

func (p callbackSignature) verifyURL(crypto *Crypto, echo string) (string, error) {
	return crypto.VerifyURL(p.signature, p.timestamp, p.nonce, echo)
}

func (p callbackSignature) decryptMessage(crypto *Crypto, encrypted string) (string, string, error) {
	return crypto.DecryptMessage(p.signature, p.timestamp, p.nonce, encrypted)
}
