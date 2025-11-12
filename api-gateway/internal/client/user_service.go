package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// UserServiceClient handles communication with the User Service
type UserServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewUserServiceClient creates a new User Service client
func NewUserServiceClient(baseURL string) *UserServiceClient {
	return &UserServiceClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// UserProfile represents the user profile structure from User Service
type UserProfile struct {
	ID        string                `json:"id"`
	Name      string                `json:"name"`
	Email     string                `json:"email"`
	Role      string                `json:"role"`
	CreatedAt time.Time             `json:"created_at"`
	Preference *NotificationPreference `json:"preference,omitempty"`
	PushTokens []PushToken           `json:"pushTokens,omitempty"`
}

// NotificationPreference represents user notification preferences
type NotificationPreference struct {
	ID           string  `json:"id"`
	UserID       string  `json:"userId"`
	EmailEnabled bool    `json:"email_enabled"`
	PushEnabled  bool    `json:"push_enabled"`
	Language     string  `json:"language"`
	Timezone     *string `json:"timezone"`
}

// PushToken represents a push notification token
type PushToken struct {
	ID         string    `json:"id"`
	UserID     string    `json:"userId"`
	Token      string    `json:"token"`
	Platform   string    `json:"platform"`
	DeviceName *string   `json:"device_name"`
	CreatedAt  time.Time `json:"created_at"`
}

// UserServiceResponse is the standard response from User Service
type UserServiceResponse struct {
	Data    interface{} `json:"data"`
	Message string      `json:"message"`
	Success bool        `json:"success"`
}

// GetUserProfile fetches a user's profile by ID
func (c *UserServiceClient) GetUserProfile(ctx context.Context, userID string, accessToken string) (*UserProfile, error) {
	url := fmt.Sprintf("%s/api/v1/users/profile/%s", c.baseURL, userID)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user service returned status %d: %s", resp.StatusCode, string(body))
	}

	var response UserServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert data to UserProfile
	dataBytes, err := json.Marshal(response.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	var profile UserProfile
	if err := json.Unmarshal(dataBytes, &profile); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user profile: %w", err)
	}

	return &profile, nil
}

// GetUserPreference fetches a user's notification preferences by ID
func (c *UserServiceClient) GetUserPreference(ctx context.Context, userID string, accessToken string) (*NotificationPreference, error) {
	url := fmt.Sprintf("%s/api/v1/users/preference/%s", c.baseURL, userID)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user service returned status %d: %s", resp.StatusCode, string(body))
	}

	var response UserServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	dataBytes, err := json.Marshal(response.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	var preference NotificationPreference
	if err := json.Unmarshal(dataBytes, &preference); err != nil {
		return nil, fmt.Errorf("failed to unmarshal preference: %w", err)
	}

	return &preference, nil
}

// ValidateToken validates a JWT token with the User Service
func (c *UserServiceClient) ValidateToken(ctx context.Context, accessToken string) (*UserProfile, error) {
	// The User Service doesn't have a dedicated validate endpoint,
	// so we use the profile endpoint which requires authentication
	url := fmt.Sprintf("%s/api/v1/users/profile", c.baseURL)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("invalid or expired token")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user service returned status %d: %s", resp.StatusCode, string(body))
	}

	var response UserServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	dataBytes, err := json.Marshal(response.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	var profile UserProfile
	if err := json.Unmarshal(dataBytes, &profile); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user profile: %w", err)
	}

	return &profile, nil
}

// RefreshTokenRequest represents the request body for token refresh
type RefreshTokenRequest struct {
	Token string `json:"token"`
}

// RefreshTokenResponse represents the response from token refresh
type RefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// RefreshToken requests a new access token using a refresh token
func (c *UserServiceClient) RefreshToken(ctx context.Context, refreshToken string) (*RefreshTokenResponse, error) {
	url := fmt.Sprintf("%s/api/v1/auth/refresh", c.baseURL)
	
	reqBody := RefreshTokenRequest{Token: refreshToken}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user service returned status %d: %s", resp.StatusCode, string(body))
	}

	var response UserServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	dataBytes, err := json.Marshal(response.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	var tokenResp RefreshTokenResponse
	if err := json.Unmarshal(dataBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token response: %w", err)
	}

	return &tokenResp, nil
}

// HealthCheck checks if the User Service is healthy
func (c *UserServiceClient) HealthCheck(ctx context.Context) error {
	url := fmt.Sprintf("%s/api/v1/health", c.baseURL)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("user service returned status %d", resp.StatusCode)
	}

	return nil
}
