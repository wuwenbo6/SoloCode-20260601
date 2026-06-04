package database

import (
	"3d-printer-controller/internal/models"
	"errors"
	"log"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(&models.PrintJob{})
	if err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func CreatePrintJob(job *models.PrintJob) error {
	return DB.Create(job).Error
}

func UpdatePrintJob(job *models.PrintJob) error {
	return DB.Save(job).Error
}

func GetPrintJobByID(id uint) (*models.PrintJob, error) {
	var job models.PrintJob
	err := DB.First(&job, id).Error
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func GetAllPrintJobs(limit, offset int) ([]models.PrintJob, int64, error) {
	var jobs []models.PrintJob
	var total int64

	err := DB.Model(&models.PrintJob{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = DB.Order("start_time DESC").Limit(limit).Offset(offset).Find(&jobs).Error
	if err != nil {
		return nil, 0, err
	}

	return jobs, total, nil
}

func StartNewPrintJob(fileName string) (*models.PrintJob, error) {
	job := &models.PrintJob{
		FileName:  fileName,
		StartTime: time.Now(),
		Status:    "printing",
		Success:   false,
	}
	err := CreatePrintJob(job)
	return job, err
}

func CompletePrintJob(id uint, success bool, notes string) error {
	job, err := GetPrintJobByID(id)
	if err != nil {
		return err
	}

	job.EndTime = time.Now()
	job.Duration = int64(job.EndTime.Sub(job.StartTime).Seconds())
	job.Status = "completed"
	if !success {
		job.Status = "failed"
	}
	job.Success = success
	job.Notes = notes

	return UpdatePrintJob(job)
}

func DeletePrintJob(id uint) error {
	result := DB.Delete(&models.PrintJob{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("print job not found")
	}
	return nil
}
