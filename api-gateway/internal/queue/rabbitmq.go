package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)


type RabbitMQClient struct {
	conn		*amqp.Connection
	channel		*amqp.Channel
	exchange	string
	emailQueue	string
	pushQueue	string
	failedQueue	string
}


func NewRabbitMQClient(url, exchange, emailQueue, pushQueue, failedQueue string) (*RabbitMQClient, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}


	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}


	client := &RabbitMQClient{
		conn:	conn,
		channel: channel,
		exchange: exchange,
		emailQueue: emailQueue,
		pushQueue: pushQueue,
		failedQueue: failedQueue,
	}


	if err := client.setup(); err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to setup queues: %w", err)
	}

	log.Println("✓ RabbitMQ client connected successfully")
	return client, nil
}


func (c *RabbitMQClient) setup() error {
	err := c.channel.ExchangeDeclare(
		c.exchange,
		"direct",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}


	queues := []struct {
		name		string
		routingKey	string
	}{
		{c.emailQueue, "email"},
		{c.pushQueue, "push"},
		{c.failedQueue, "failed"},
	}


	for _, q := range queues {
		// QueueDeclare is idempotent - creates queue if it doesn't exist,
		// or returns existing queue if it does (with matching parameters)
		_, err := c.channel.QueueDeclare(
			q.name,
			true,  // durable
			false, // delete when unused
			false, // exclusive
			false, // no-wait
			nil,   // arguments (accept existing configuration)
		)
		if err != nil {
			return fmt.Errorf("failed to declare queue %s: %w", q.name, err)
		}

		// Bind queue to exchange (skip for DLQ)
		if q.name != c.failedQueue {
			err = c.channel.QueueBind(
				q.name,
				q.routingKey,
				c.exchange,
				false,
				nil,
			)
			if err != nil {
				return fmt.Errorf("failed to bind queue %s: %w", q.name, err)
			}
		}
	}

	return nil
}



func (c *RabbitMQClient) Publish(ctx context.Context, routingKey string, message interface{}) error {
	// Wrap message in Celery task format for email service
	celeryTask := map[string]interface{}{
		"task": "send_email_task",
		"id": fmt.Sprintf("%d", time.Now().UnixNano()),
		"args": []interface{}{message},
		"kwargs": map[string]interface{}{},
		"retries": 0,
		"eta": nil,
	}

	body, err := json.Marshal(celeryTask)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}


	err = c.channel.PublishWithContext(
		ctx,
		c.exchange,
		routingKey,
		false,
		false, amqp.Publishing{
			ContentType: "application/json",
			ContentEncoding: "utf-8",
			Body: body,
			DeliveryMode: amqp.Persistent,
			Timestamp: time.Now(),
			Headers: amqp.Table{
				"lang": "go",
				"task": "send_email_task",
				"id": fmt.Sprintf("%d", time.Now().UnixNano()),
			},
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	log.Printf("✓ Published message to queue with routing key: %s", routingKey)
	return nil
}



func (c *RabbitMQClient) HealthCheck() error {
	if c.conn == nil || c.conn.IsClosed() {
		return fmt.Errorf("connection is closed")
	}
	if c.channel == nil {
		return fmt.Errorf("channel is nil")
	}
	return nil
}


func (c *RabbitMQClient) Close() error {
	if c.channel != nil {
		if err := c.channel.Close(); err != nil {
			log.Printf("Error closing channel: %v", err)
		}
	}
	if c.conn != nil {
		if err := c.conn.Close(); err != nil {
			log.Printf("Error cloosing connection: %v", err)
		}
	}
	log.Printf("✓ RabbitMQ client closed")
	return  nil
}