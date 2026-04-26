package envoyauthprocessor

import (
	"context"
	"errors"
	"fmt"
	"io"

	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
)

// Process handles Envoy request-header processing streams.
func (server *Server) Process(stream extprocv3.ExternalProcessor_ProcessServer) error {
	state := &streamState{}
	defer state.release()
	for {
		req, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		resp, err := server.processRequest(stream, req, state)
		if err != nil {
			return err
		}
		if err := stream.Send(resp); err != nil {
			return err
		}
	}
}

type streamState struct {
	auth        *authContext
	authority   string
	releaseLock func()
}

func (state *streamState) bindAuth(auth *authContext, authority string) {
	if state == nil {
		return
	}
	state.release()
	state.auth = auth
	state.authority = authority
	if auth == nil || auth.Adapter == nil || !auth.Adapter.SerializesCookie() {
		return
	}
	auth.serialMu.Lock()
	state.releaseLock = auth.serialMu.Unlock
}

func (state *streamState) release() {
	if state == nil || state.releaseLock == nil {
		return
	}
	state.releaseLock()
	state.releaseLock = nil
}

func (server *Server) processRequest(
	stream extprocv3.ExternalProcessor_ProcessServer,
	req *extprocv3.ProcessingRequest,
	state *streamState,
) (*extprocv3.ProcessingResponse, error) {
	requestHeaders := req.GetRequestHeaders()
	if requestHeaders != nil {
		return server.processRequestHeaders(stream, req, requestHeaders, state)
	}
	responseHeaders := req.GetResponseHeaders()
	if responseHeaders != nil {
		return server.processResponseHeaders(responseHeaders, state), nil
	}
	if req.GetRequestBody() != nil {
		return requestBodyResponse(), nil
	}
	if req.GetResponseBody() != nil {
		return responseBodyResponse(), nil
	}
	return requestHeadersResponse(nil), nil
}

func (server *Server) processRequestHeaders(
	stream extprocv3.ExternalProcessor_ProcessServer,
	req *extprocv3.ProcessingRequest,
	requestHeaders *extprocv3.HttpHeaders,
	state *streamState,
) (*extprocv3.ProcessingResponse, error) {
	headerMap := requestHeaders.GetHeaders()
	if headerMap == nil {
		return requestHeadersResponse(buildHeaderMutation(emptyRequestHeaders(), nil)), nil
	}
	headers := newRequestHeaders(headerMap.GetHeaders())
	auth, err := server.resolveAuthContextForRequest(stream.Context(), req, headers)
	if err != nil {
		return nil, fmt.Errorf("resolve auth context: %w", err)
	}
	state.bindAuth(auth, headers.authority())
	return requestHeadersResponse(buildHeaderMutation(headers, auth)), nil
}

func (server *Server) resolveAuthContextForRequest(
	ctx context.Context,
	req *extprocv3.ProcessingRequest,
	headers requestHeaders,
) (*authContext, error) {
	lookupCtx, cancel := context.WithTimeout(ctx, server.lookupTimeout)
	defer cancel()
	auth, err := server.resolveAuthContext(lookupCtx, req, headers)
	if err == nil {
		return auth, nil
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		server.logger.Warn("auth context lookup timed out", "error", err)
		return nil, nil
	}
	return nil, err
}

func (server *Server) processResponseHeaders(
	responseHeaders *extprocv3.HttpHeaders,
	state *streamState,
) *extprocv3.ProcessingResponse {
	if state == nil || state.auth == nil || state.auth.Adapter == nil {
		return responseHeadersResponse()
	}
	headerMap := responseHeaders.GetHeaders()
	if headerMap == nil {
		state.release()
		return responseHeadersResponse()
	}
	headers := newRequestHeaders(headerMap.GetHeaders())
	if server.metrics != nil {
		server.metrics.recordResponse(headers, state.auth, state.authority)
	}
	mutation, changed := state.auth.Adapter.ResponseMutation(state.auth, headers)
	if changed {
		server.cache.set(state.auth.cacheKey(), state.auth)
		state.release()
		return responseHeadersResponse(mutation)
	}
	state.release()
	return responseHeadersResponse()
}

func emptyRequestHeaders() requestHeaders {
	return requestHeaders{values: map[string][]string{}}
}

func requestHeadersResponse(mutation *extprocv3.HeaderMutation) *extprocv3.ProcessingResponse {
	if mutation == nil {
		mutation = &extprocv3.HeaderMutation{
			RemoveHeaders: append([]string(nil), internalHeaders...),
		}
	}
	return &extprocv3.ProcessingResponse{
		Response: &extprocv3.ProcessingResponse_RequestHeaders{
			RequestHeaders: &extprocv3.HeadersResponse{
				Response: &extprocv3.CommonResponse{
					Status:         extprocv3.CommonResponse_CONTINUE,
					HeaderMutation: mutation,
				},
			},
		},
	}
}

func responseHeadersResponse(mutations ...*extprocv3.HeaderMutation) *extprocv3.ProcessingResponse {
	var mutation *extprocv3.HeaderMutation
	if len(mutations) > 0 {
		mutation = mutations[0]
	}
	return &extprocv3.ProcessingResponse{
		Response: &extprocv3.ProcessingResponse_ResponseHeaders{
			ResponseHeaders: &extprocv3.HeadersResponse{
				Response: &extprocv3.CommonResponse{
					Status:         extprocv3.CommonResponse_CONTINUE,
					HeaderMutation: mutation,
				},
			},
		},
	}
}

func requestBodyResponse() *extprocv3.ProcessingResponse {
	return &extprocv3.ProcessingResponse{
		Response: &extprocv3.ProcessingResponse_RequestBody{
			RequestBody: &extprocv3.BodyResponse{
				Response: &extprocv3.CommonResponse{
					Status: extprocv3.CommonResponse_CONTINUE,
				},
			},
		},
	}
}

func responseBodyResponse() *extprocv3.ProcessingResponse {
	return &extprocv3.ProcessingResponse{
		Response: &extprocv3.ProcessingResponse_ResponseBody{
			ResponseBody: &extprocv3.BodyResponse{
				Response: &extprocv3.CommonResponse{
					Status: extprocv3.CommonResponse_CONTINUE,
				},
			},
		},
	}
}
