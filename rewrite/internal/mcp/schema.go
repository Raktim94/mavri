package mcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"unicode/utf8"
)

// A small schema builder. Properties keep the order they were declared in,
// which is the order validation reports problems in and the order clients see.

type obj = map[string]any

// Field is one property of an object schema.
type Field struct {
	name     string
	schema   obj
	required bool
}

// Fields is an ordered property list; it marshals as a JSON object in order.
type Fields []Field

func (f Fields) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, p := range f {
		if i > 0 {
			buf.WriteByte(',')
		}
		k, _ := json.Marshal(p.name)
		v, err := json.Marshal(p.schema)
		if err != nil {
			return nil, err
		}
		buf.Write(k)
		buf.WriteByte(':')
		buf.Write(v)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// Required and Optional declare a property.
func Required(name string, s obj) Field { return Field{name, s, true} }
func Optional(name string, s obj) Field { return Field{name, s, false} }

// With adds a default value (a property with a default is not required).
func With(s obj, def any) obj { s = cloneObj(s); s["default"] = def; return s }

// Described adds a description.
func Described(s obj, d string) obj { s = cloneObj(s); s["description"] = d; return s }

func cloneObj(o obj) obj {
	c := obj{}
	for k, v := range o {
		c[k] = v
	}
	return c
}

func String() obj          { return obj{"type": "string"} }
func Number() obj          { return obj{"type": "number"} }
func Boolean() obj         { return obj{"type": "boolean"} }
func MaxLen(n int) obj     { return obj{"type": "string", "maxLength": n} }
func ExactLen(n int) obj   { return obj{"type": "string", "minLength": n, "maxLength": n} }
func Enum(v ...string) obj { return obj{"type": "string", "enum": v} }

// Array of items with at least min elements (0 for none).
func Array(items obj, min int) obj {
	a := obj{"type": "array", "items": items}
	if min > 0 {
		a["minItems"] = min
	}
	return a
}

// Object is a nested object schema.
func Object(fields ...Field) obj { return objectSchema(fields, false) }

// Input is the top-level argument schema of a tool.
func Input(fields ...Field) obj { return objectSchema(fields, true) }

func objectSchema(fields []Field, top bool) obj {
	s := obj{"type": "object", "properties": Fields(fields)}
	if top {
		s["$schema"] = "http://json-schema.org/draft-07/schema#"
	}
	var req []string
	for _, f := range fields {
		if f.required {
			req = append(req, f.name)
		}
	}
	if len(req) > 0 {
		s["required"] = req
	}
	return s
}

// ---- validation, worded like the zod validator the original used -----------------

func jsType(v any) string {
	switch v.(type) {
	case nil:
		return "null"
	case string:
		return "string"
	case json.Number, float64:
		return "number"
	case bool:
		return "boolean"
	case []any:
		return "array"
	}
	return "object"
}

// Validate returns every problem with args, in the order of the schema's
// properties, each worded as "<what is wrong> at <path>".
func Validate(schema obj, v any) []string {
	var issues []string
	check(schema, v, "", &issues)
	return issues
}

func at(msg, path string) string {
	if path == "" {
		return msg
	}
	return msg + " at " + path
}

func check(schema obj, v any, path string, issues *[]string) {
	want, _ := schema["type"].(string)
	if got := jsType(v); got != want {
		*issues = append(*issues, at(fmt.Sprintf("Invalid input: expected %s, received %s", want, got), path))
		return
	}
	switch want {
	case "object":
		m := v.(map[string]any)
		fields, _ := schema["properties"].(Fields)
		for _, f := range fields {
			child := f.name
			if path != "" {
				child = path + "." + f.name
			}
			val, present := m[f.name]
			if !present {
				if f.required {
					*issues = append(*issues, at(fmt.Sprintf("Invalid input: expected %s, received undefined", f.schema["type"]), child))
				}
				continue
			}
			check(f.schema, val, child, issues)
		}
	case "string":
		s := v.(string)
		n := utf8.RuneCountInString(s)
		min, hasMin := schema["minLength"].(int)
		max, hasMax := schema["maxLength"].(int)
		switch {
		case hasMin && hasMax && min == max && n != max:
			dir := "Too small"
			if n > max {
				dir = "Too big"
			}
			*issues = append(*issues, at(fmt.Sprintf("%s: expected string to have exactly %d characters", dir, max), path))
		case hasMax && n > max:
			*issues = append(*issues, at(fmt.Sprintf("Too big: expected string to have <=%d characters", max), path))
		case hasMin && n < min:
			*issues = append(*issues, at(fmt.Sprintf("Too small: expected string to have >=%d characters", min), path))
		}
		if enum, ok := schema["enum"].([]string); ok {
			found := false
			for _, e := range enum {
				found = found || e == s
			}
			if !found {
				quoted := make([]string, len(enum))
				for i, e := range enum {
					quoted[i] = `"` + e + `"`
				}
				*issues = append(*issues, at("Invalid option: expected one of "+strings.Join(quoted, "|"), path))
			}
		}
	case "number":
		if n, ok := v.(json.Number); ok {
			if f, err := n.Float64(); err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
				*issues = append(*issues, at("Invalid input: expected number, received NaN", path))
			}
		}
	case "array":
		list := v.([]any)
		if min, ok := schema["minItems"].(int); ok && len(list) < min {
			*issues = append(*issues, at(fmt.Sprintf("Too small: expected array to have >=%d items", min), path))
		}
		if items, ok := schema["items"].(obj); ok {
			for i, el := range list {
				check(items, el, fmt.Sprintf("%s[%d]", path, i), issues)
			}
		}
	}
}
