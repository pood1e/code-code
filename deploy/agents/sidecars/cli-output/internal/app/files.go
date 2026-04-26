package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

const sharedFileMode = 0o660

func ensureFIFO(path string) error {
	info, err := os.Lstat(path)
	if err == nil {
		if info.Mode()&os.ModeNamedPipe == 0 {
			return fmt.Errorf("cli-output-sidecar: %s exists and is not a fifo", path)
		}
		return nil
	}
	if !os.IsNotExist(err) {
		return err
	}
	return syscall.Mkfifo(path, sharedFileMode)
}

func writeJSONFile(path string, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return writeFile(path, append(body, '\n'))
}

func writeFile(path string, body []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(sharedFileMode); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(body); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
