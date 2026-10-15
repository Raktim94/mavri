// Package mcp is a Model Context Protocol server over stdio: newline-delimited
// JSON-RPC 2.0 that lets an AI client work with Mavri's data through tools.
package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"sync"
)

// ProtocolVersion is the MCP revision this server speaks.
const ProtocolVersion = "2024-11-05"

// Tool is one operation offered to the client.
type Tool struct {
	Name        string
	Description string
	Schema      map[string]any // JSON schema of the arguments
	Run         func(ctx context.Context, args map[string]any) (any, error)
}

// Server dispatches requests to tools.
type Server struct {
	Name, Version string
	tools         map[string]Tool
	order         []string
	mu            sync.Mutex
}

// NewServer registers the tools.
func NewServer(name, version string, tools []Tool) *Server {
	s := &Server{Name: name, Version: version, tools: map[string]Tool{}}
	for _, t := range tools {
		s.tools[t.Name] = t
		s.order = append(s.order, t.Name)
	}
	sort.Strings(s.order)
	return s
}

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

// Serve reads requests from in until it ends and writes replies to out.
func (s *Server) Serve(ctx context.Context, in io.Reader, out io.Writer) error {
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 1<<20), 16<<20)
	enc := json.NewEncoder(out)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		if resp := s.Handle(ctx, line); resp != nil {
			if err := enc.Encode(resp); err != nil {
				return err
			}
		}
	}
	return sc.Err()
}

// Handle answers one message, or returns nil for a notification.
func (s *Server) Handle(ctx context.Context, line []byte) *response {
	var req request
	if err := json.Unmarshal(line, &req); err != nil || req.JSONRPC != "2.0" {
		return &response{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{-32700, "parse error"}}
	}
	notification := len(req.ID) == 0
	reply := func(result any) *response {
		if notification {
			return nil
		}
		return &response{JSONRPC: "2.0", ID: req.ID, Result: result}
	}
	fail := func(code int, msg string) *response {
		if notification {
			return nil
		}
		return &response{JSONRPC: "2.0", ID: req.ID, Error: &rpcError{code, msg}}
	}
	switch req.Method {
	case "initialize":
		return reply(map[string]any{
			"protocolVersion": ProtocolVersion,
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]string{"name": s.Name, "version": s.Version},
		})
	case "ping":
		return reply(map[string]any{})
	case "tools/list":
		list := []map[string]any{}
		for _, n := range s.order {
			t := s.tools[n]
			list = append(list, map[string]any{"name": t.Name, "description": t.Description, "inputSchema": t.Schema})
		}
		return reply(map[string]any{"tools": list})
	case "tools/call":
		var p struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return fail(-32602, "invalid params")
		}
		t, ok := s.tools[p.Name]
		if !ok {
			return fail(-32602, "unknown tool "+p.Name)
		}
		if p.Arguments == nil {
			p.Arguments = map[string]any{}
		}
		if err := Validate(t.Schema, p.Arguments); err != nil {
			return reply(toolResult(fmt.Sprintf("invalid arguments: %v", err), true))
		}
		s.mu.Lock() // one tool at a time keeps the single database connection simple
		res, err := t.Run(ctx, p.Arguments)
		s.mu.Unlock()
		if err != nil {
			return reply(toolResult(err.Error(), true))
		}
		text, _ := json.MarshalIndent(res, "", "  ")
		return reply(toolResult(string(text), false))
	}
	if notification {
		return nil // e.g. notifications/initialized
	}
	return fail(-32601, "method not found: "+req.Method)
}

func toolResult(text string, isError bool) map[string]any {
	return map[string]any{"content": []map[string]string{{"type": "text", "text": text}}, "isError": isError}
}
