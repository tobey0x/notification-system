package models


type PaginationMeta struct {
	Total        int  `json:"total"`
	Limit        int  `json:"limit"`
	Page         int  `json:"page"`
	TotalPages   int  `json:"total_pages"`
	HasNext      bool `json:"has_next"`
	HasPrevious  bool `json:"has_previous"`
}

type Response struct {
	Success bool            `json:"success"`
	Data    interface{}     `json:"data,omitempty"`
	Error   *string         `json:"error,omitempty"`
	Message string          `json:"message"`
	Meta    *PaginationMeta `json:"meta,omitempty"`
}

func SuccessResponse(message string, data interface{}) Response {
	return Response{
		Success: true,
		Data:    data,
		Error:   nil,
		Message: message,
		Meta:    nil,
	}
}

func SuccessResponseWithMeta(message string, data interface{}, meta *PaginationMeta) Response {
	return Response{
		Success: true,
		Data:    data,
		Error:   nil,
		Message: message,
		Meta:    meta,
	}
}


func ErrorResponse(message string, err error) Response {
	errMsg := err.Error()
	return Response{
		Success: false,
		Data:    nil,
		Error:   &errMsg,
		Message: message,
		Meta:    nil,
	}
}


func ValidationErrorResponse(validationErrors interface{}) Response {
	errMsg := "Validation failed"
	return Response{
		Success: false,
		Data:    validationErrors,
		Error:   &errMsg,
		Message: "Request validation failed",
		Meta:    nil,
	}
}


func CalculatePagination(total, page, limit int) *PaginationMeta {
	totalPages := (total + limit - 1) / limit
	
	return &PaginationMeta{
		Total:       total,
		Limit:       limit,
		Page:        page,
		TotalPages:  totalPages,
		HasNext:     page < totalPages,
		HasPrevious: page > 1,
	}
}