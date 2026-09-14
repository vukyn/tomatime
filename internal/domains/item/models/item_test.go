package models

import (
	"net/http"
	"testing"

	pkgErr "github.com/vukyn/kuery/http/errors"
)

// TestListRequestValidate pins the upper bound on page_size.
//
// Without it, page_size flowed straight into the query's LIMIT, so
// `GET /api/v1/items?page_size=100000000` was an unauthenticated caller choosing
// how many rows the server reads and how much memory it allocates for them.
func TestListRequestValidate(t *testing.T) {
	cases := []struct {
		name    string
		request ListRequest
		wantErr bool
	}{
		// Zero must stay VALID: QueryParser leaves both fields at zero when the
		// caller omits them, so rejecting zero would break every request that does
		// not page explicitly.
		{"unset page and page size", ListRequest{}, false},
		{"page size at the default", ListRequest{PageSize: DefaultListPageSize}, false},
		{"page size exactly at the cap", ListRequest{PageSize: MaxListPageSize}, false},
		{"page size one over the cap", ListRequest{PageSize: MaxListPageSize + 1}, true},
		{"the reported attack value", ListRequest{PageSize: 100000000}, true},
		{"negative page size", ListRequest{PageSize: -1}, true},
		{"negative page", ListRequest{Page: -1}, true},
		{"a sane explicit page", ListRequest{Page: 3, PageSize: 50}, false},
		// Search and Status are unconstrained here on purpose: neither reaches a
		// LIMIT, and both are already parameterised in the repository query.
		{"search and status do not affect validity", ListRequest{Search: "x", Status: 2, PageSize: 10}, false},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			err := testCase.request.Validate()
			if testCase.wantErr && err == nil {
				t.Fatalf("Validate() = nil, want an error for %+v", testCase.request)
			}
			if !testCase.wantErr && err != nil {
				t.Fatalf("Validate() = %v, want nil for %+v", err, testCase.request)
			}
		})
	}
}

// TestListRequestValidateAnswers400 asserts the STATUS the rejection carries, not
// just that it rejects. An oversized page_size is a bad request, and a plain
// errors.New would be funnelled to a 500 by pkgHttp.Err — telling the caller the
// server broke when in fact their input was refused.
func TestListRequestValidateAnswers400(t *testing.T) {
	err := ListRequest{PageSize: MaxListPageSize + 1}.Validate()
	if err == nil {
		t.Fatal("Validate() = nil for an oversized page size")
	}

	statusErr, ok := err.(pkgErr.Error)
	if !ok {
		t.Fatalf("Validate() returned %T, which pkgHttp.Err maps to a 500 — an out-of-range page size must answer 400", err)
	}
	if statusErr.Status() != http.StatusBadRequest {
		t.Fatalf("Validate() status = %d, want %d", statusErr.Status(), http.StatusBadRequest)
	}
	if statusErr.Error() == "" {
		t.Error("the rejection carries no message, so the caller is told nothing")
	}
}

// TestMaxListPageSizeIsABound guards the constants themselves. A cap below the
// default would make every unpaged request invalid; a cap raised to something
// enormous would technically satisfy the tests above while restoring the finding.
func TestMaxListPageSizeIsABound(t *testing.T) {
	if MaxListPageSize < DefaultListPageSize {
		t.Fatalf("MaxListPageSize (%d) is below DefaultListPageSize (%d) — the repository default would exceed its own cap", MaxListPageSize, DefaultListPageSize)
	}
	if MaxListPageSize > 1000 {
		t.Fatalf("MaxListPageSize = %d — that is large enough to be no bound at all, which is the finding this cap exists for", MaxListPageSize)
	}
}
