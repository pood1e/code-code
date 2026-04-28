package agentprofiles

import (
	"context"
	"testing"

	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
)

func TestServiceListReturnsStoredProfiles(t *testing.T) {
	t.Parallel()

	store := newMemoryProfileStore()
	store.put(&agentprofilev1.AgentProfile{ProfileId: "z-profile", Name: "Z Profile"})
	store.put(&agentprofilev1.AgentProfile{ProfileId: "a-profile", Name: "A Profile"})

	service, err := NewService(Config{
		Store:              store,
		ProviderReferences: allowingProviderReferences{},
		ResourceReferences: allowingResourceReferences{},
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got, want := len(items), 2; got != want {
		t.Fatalf("len(items) = %d, want %d", got, want)
	}
	if got, want := items[0].GetProfileId(), "a-profile"; got != want {
		t.Fatalf("profile_id = %q, want %q", got, want)
	}
}

func TestServiceDetachMCPUpdatesStoredProfiles(t *testing.T) {
	t.Parallel()

	store := newMemoryProfileStore()
	store.put(&agentprofilev1.AgentProfile{
		ProfileId: "profile-1",
		Name:      "Profile 1",
		McpIds:    []string{"filesystem", "memory"},
	})

	service, err := NewService(Config{
		Store:              store,
		ProviderReferences: allowingProviderReferences{},
		ResourceReferences: allowingResourceReferences{},
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	if err := service.DetachMCP(context.Background(), "filesystem"); err != nil {
		t.Fatalf("DetachMCP() error = %v", err)
	}
	state, err := store.Get(context.Background(), "profile-1")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got, want := state.Profile.GetMcpIds(), []string{"memory"}; len(got) != len(want) || got[0] != want[0] {
		t.Fatalf("mcp_ids = %#v, want %#v", got, want)
	}
	if got, want := state.Generation, int64(2); got != want {
		t.Fatalf("generation = %d, want %d", got, want)
	}
}
