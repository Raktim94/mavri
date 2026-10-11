package gst

// Note is a translatable message: a catalog key plus named arguments. Messages
// are never built by joining fragments, so every language can order words freely.
type Note struct {
	Key  string
	Args map[string]string
}

// SupplyType is goods or services; the place-of-supply rules differ.
type SupplyType string

const (
	Goods    SupplyType = "goods"
	Services SupplyType = "services"
)

// POSInput is what the user selected for place of supply.
type POSInput struct {
	SupplyType     SupplyType
	SupplierState  string
	PlaceOfSupply  string // chosen by the user; never inferred
	RecipientGSTIN string
	DeliveryState  string
}

// ReviewPlaceOfSupply returns reasons a person should double-check the place
// of supply. It does not decide the correct treatment.
func ReviewPlaceOfSupply(in POSInput) []Note {
	var out []Note
	add := func(key string, kv ...string) {
		args := map[string]string{}
		for i := 0; i+1 < len(kv); i += 2 {
			args[kv[i]] = kv[i+1]
		}
		out = append(out, Note{Key: key, Args: args})
	}
	if in.PlaceOfSupply == "" {
		add("gst.review.placeOfSupplyMissing")
		return out
	}
	if in.SupplyType != Goods && in.SupplyType != Services {
		add("gst.review.supplyTypeUnknown")
	}
	if g := ParseGSTIN(in.RecipientGSTIN); in.RecipientGSTIN != "" && g.FormatOK && g.StateCode != in.PlaceOfSupply {
		add("gst.review.recipientStateDiffers", "recipientState", g.StateCode, "placeOfSupply", in.PlaceOfSupply)
	}
	if in.SupplyType == Goods && in.DeliveryState != "" && in.DeliveryState != in.PlaceOfSupply {
		add("gst.review.deliveryStateDiffers", "deliveryState", in.DeliveryState, "placeOfSupply", in.PlaceOfSupply)
	}
	return out
}
