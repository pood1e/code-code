package resourceowner

import (
	"context"
	"fmt"
	"strings"

	"code-code.internal/platform-k8s/internal/resourceops"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

// Repository wraps typed Kubernetes resource persistence for one namespaced owner.
type Repository[T ctrlclient.Object, L ctrlclient.ObjectList] struct {
	client    ctrlclient.Client
	reader    ctrlclient.Reader
	namespace string
	newObject func() T
	newList   func() L
}

func NewRepository[T ctrlclient.Object, L ctrlclient.ObjectList](
	client ctrlclient.Client,
	reader ctrlclient.Reader,
	namespace string,
	newObject func() T,
	newList func() L,
) (*Repository[T, L], error) {
	switch {
	case client == nil:
		return nil, fmt.Errorf("platformk8s/resourceowner: client is nil")
	case reader == nil:
		return nil, fmt.Errorf("platformk8s/resourceowner: reader is nil")
	case strings.TrimSpace(namespace) == "":
		return nil, fmt.Errorf("platformk8s/resourceowner: namespace is empty")
	case newObject == nil:
		return nil, fmt.Errorf("platformk8s/resourceowner: object factory is nil")
	case newList == nil:
		return nil, fmt.Errorf("platformk8s/resourceowner: list factory is nil")
	}
	return &Repository[T, L]{
		client:    client,
		reader:    reader,
		namespace: strings.TrimSpace(namespace),
		newObject: newObject,
		newList:   newList,
	}, nil
}

func (r *Repository[T, L]) Namespace() string {
	if r == nil {
		return ""
	}
	return r.namespace
}

func (r *Repository[T, L]) Get(ctx context.Context, name string) (T, error) {
	var zero T
	if r == nil {
		return zero, fmt.Errorf("platformk8s/resourceowner: repository is nil")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return zero, fmt.Errorf("platformk8s/resourceowner: resource name is empty")
	}
	resource := r.newObject()
	if err := r.reader.Get(ctx, types.NamespacedName{Namespace: r.namespace, Name: name}, resource); err != nil {
		return zero, err
	}
	return resource, nil
}

func (r *Repository[T, L]) List(ctx context.Context, opts ...ctrlclient.ListOption) (L, error) {
	var zero L
	if r == nil {
		return zero, fmt.Errorf("platformk8s/resourceowner: repository is nil")
	}
	list := r.newList()
	options := append([]ctrlclient.ListOption{ctrlclient.InNamespace(r.namespace)}, opts...)
	if err := r.reader.List(ctx, list, options...); err != nil {
		return zero, err
	}
	return list, nil
}

func (r *Repository[T, L]) Create(ctx context.Context, resource T) error {
	if r == nil {
		return fmt.Errorf("platformk8s/resourceowner: repository is nil")
	}
	return resourceops.CreateResource(ctx, r.client, resource, r.namespace, resource.GetName())
}

func (r *Repository[T, L]) Update(ctx context.Context, name string, mutate func(T) error) error {
	if r == nil {
		return fmt.Errorf("platformk8s/resourceowner: repository is nil")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("platformk8s/resourceowner: resource name is empty")
	}
	return resourceops.UpdateResource(
		ctx,
		r.client,
		types.NamespacedName{Namespace: r.namespace, Name: name},
		mutate,
		r.newObject,
	)
}

func (r *Repository[T, L]) Delete(ctx context.Context, name string) error {
	if r == nil {
		return fmt.Errorf("platformk8s/resourceowner: repository is nil")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("platformk8s/resourceowner: resource name is empty")
	}
	return resourceops.DeleteResource(ctx, r.client, r.newObject(), r.namespace, name)
}
