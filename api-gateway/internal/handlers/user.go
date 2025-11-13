package handlers

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userServiceURL string
	httpClient     *http.Client
}

func NewUserHandler(userServiceURL string) *UserHandler {
	return &UserHandler{
		userServiceURL: userServiceURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ProxyToUserService forwards requests to the User Service
func (h *UserHandler) ProxyToUserService(c *gin.Context) {
	// Build the target URL
	// Remove /api/v1 prefix if it exists in the path
	path := c.Request.URL.Path
	query := c.Request.URL.RawQuery
	
	targetURL := h.userServiceURL + path
	if query != "" {
		targetURL += "?" + query
	}

	// Read the request body
	var bodyBytes []byte
	if c.Request.Body != nil {
		bodyBytes, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	// Create the proxy request
	proxyReq, err := http.NewRequestWithContext(
		c.Request.Context(),
		c.Request.Method,
		targetURL,
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create proxy request",
			"error":   err.Error(),
		})
		return
	}

	// Copy headers from original request
	for key, values := range c.Request.Header {
		// Skip hop-by-hop headers
		if strings.ToLower(key) == "connection" ||
			strings.ToLower(key) == "keep-alive" ||
			strings.ToLower(key) == "proxy-authenticate" ||
			strings.ToLower(key) == "proxy-authorization" ||
			strings.ToLower(key) == "te" ||
			strings.ToLower(key) == "trailers" ||
			strings.ToLower(key) == "transfer-encoding" ||
			strings.ToLower(key) == "upgrade" {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// Set X-Forwarded headers
	proxyReq.Header.Set("X-Forwarded-For", c.ClientIP())
	proxyReq.Header.Set("X-Forwarded-Proto", c.Request.Proto)
	proxyReq.Header.Set("X-Forwarded-Host", c.Request.Host)

	// Make the request
	resp, err := h.httpClient.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Failed to reach user service",
			"error":   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// Copy response status and body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to read user service response",
			"error":   err.Error(),
		})
		return
	}

	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
}
