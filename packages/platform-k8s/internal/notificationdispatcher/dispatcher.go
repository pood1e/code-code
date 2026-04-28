package notificationdispatcher

import (
	"context"
	"fmt"
	"time"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"google.golang.org/protobuf/proto"
)

// Run starts the durable notification request consumer.
func (d *Dispatcher) Run(ctx context.Context) error {
	if d == nil {
		return fmt.Errorf("notificationdispatcher: dispatcher is nil")
	}
	nc, js, err := d.connect(ctx)
	if err != nil {
		return err
	}
	defer nc.Close()

	stream, err := js.Stream(ctx, d.config.StreamName)
	if err != nil {
		return fmt.Errorf("notificationdispatcher: get stream: %w", err)
	}
	consumer, err := stream.CreateOrUpdateConsumer(ctx, d.consumerConfig())
	if err != nil {
		return fmt.Errorf("notificationdispatcher: create consumer: %w", err)
	}
	messages, err := consumer.Messages(jetstream.PullMaxMessages(16))
	if err != nil {
		return fmt.Errorf("notificationdispatcher: open consumer messages: %w", err)
	}
	defer messages.Stop()

	for {
		msg, err := messages.Next(jetstream.NextContext(ctx))
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fmt.Errorf("notificationdispatcher: next message: %w", err)
		}
		d.handle(ctx, msg)
	}
}

func (d *Dispatcher) connect(ctx context.Context) (*nats.Conn, jetstream.JetStream, error) {
	nc, err := nats.Connect(d.config.NATSURL, nats.Name(d.config.ClientName))
	if err != nil {
		return nil, nil, fmt.Errorf("notificationdispatcher: connect nats: %w", err)
	}
	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, nil, fmt.Errorf("notificationdispatcher: create jetstream client: %w", err)
	}
	if err := d.ensureStream(ctx, js); err != nil {
		nc.Close()
		return nil, nil, err
	}
	return nc, js, nil
}

func (d *Dispatcher) ensureStream(ctx context.Context, js jetstream.JetStream) error {
	_, err := js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:        d.config.StreamName,
		Description: "Platform notification request stream.",
		Subjects:    []string{d.config.Subject},
		Retention:   jetstream.LimitsPolicy,
		MaxMsgs:     -1,
		MaxBytes:    -1,
		MaxAge:      7 * 24 * time.Hour,
		Storage:     jetstream.FileStorage,
		Replicas:    1,
		Duplicates:  2 * time.Hour,
	})
	if err != nil {
		return fmt.Errorf("notificationdispatcher: ensure stream: %w", err)
	}
	return nil
}

func (d *Dispatcher) consumerConfig() jetstream.ConsumerConfig {
	return jetstream.ConsumerConfig{
		Name:          d.config.ConsumerName,
		Durable:       d.config.ConsumerName,
		FilterSubject: d.config.Subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		DeliverPolicy: jetstream.DeliverAllPolicy,
		AckWait:       d.config.HTTPTimeout + 5*time.Second,
		MaxDeliver:    8,
		MaxAckPending: 32,
	}
}

func (d *Dispatcher) handle(ctx context.Context, msg jetstream.Msg) {
	request := &notificationv1.NotificationRequest{}
	if err := proto.Unmarshal(msg.Data(), request); err != nil {
		_ = msg.TermWithReason("notification request decode failed")
		d.config.Logger.Error("notification request decode failed", "error", err)
		return
	}
	if err := validateRequest(request); err != nil {
		_ = msg.TermWithReason("notification request validation failed")
		d.config.Logger.Error("notification request validation failed", "event_id", request.GetEventId(), "error", err)
		return
	}
	if err := d.deliver(ctx, request); err != nil {
		_ = msg.NakWithDelay(d.config.RetryDelay)
		d.config.Logger.Error("notification delivery failed", "event_id", request.GetEventId(), "error", err)
		return
	}
	if err := msg.DoubleAck(ctx); err != nil {
		d.config.Logger.Error("notification ack failed", "event_id", request.GetEventId(), "error", err)
		return
	}
	d.config.Logger.Info("notification delivered", "event_id", request.GetEventId())
}
