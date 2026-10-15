package mcp

import (
	"fmt"
	"math"
	"sort"
)

// Validate checks args against the small subset of JSON Schema the tools use:
// object properties, required, type, enum, minimum, and array items.
func Validate(schema map[string]any, args map[string]any) error {
	return validateObject("", schema, args)
}

func validateObject(path string, schema map[string]any, v map[string]any) error {
	props, _ := schema["properties"].(map[string]any)
	if req, ok := schema["required"].([]string); ok {
		for _, name := range req {
			if _, present := v[name]; !present {
				return fmt.Errorf("%s is required", join(path, name))
			}
		}
	}
	keys := make([]string, 0, len(v))
	for k := range v {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		ps, ok := props[k].(map[string]any)
		if !ok {
			return fmt.Errorf("%s is not a known argument", join(path, k))
		}
		if err := validateValue(join(path, k), ps, v[k]); err != nil {
			return err
		}
	}
	return nil
}

func join(path, name string) string {
	if path == "" {
		return name
	}
	return path + "." + name
}

func validateValue(path string, schema map[string]any, v any) error {
	switch schema["type"] {
	case "string":
		s, ok := v.(string)
		if !ok {
			return fmt.Errorf("%s must be a string", path)
		}
		if enum, ok := schema["enum"].([]string); ok {
			for _, e := range enum {
				if e == s {
					return nil
				}
			}
			return fmt.Errorf("%s must be one of %v", path, enum)
		}
	case "number", "integer":
		f, ok := v.(float64)
		if !ok {
			return fmt.Errorf("%s must be a number", path)
		}
		if schema["type"] == "integer" && f != math.Trunc(f) {
			return fmt.Errorf("%s must be a whole number", path)
		}
		if min, ok := schema["minimum"].(float64); ok && f < min {
			return fmt.Errorf("%s must be at least %v", path, min)
		}
	case "boolean":
		if _, ok := v.(bool); !ok {
			return fmt.Errorf("%s must be true or false", path)
		}
	case "array":
		arr, ok := v.([]any)
		if !ok {
			return fmt.Errorf("%s must be a list", path)
		}
		if items, ok := schema["items"].(map[string]any); ok {
			for i, e := range arr {
				if err := validateValue(fmt.Sprintf("%s[%d]", path, i), items, e); err != nil {
					return err
				}
			}
		}
	case "object":
		o, ok := v.(map[string]any)
		if !ok {
			return fmt.Errorf("%s must be an object", path)
		}
		if _, hasProps := schema["properties"]; hasProps {
			return validateObject(path, schema, o)
		}
	}
	return nil
}
