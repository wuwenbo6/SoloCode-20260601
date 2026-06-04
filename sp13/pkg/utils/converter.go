package utils

import (
	"encoding/json"

	"gopkg.in/yaml.v2"
)

func JSONToYAML(data interface{}) ([]byte, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	var obj interface{}
	if err := json.Unmarshal(jsonBytes, &obj); err != nil {
		return nil, err
	}
	return yaml.Marshal(obj)
}

func YAMLToJSON(data []byte) (interface{}, error) {
	var obj interface{}
	if err := yaml.Unmarshal(data, &obj); err != nil {
		return nil, err
	}
	jsonBytes, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	var result interface{}
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func ConvertToMap(data interface{}) (map[string]interface{}, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		return nil, err
	}
	return result, nil
}
