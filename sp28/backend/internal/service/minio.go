package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"ssh-web-terminal/internal/config"
	"sync"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIOService struct {
	client *minio.Client
	cfg    *config.MinIOConfig
	mu     sync.Mutex
}

func NewMinIOService(cfg *config.MinIOConfig) (*MinIOService, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	return &MinIOService{
		client: client,
		cfg:    cfg,
	}, nil
}

func (s *MinIOService) EnsureBucket() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	exists, err := s.client.BucketExists(context.Background(), s.cfg.Bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}

	if !exists {
		if err := s.client.MakeBucket(context.Background(), s.cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return nil
}

func (s *MinIOService) Upload(objectKey string, data []byte) error {
	_, err := s.client.PutObject(
		context.Background(),
		s.cfg.Bucket,
		objectKey,
		bytes.NewReader(data),
		int64(len(data)),
		minio.PutObjectOptions{ContentType: "application/octet-stream"},
	)
	return err
}

func (s *MinIOService) Download(objectKey string) ([]byte, error) {
	object, err := s.client.GetObject(
		context.Background(),
		s.cfg.Bucket,
		objectKey,
		minio.GetObjectOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}
	defer object.Close()

	data, err := io.ReadAll(object)
	if err != nil {
		return nil, fmt.Errorf("failed to read object: %w", err)
	}

	return data, nil
}

func (s *MinIOService) GetObjectSize(objectKey string) (int64, error) {
	stat, err := s.client.StatObject(
		context.Background(),
		s.cfg.Bucket,
		objectKey,
		minio.StatObjectOptions{},
	)
	if err != nil {
		return 0, err
	}
	return stat.Size, nil
}

func (s *MinIOService) Delete(objectKey string) error {
	return s.client.RemoveObject(
		context.Background(),
		s.cfg.Bucket,
		objectKey,
		minio.RemoveObjectOptions{},
	)
}
