package gcode

import (
	"fmt"
	"strconv"
	"strings"
)

type Command struct {
	Raw    string
	Letter string
	Number int
	Params map[string]float64
}

func Parse(line string) (*Command, error) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, ";") {
		return nil, fmt.Errorf("empty or comment line")
	}

	if idx := strings.Index(line, ";"); idx != -1 {
		line = strings.TrimSpace(line[:idx])
	}

	cmd := &Command{
		Raw:    line,
		Params: make(map[string]float64),
	}

	fields := strings.Fields(line)
	if len(fields) == 0 {
		return nil, fmt.Errorf("invalid gcode: %s", line)
	}

	first := fields[0]
	if len(first) < 2 {
		return nil, fmt.Errorf("invalid command: %s", first)
	}

	cmd.Letter = strings.ToUpper(string(first[0]))
	num, err := strconv.Atoi(first[1:])
	if err != nil {
		return nil, fmt.Errorf("invalid command number: %s", first[1:])
	}
	cmd.Number = num

	for _, field := range fields[1:] {
		if len(field) < 1 {
			continue
		}
		letter := strings.ToUpper(string(field[0]))
		value, err := strconv.ParseFloat(field[1:], 64)
		if err != nil {
			continue
		}
		cmd.Params[letter] = value
	}

	return cmd, nil
}

func (c *Command) HasParam(letter string) bool {
	_, ok := c.Params[strings.ToUpper(letter)]
	return ok
}

func (c *Command) GetParam(letter string) (float64, bool) {
	v, ok := c.Params[strings.ToUpper(letter)]
	return v, ok
}

func (c *Command) GetParamDefault(letter string, def float64) float64 {
	if v, ok := c.Params[strings.ToUpper(letter)]; ok {
		return v
	}
	return def
}

func (c *Command) String() string {
	return fmt.Sprintf("%s%d", c.Letter, c.Number)
}
