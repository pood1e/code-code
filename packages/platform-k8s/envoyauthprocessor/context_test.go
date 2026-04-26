package envoyauthprocessor

import (
	"context"
	"testing"
	"time"

	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func TestContextCacheStoresMiss(t *testing.T) {
	cache := newContextCache(DefaultCacheTTL)

	cache.set("10.1.2.3", nil)
	context, ok := cache.get("10.1.2.3")

	if !ok {
		t.Fatal("cache miss was not stored")
	}
	if context != nil {
		t.Fatalf("context = %#v, want nil", context)
	}
}

func TestResolveAuthContextTimeoutContinuesWithoutAuth(t *testing.T) {
	server, err := NewServer(Options{
		Reader:        blockingReader{},
		LookupTimeout: time.Nanosecond,
	})
	if err != nil {
		t.Fatalf("NewServer: %v", err)
	}

	auth, err := server.resolveAuthContextForRequest(context.Background(), sourceIPRequest("10.1.2.3"), emptyRequestHeaders())

	if err != nil {
		t.Fatalf("resolveAuthContextForRequest: %v", err)
	}
	if auth != nil {
		t.Fatalf("auth = %#v, want nil", auth)
	}
}

type blockingReader struct{}

func (blockingReader) Get(ctx context.Context, _ types.NamespacedName, _ ctrlclient.Object, _ ...ctrlclient.GetOption) error {
	<-ctx.Done()
	return ctx.Err()
}

func (blockingReader) List(ctx context.Context, _ ctrlclient.ObjectList, _ ...ctrlclient.ListOption) error {
	<-ctx.Done()
	return ctx.Err()
}

func sourceIPRequest(ip string) *extprocv3.ProcessingRequest {
	return &extprocv3.ProcessingRequest{
		Attributes: map[string]*structpb.Struct{
			"source.address": {
				Fields: map[string]*structpb.Value{
					"address": structpb.NewStringValue(ip + ":12345"),
				},
			},
		},
	}
}
