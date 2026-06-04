package abtest

import (
	"encoding/json"
	"time"
)

type Experiment struct {
	ExperimentID string    `gorm:"primaryKey;column:experiment_id;size:100"`
	Name         string    `gorm:"column:name;size:200"`
	Description  string    `gorm:"column:description;type:text"`
	Groups       string    `gorm:"column:groups;type:json"`
	Enabled      bool      `gorm:"column:enabled;default:true;index"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (Experiment) TableName() string {
	return "ab_experiments"
}

type Group struct {
	GroupID           string            `json:"group_id"`
	Name              string            `json:"name"`
	TrafficPercentage int32             `json:"traffic_percentage"`
	Variables         map[string]string `json:"variables"`
}

func (e *Experiment) GetGroups() ([]*Group, error) {
	var groups []*Group
	if err := json.Unmarshal([]byte(e.Groups), &groups); err != nil {
		return nil, err
	}
	return groups, nil
}

func (e *Experiment) SetGroups(groups []*Group) error {
	data, err := json.Marshal(groups)
	if err != nil {
		return err
	}
	e.Groups = string(data)
	return nil
}

type ExperimentStats struct {
	ID           int64     `gorm:"primaryKey;column:id"`
	ExperimentID string    `gorm:"column:experiment_id;size:100;index:idx_exp_group"`
	GroupID      string    `gorm:"column:group_id;size:100;index:idx_exp_group"`
	Impressions  int64     `gorm:"column:impressions;default:0"`
	Clicks       int64     `gorm:"column:clicks;default:0"`
	Date         time.Time `gorm:"column:date;type:date;index:idx_date"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (ExperimentStats) TableName() string {
	return "ab_experiment_stats"
}
