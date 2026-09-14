package usecase

import (
	"context"
	"net/http"
	"testing"

	"github.com/vukyn/tomatime/internal/domains/item/entity"
	"github.com/vukyn/tomatime/internal/domains/item/models"

	pkgErr "github.com/vukyn/kuery/http/errors"
)

// countingRepository records whether it was reached. The whole point of the
// usecase-level check is that an out-of-range request never becomes a query, so
// "the repository was not called" is the assertion — a test that only checked the
// returned error would pass even if the request had already hit the database.
type countingRepository struct {
	listCalls int
	items     []entity.Item
	total     int64
}

func (r *countingRepository) Create(ctx context.Context, req entity.CreateRequest) (string, error) {
	return "", nil
}
func (r *countingRepository) GetByID(ctx context.Context, id string) (entity.Item, error) {
	return entity.Item{}, nil
}
func (r *countingRepository) List(ctx context.Context, req models.ListRequest) ([]entity.Item, int64, error) {
	r.listCalls++
	return r.items, r.total, nil
}
func (r *countingRepository) Update(ctx context.Context, req entity.UpdateRequest) error { return nil }
func (r *countingRepository) Delete(ctx context.Context, id string) error                { return nil }

// TestListRejectsAnOversizedPageSizeBeforeQuerying pins that ListRequest.Validate is
// actually WIRED IN, alongside the Create/Update checks that were already there.
//
// The repository clamps too, as defence in depth — which is exactly why this test
// is needed: with the clamp in place, deleting the usecase check produces the right
// number of rows and no error, so nothing but a "did the query run" assertion can
// see the difference.
func TestListRejectsAnOversizedPageSizeBeforeQuerying(t *testing.T) {
	repository := &countingRepository{}
	itemUsecase := NewUsecase(repository)

	_, err := itemUsecase.List(context.Background(), models.ListRequest{
		PageSize: 100000000,
	})
	if err == nil {
		t.Fatal("List accepted page_size=100000000")
	}
	if repository.listCalls != 0 {
		t.Fatalf("the repository was queried %d time(s) for an invalid request — the validation is not wired into the usecase", repository.listCalls)
	}

	statusErr, ok := err.(pkgErr.Error)
	if !ok {
		t.Fatalf("List returned %T, which pkgHttp.Err maps to a 500 — an out-of-range page size must answer 400", err)
	}
	if statusErr.Status() != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", statusErr.Status(), http.StatusBadRequest)
	}
}

// TestListPassesAValidRequestThrough is the control: the validation must not reject
// ordinary requests, including the unset-paging case every client sends.
func TestListPassesAValidRequestThrough(t *testing.T) {
	for _, request := range []models.ListRequest{
		{},
		{Page: 1, PageSize: models.DefaultListPageSize},
		{Page: 2, PageSize: models.MaxListPageSize},
		{Search: "focus", Status: 1},
	} {
		repository := &countingRepository{
			items: []entity.Item{{ID: "01", Name: "an item"}},
			total: 1,
		}
		response, err := NewUsecase(repository).List(context.Background(), request)
		if err != nil {
			t.Fatalf("List(%+v) = %v, want nil", request, err)
		}
		if repository.listCalls != 1 {
			t.Fatalf("List(%+v) queried the repository %d time(s), want 1", request, repository.listCalls)
		}
		if len(response.Items) != 1 || response.Total != 1 {
			t.Fatalf("List(%+v) returned %d items / total %d, want 1 / 1", request, len(response.Items), response.Total)
		}
	}
}
