package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/tobey0x/api-gateway/internal/client"
	"github.com/tobey0x/api-gateway/internal/models"
)

type AuthMiddleware struct {
	jwtSecret     string
	accessSecret  string  // User Service access token secret
	userService   *client.UserServiceClient
}

func NewAuthMiddleware(jwtSecret string, accessSecret string, userServiceURL string) *AuthMiddleware {
	return &AuthMiddleware{
		jwtSecret:    jwtSecret,
		accessSecret: accessSecret,
		userService:  client.NewUserServiceClient(userServiceURL),
	}
}

// Claims represents the JWT claims structure from User Service
type Claims struct {
	ID    string `json:"id"`    // User Service uses 'id' instead of 'user_id'
	Email string `json:"email"`
	Role  string `json:"role"`  // User Service uses singular 'role'
	jwt.RegisteredClaims
}

// RequireAuth validates JWT token and adds user context
func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Missing authorization header"))
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Invalid authorization header format"))
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate token using User Service ACCESS_SECRET
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			// Validate signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Use ACCESS_SECRET for User Service tokens
			return []byte(m.accessSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Invalid or expired token"))
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Invalid token claims"))
			c.Abort()
			return
		}

		// Check token expiration
		if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Token has expired"))
			c.Abort()
			return
		}

		// Add user info to context (User Service format)
		c.Set("user_id", claims.ID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		// For compatibility, also set as array
		c.Set("user_roles", []string{claims.Role})

		c.Next()
	}
}

// OptionalAuth extracts user info if token present, but doesn't require it
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(m.accessSecret), nil
		})

		if err == nil {
			if claims, ok := token.Claims.(*Claims); ok && token.Valid {
				c.Set("user_id", claims.ID)
				c.Set("user_email", claims.Email)
				c.Set("user_role", claims.Role)
				c.Set("user_roles", []string{claims.Role})
			}
		}

		c.Next()
	}
}

// RequireAuthWithValidation validates token and fetches user profile from User Service
func (m *AuthMiddleware) RequireAuthWithValidation() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Missing authorization header"))
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple("Invalid authorization header format"))
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token with User Service
		profile, err := m.userService.ValidateToken(c.Request.Context(), tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponseSimple(fmt.Sprintf("Invalid token: %v", err)))
			c.Abort()
			return
		}

		// Add user info to context
		c.Set("user_id", profile.ID)
		c.Set("user_email", profile.Email)
		c.Set("user_role", profile.Role)
		c.Set("user_roles", []string{profile.Role})
		c.Set("user_profile", profile)

		c.Next()
	}
}

// RequireRole checks if user has required role
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roles, exists := c.Get("user_roles")
		if !exists {
			c.JSON(http.StatusForbidden, models.ErrorResponseSimple("Access denied"))
			c.Abort()
			return
		}

		userRoles, ok := roles.([]string)
		if !ok {
			c.JSON(http.StatusForbidden, models.ErrorResponseSimple("Invalid role data"))
			c.Abort()
			return
		}

		// Check if user has required role
		hasRole := false
		for _, r := range userRoles {
			if r == role || r == "admin" { // admin has access to everything
				hasRole = true
				break
			}
		}

		if !hasRole {
			c.JSON(http.StatusForbidden, models.ErrorResponseSimple("Insufficient permissions"))
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetUserID extracts user ID from context
func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}
	id, ok := userID.(string)
	return id, ok
}
