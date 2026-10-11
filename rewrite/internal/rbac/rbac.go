// Package rbac defines roles, permissions and approval rules. Roles are
// least-privilege: each gets only what the job needs, and unknown roles or
// permissions are denied.
package rbac

import "errors"

// Role of a workspace member.
type Role string

const (
	Owner      Role = "owner"
	Admin      Role = "admin"
	Accountant Role = "accountant"
	Sales      Role = "sales"
	Viewer     Role = "viewer"
)

// Permission is one action.
type Permission string

const (
	InvoiceView       Permission = "invoice:view"
	InvoiceCreate     Permission = "invoice:create" // drafts
	InvoiceIssue      Permission = "invoice:issue"
	InvoiceApprove    Permission = "invoice:approve"
	InvoiceVoid       Permission = "invoice:void"
	CreditNoteCreate  Permission = "creditnote:create"
	PaymentRecord     Permission = "payment:record"
	QuoteManage       Permission = "quote:manage"
	ClientView        Permission = "client:view"
	ClientWrite       Permission = "client:write"
	ReportView        Permission = "report:view"
	DataExport        Permission = "data:export"
	DataImport        Permission = "data:import"
	SettingsManage    Permission = "settings:manage"
	IntegrationManage Permission = "integration:manage"
	APIKeyManage      Permission = "apikey:manage"
	UserManage        Permission = "user:manage"
	OwnerTransfer     Permission = "owner:transfer"
)

var all = []Permission{InvoiceView, InvoiceCreate, InvoiceIssue, InvoiceApprove, InvoiceVoid, CreditNoteCreate, PaymentRecord,
	QuoteManage, ClientView, ClientWrite, ReportView, DataExport, DataImport, SettingsManage, IntegrationManage, APIKeyManage,
	UserManage, OwnerTransfer}

func set(ps ...Permission) map[Permission]bool {
	m := map[Permission]bool{}
	for _, p := range ps {
		m[p] = true
	}
	return m
}

var matrix = func() map[Role]map[Permission]bool {
	admin := set(all...)
	delete(admin, OwnerTransfer)
	return map[Role]map[Permission]bool{
		Owner: set(all...),
		Admin: admin,
		Accountant: set(InvoiceView, InvoiceCreate, InvoiceIssue, InvoiceApprove, InvoiceVoid, CreditNoteCreate, PaymentRecord,
			ClientView, ClientWrite, ReportView, DataExport),
		Sales:  set(InvoiceView, InvoiceCreate, QuoteManage, ClientView, ClientWrite),
		Viewer: set(InvoiceView, ClientView, ReportView),
	}
}()

// Can reports whether the role has the permission. Unknown roles have none.
func Can(r Role, p Permission) bool { return matrix[r][p] }

// Roles lists the built-in roles.
func Roles() []Role { return []Role{Owner, Admin, Accountant, Sales, Viewer} }

// Errors (translation keys).
var (
	ErrForbidden    = errors.New("error.rbac.forbidden")
	ErrSelfApproval = errors.New("error.rbac.selfApproval")
)

// ApprovalPolicy requires a second person to approve large invoices.
// Thresholds are in minor units per currency. A currency without a threshold
// requires approval, so an unconfigured currency fails safe.
type ApprovalPolicy struct {
	Thresholds      map[string]int64
	SeparateCreator bool // the approver may not be the person who created it
}

// Required reports whether an invoice of this size needs approval.
func (p ApprovalPolicy) Required(currency string, total int64) bool {
	limit, ok := p.Thresholds[currency]
	return !ok || total >= limit
}

// CheckApprover verifies that this person may approve this invoice.
func (p ApprovalPolicy) CheckApprover(role Role, approverID, creatorID string) error {
	if !Can(role, InvoiceApprove) {
		return ErrForbidden
	}
	if p.SeparateCreator && approverID == creatorID {
		return ErrSelfApproval
	}
	return nil
}
