package rbac

import (
	"errors"
	"testing"
)

func TestLeastPrivilege(t *testing.T) {
	deny := map[Role][]Permission{
		Viewer:     {InvoiceCreate, InvoiceIssue, PaymentRecord, ClientWrite, DataExport, SettingsManage, UserManage, APIKeyManage},
		Sales:      {InvoiceIssue, InvoiceApprove, InvoiceVoid, PaymentRecord, CreditNoteCreate, DataExport, DataImport, SettingsManage, UserManage, APIKeyManage, IntegrationManage},
		Accountant: {SettingsManage, UserManage, APIKeyManage, IntegrationManage, DataImport, OwnerTransfer},
		Admin:      {OwnerTransfer},
	}
	for role, ps := range deny {
		for _, p := range ps {
			if Can(role, p) {
				t.Errorf("%s must not have %s", role, p)
			}
		}
	}
	allow := map[Role][]Permission{
		Viewer:     {InvoiceView, ClientView, ReportView},
		Sales:      {InvoiceCreate, QuoteManage, ClientWrite},
		Accountant: {InvoiceIssue, InvoiceApprove, InvoiceVoid, CreditNoteCreate, PaymentRecord, ReportView, DataExport},
		Admin:      {UserManage, SettingsManage, APIKeyManage, DataImport, IntegrationManage},
		Owner:      all,
	}
	for role, ps := range allow {
		for _, p := range ps {
			if !Can(role, p) {
				t.Errorf("%s should have %s", role, p)
			}
		}
	}
}

func TestUnknownRoleAndPermissionDenied(t *testing.T) {
	if Can("intern", InvoiceView) || Can(Owner, "made:up") || Can("", "") {
		t.Fatal("unknown values must be denied")
	}
	if len(Roles()) != 5 {
		t.Fatal("roles")
	}
}

func TestApprovalPolicy(t *testing.T) {
	p := ApprovalPolicy{Thresholds: map[string]int64{"INR": 5000000, "USD": 100000}, SeparateCreator: true}
	cases := []struct {
		cur   string
		total int64
		want  bool
	}{{"INR", 4999999, false}, {"INR", 5000000, true}, {"USD", 100000, true}, {"USD", 1, false}, {"EUR", 1, true}}
	for _, c := range cases {
		if got := p.Required(c.cur, c.total); got != c.want {
			t.Errorf("%s %d: got %v want %v", c.cur, c.total, got, c.want)
		}
	}
	if err := p.CheckApprover(Sales, "u2", "u1"); !errors.Is(err, ErrForbidden) {
		t.Fatal("sales cannot approve")
	}
	if err := p.CheckApprover(Accountant, "u1", "u1"); !errors.Is(err, ErrSelfApproval) {
		t.Fatal("no self approval")
	}
	if err := p.CheckApprover(Accountant, "u2", "u1"); err != nil {
		t.Fatal(err)
	}
	p.SeparateCreator = false
	if err := p.CheckApprover(Owner, "u1", "u1"); err != nil {
		t.Fatal("self approval allowed when the policy permits it")
	}
}
