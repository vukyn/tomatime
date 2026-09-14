package repository

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/vukyn/tomatime/internal/domains/item/entity"
	"github.com/vukyn/tomatime/internal/domains/item/models"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/sqlitedialect"
	"github.com/uptrace/bun/driver/sqliteshim"
)

// newTestRepository builds a repository over a REAL SQLite database rather than a
// fake. The behaviour under test is the LIMIT the repository puts on the query, so
// a fake repository would be testing the fake.
//
// In-memory and named per test, with cache=shared so bun's pooled connections all
// see the same database. MaxOpenConns is pinned to 1 because an in-memory SQLite
// disappears when its last connection closes.
func newTestRepository(t *testing.T) (IRepository, context.Context) {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	sqldb, err := sql.Open(sqliteshim.ShimName, dsn)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqldb.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqldb.Close() })

	db := bun.NewDB(sqldb, sqlitedialect.New())
	ctx := context.Background()
	if _, err := db.NewCreateTable().Model((*entity.Item)(nil)).Exec(ctx); err != nil {
		t.Fatalf("create items table: %v", err)
	}

	return NewRepository(db), ctx
}

func seedItems(t *testing.T, repository IRepository, ctx context.Context, count int) {
	t.Helper()
	for index := range count {
		if _, err := repository.Create(ctx, entity.CreateRequest{
			Name:   fmt.Sprintf("item-%03d", index),
			Status: 1,
		}); err != nil {
			t.Fatalf("seed item %d: %v", index, err)
		}
	}
}

// TestListClampsAnOversizedPageSize is the defence-in-depth half of the page-size
// cap. The usecase rejects an oversized page_size before it gets here, so reaching
// this code means something called the repository directly — and the repository is
// the layer that owns the LIMIT.
//
// Seeded with MORE rows than the cap: with a cap that does not work, the query
// returns all of them, so the row count is what distinguishes a working clamp from
// a decorative one.
func TestListClampsAnOversizedPageSize(t *testing.T) {
	repository, ctx := newTestRepository(t)
	seedItems(t, repository, ctx, models.MaxListPageSize+25)

	items, total, err := repository.List(ctx, models.ListRequest{
		Page:     1,
		PageSize: 100000000, // the value from the report
	})
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	if len(items) > models.MaxListPageSize {
		t.Fatalf("List returned %d rows for page_size=100000000, want at most %d — the LIMIT is unbounded, so the caller is choosing how much the server allocates", len(items), models.MaxListPageSize)
	}
	if len(items) != models.MaxListPageSize {
		t.Fatalf("List returned %d rows, want exactly the cap (%d) — there are %d rows available, so a smaller answer means the clamp is wrong rather than merely safe", len(items), models.MaxListPageSize, models.MaxListPageSize+25)
	}
	// total is the unpaged count and must NOT be clamped — the client needs it to
	// render paging.
	if total != int64(models.MaxListPageSize+25) {
		t.Errorf("total = %d, want %d — the clamp must bound the page, not the reported count", total, models.MaxListPageSize+25)
	}
}

// TestListAppliesTheDefaultPageSize pins the low side of the clamp, which existed
// before this change and must keep working.
func TestListAppliesTheDefaultPageSize(t *testing.T) {
	repository, ctx := newTestRepository(t)
	seedItems(t, repository, ctx, models.DefaultListPageSize+10)

	for _, pageSize := range []int{0, -5} {
		items, _, err := repository.List(ctx, models.ListRequest{PageSize: pageSize})
		if err != nil {
			t.Fatalf("List(page_size=%d): %v", pageSize, err)
		}
		if len(items) != models.DefaultListPageSize {
			t.Errorf("List(page_size=%d) returned %d rows, want the default %d", pageSize, len(items), models.DefaultListPageSize)
		}
	}
}

// TestListHonoursAPageSizeWithinTheCap proves the clamp does not flatten every
// request to the cap — a repository that always returned MaxListPageSize rows
// would pass the clamp test above while breaking ordinary paging.
func TestListHonoursAPageSizeWithinTheCap(t *testing.T) {
	repository, ctx := newTestRepository(t)
	seedItems(t, repository, ctx, 40)

	items, total, err := repository.List(ctx, models.ListRequest{Page: 1, PageSize: 7})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 7 {
		t.Fatalf("List(page_size=7) returned %d rows, want 7", len(items))
	}
	if total != 40 {
		t.Errorf("total = %d, want 40", total)
	}

	// And paging still advances.
	second, _, err := repository.List(ctx, models.ListRequest{Page: 2, PageSize: 7})
	if err != nil {
		t.Fatalf("List page 2: %v", err)
	}
	if len(second) != 7 {
		t.Fatalf("page 2 returned %d rows, want 7", len(second))
	}
	if items[0].ID == second[0].ID {
		t.Error("page 2 returned the same first row as page 1 — the offset is not being applied")
	}
}
