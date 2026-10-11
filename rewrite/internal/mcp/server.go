// Package mcp is a Model Context Protocol server over stdio. It lets an AI
// assistant work with the invoicing data through a small set of tools, using
// an API key to prove the user allowed it.
package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
)

// Protocol versions this server can speak, newest first.
var versions = []string{"2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"}

// Tool is one callable function.
type Tool struct {
	Name, Title, Description string
	Schema                   map[string]any // JSON Schema of the arguments
	Handler                  func(ctx context.Context, args map[string]any) (any, error)
}

// Server answers JSON-RPC messages.
type Server struct {
	Name, Version string
	tools         []Tool
	byName        map[string]Tool
	mu            sync.Mutex
	out           io.Writer
}

// New builds a server with the given tools.
func New(name, version string, tools []Tool) *Server {
	s := &Server{Name: name, Version: version, tools: tools, byName: map[string]Tool{}}
	for _, t := range tools {
		s.byName[t.Name] = t
	}
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

func (s *Server) send(v any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v) // Encode ends with the newline that frames the message
	_, _ = s.out.Write(buf.Bytes())
}

// Serve reads messages from in until it ends, writing replies to out. Nothing
// else may ever be written to out: it carries the protocol.
func (s *Server) Serve(ctx context.Context, in io.Reader, out io.Writer) error {
	s.out = out
	dec := json.NewDecoder(bufio.NewReader(in))
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			if err == io.EOF {
				return nil
			}
			s.send(response{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{-32700, "Parse error"}})
			return fmt.Errorf("mcp: reading input: %w", err)
		}
		raw = bytes.TrimSpace(raw)
		if len(raw) > 0 && raw[0] == '[' { // a batch
			var batch []json.RawMessage
			if json.Unmarshal(raw, &batch) == nil {
				for _, m := range batch {
					s.handle(ctx, m)
				}
			}
			continue
		}
		s.handle(ctx, raw)
	}
}

func (s *Server) handle(ctx context.Context, raw json.RawMessage) {
	var req request
	if err := json.Unmarshal(raw, &req); err != nil || req.JSONRPC != "2.0" || req.Method == "" {
		// Responses and malformed messages get no reply unless they had an id.
		var probe struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
		}
		if json.Unmarshal(raw, &probe) == nil && len(probe.ID) > 0 && probe.Method != "" {
			s.send(response{JSONRPC: "2.0", ID: probe.ID, Error: &rpcError{-32600, "Invalid Request"}})
		}
		return
	}
	notification := len(req.ID) == 0
	reply := func(result any) {
		if !notification {
			s.send(response{JSONRPC: "2.0", ID: req.ID, Result: result})
		}
	}
	fail := func(code int, msg string) {
		if !notification {
			s.send(response{JSONRPC: "2.0", ID: req.ID, Error: &rpcError{code, msg}})
		}
	}
	switch req.Method {
	case "initialize":
		var p struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		_ = json.Unmarshal(req.Params, &p)
		version := versions[0]
		for _, v := range versions {
			if v == p.ProtocolVersion {
				version = v
			}
		}
		reply(map[string]any{
			"protocolVersion": version,
			"capabilities":    map[string]any{"tools": map[string]any{"listChanged": true}},
			"serverInfo":      map[string]any{"name": s.Name, "version": s.Version},
		})
	case "ping":
		reply(map[string]any{})
	case "tools/list":
		list := make([]map[string]any, len(s.tools))
		for i, t := range s.tools {
			entry := map[string]any{"name": t.Name, "title": t.Title, "inputSchema": t.Schema, "execution": map[string]any{"taskSupport": "forbidden"}}
			if t.Description != "" {
				entry["description"] = t.Description
			}
			list[i] = entry
		}
		reply(map[string]any{"tools": list})
	case "tools/call":
		var p struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		dec := json.NewDecoder(bytes.NewReader(req.Params))
		dec.UseNumber()
		if err := dec.Decode(&p); err != nil {
			fail(-32602, "Invalid params")
			return
		}
		tool, ok := s.byName[p.Name]
		if !ok {
			// The reference SDK reports this as a failed call, not a protocol error.
			reply(textResult("MCP error -32602: Tool "+p.Name+" not found", true))
			return
		}
		if p.Arguments == nil {
			p.Arguments = map[string]any{}
		}
		if issues := Validate(tool.Schema, p.Arguments); len(issues) > 0 {
			reply(textResult(fmt.Sprintf("MCP error -32602: Input validation error: Invalid arguments for tool %s: %s", tool.Name, strings.Join(issues, "\n")), true))
			return
		}
		result, err := tool.Handler(ctx, p.Arguments)
		if err != nil {
			reply(textResult(compactJSON(map[string]any{"success": false, "message": err.Error()}), true))
			return
		}
		reply(textResult(prettyJSON(result), false))
	default:
		if notification {
			return // notifications/initialized, notifications/cancelled, ...
		}
		fail(-32601, "Method not found")
	}
}

func textResult(text string, isError bool) map[string]any {
	r := map[string]any{"content": []map[string]any{{"type": "text", "text": text}}}
	if isError {
		r["isError"] = true
	}
	return r
}

func compactJSON(v any) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
	return string(bytes.TrimRight(buf.Bytes(), "\n"))
}

func prettyJSON(v any) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
	return string(bytes.TrimRight(buf.Bytes(), "\n"))
}
