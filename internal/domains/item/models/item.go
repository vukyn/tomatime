package models

import (
	"errors"
	"fmt"
	"time"

	pkgErr "github.com/vukyn/kuery/http/errors"
)

type CreateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (r CreateRequest) Validate() error {
	if r.Name == "" {
		return errors.New("name is required")
	}
	return nil
}

type UpdateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *int32  `json:"status"`
}

func (r UpdateRequest) Validate() error {
	if r.Name != nil && *r.Name == "" {
		return errors.New("name cannot be empty")
	}
	return nil
}

// Paging bounds for ListRequest.
const (
	// DefaultListPageSize is used when the caller does not ask for a page size.
	DefaultListPageSize = 20

	// MaxListPageSize caps how many rows one request may ask for.
	//
	// ⚠️ Without a cap, page_size flows straight into the query's LIMIT, so
	// `GET /api/v1/items?page_size=100000000` asks the database for every row and
	// materialises all of them into a response — an unauthenticated caller
	// choosing how much memory the server allocates. This is the bound on that.
	MaxListPageSize = 100
)

type ListRequest struct {
	Search   string `query:"search"`
	Status   int32  `query:"status"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

// Validate rejects paging parameters that are out of range.
//
// Zero is NOT out of range for either field: QueryParser leaves both at zero when
// the caller omits them, so zero has to keep meaning "unset, use the default" —
// rejecting it would break every request that does not page explicitly.
//
// Returns a pkgErr so an out-of-range page size answers 400 rather than 500.
func (r ListRequest) Validate() error {
	if r.Page < 0 {
		return pkgErr.InvalidRequest("page cannot be negative")
	}
	if r.PageSize < 0 {
		return pkgErr.InvalidRequest("page_size cannot be negative")
	}
	if r.PageSize > MaxListPageSize {
		return pkgErr.InvalidRequest(fmt.Sprintf("page_size cannot exceed %d", MaxListPageSize))
	}
	return nil
}

type ItemResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      int32     `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ListResponse struct {
	Items []ItemResponse `json:"items"`
	Total int64          `json:"total"`
}
