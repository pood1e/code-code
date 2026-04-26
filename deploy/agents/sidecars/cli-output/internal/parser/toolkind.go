package parser

import "strings"

func NormalizeToolKind(name string) string {
	normalized := strings.NewReplacer("-", "_", " ", "_").Replace(strings.ToLower(strings.TrimSpace(name)))
	switch normalized {
	case "bash", "shell", "terminal", "exec", "exec_command", "run_command", "run_shell_command", "run_terminal_cmd":
		return "shell"
	case "grep", "rg", "ripgrep", "file_search", "search_files", "search_file_content":
		return "file_grep"
	case "web_search", "search", "google_search", "bing_search", "tavily_search":
		return "web_search"
	case "apply_patch", "edit_file", "write_file", "create_file", "delete_file", "replace_in_file", "multi_edit", "str_replace_editor":
		return "file_diff"
	default:
		return "fallback"
	}
}
