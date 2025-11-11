package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tobey0x/api-gateway/internal/cache"
	"github.com/tobey0x/api-gateway/internal/models"
)

type RateLimiter struct {
	redis        *cache.RedisClient
	maxRequests  int64
	windowPeriod time.Duration
}

func NewRateLimiter(redis *cache.RedisClient, maxRequests int64, windowPeriod time.Duration) *RateLimiter {
	return &RateLimiter{
		redis:        redis,
		maxRequests:  maxRequests,
		windowPeriod: windowPeriod,
	}
}

// RateLimit middleware enforces rate limiting per user or IP
func (rl *RateLimiter) RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Try to get user ID from context (if authenticated)
		identifier, exists := c.Get("user_id")
		if !exists || identifier == "" {
			// Fallback to IP address for unauthenticated requests
			identifier = c.ClientIP()
		}

		key := fmt.Sprintf("%v", identifier)

		// Increment request count
		count, err := rl.redis.IncrementRateLimit(c.Request.Context(), key, rl.windowPeriod)
		if err != nil {
			// Log error but don't block request on rate limit failure
			c.Next()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", rl.maxRequests))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", max(0, rl.maxRequests-count)))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(rl.windowPeriod).Unix()))

		// Check if rate limit exceeded
		if count > rl.maxRequests {
			c.Header("Retry-After", fmt.Sprintf("%d", int(rl.windowPeriod.Seconds())))
			c.JSON(http.StatusTooManyRequests, models.ErrorResponseSimple("Rate limit exceeded. Please try again later."))
			c.Abort()
			return
		}

		c.Next()
	}
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
