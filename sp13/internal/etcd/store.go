package etcd

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"path"
	"sync"
	"sync/atomic"
	"time"

	"config-server/internal/config"
	"config-server/internal/crypto"
	"config-server/internal/model"

	"go.etcd.io/etcd/api/v3/mvccpb"
	clientv3 "go.etcd.io/etcd/client/v3"
)

type Store struct {
	client    *clientv3.Client
	prefix    string
	watchRev  atomic.Int64
	encryptor *crypto.Encryptor
}

type WatchEvent struct {
	Type   mvccpb.Event_EventType
	Key    string
	Config *model.ConfigItem
	Rev    int64
}

func NewStore(cfg *config.EtcdConfig, encryptionKey string) (*Store, error) {
	client, err := clientv3.New(clientv3.Config{
		Endpoints:   cfg.Endpoints,
		DialTimeout: time.Duration(cfg.DialTimeout) * time.Second,
	})
	if err != nil {
		return nil, err
	}

	s := &Store{
		client: client,
		prefix: cfg.Prefix,
	}

	if encryptionKey != "" {
		enc, err := crypto.NewEncryptor(encryptionKey)
		if err != nil {
			client.Close()
			return nil, fmt.Errorf("failed to initialize encryptor: %w", err)
		}
		s.encryptor = enc
		log.Println("Config encryption enabled (AES-256-GCM)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dataPrefix := path.Join(cfg.Prefix, "data")
	resp, err := client.Get(ctx, dataPrefix, clientv3.WithPrefix())
	if err != nil {
		log.Printf("Warning: failed to get initial revision: %v", err)
	} else {
		s.watchRev.Store(resp.Header.Revision)
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.client.Close()
}

func (s *Store) getKeyPath(key string) string {
	return path.Join(s.prefix, "data", key)
}

func (s *Store) getVersionPath(key string, version int) string {
	return path.Join(s.prefix, "versions", key, fmt.Sprintf("%d", version))
}

func (s *Store) getVersionsPrefix(key string) string {
	return path.Join(s.prefix, "versions", key)
}

func (s *Store) getAuditPath(id string) string {
	return path.Join(s.prefix, "audit", id)
}

func (s *Store) getAuditPrefix() string {
	return path.Join(s.prefix, "audit")
}

func (s *Store) encryptValue(value map[string]interface{}) (string, error) {
	if s.encryptor == nil {
		return "", fmt.Errorf("encryption not configured")
	}
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return s.encryptor.Encrypt(data)
}

func (s *Store) decryptValue(encryptedValue string) (map[string]interface{}, error) {
	if s.encryptor == nil {
		return nil, fmt.Errorf("encryption not configured")
	}
	data, err := s.encryptor.Decrypt(encryptedValue)
	if err != nil {
		return nil, err
	}
	var value map[string]interface{}
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func (s *Store) Create(ctx context.Context, key string, value map[string]interface{}, format string, encrypted bool) (*model.ConfigItem, error) {
	keyPath := s.getKeyPath(key)

	resp, err := s.client.Get(ctx, keyPath)
	if err != nil {
		return nil, err
	}
	if len(resp.Kvs) > 0 {
		return nil, fmt.Errorf("config already exists: %s", key)
	}

	now := time.Now()
	item := &model.ConfigItem{
		Key:       key,
		Version:   1,
		CreatedAt: now,
		UpdatedAt: now,
		Format:    format,
		Encrypted: encrypted,
	}

	if encrypted && s.encryptor != nil {
		encValue, err := s.encryptValue(value)
		if err != nil {
			return nil, fmt.Errorf("encryption failed: %w", err)
		}
		item.EncryptedValue = encValue
		item.Value = nil
	} else {
		item.Value = value
		item.Encrypted = false
	}

	data, err := json.Marshal(item)
	if err != nil {
		return nil, err
	}

	putResp, err := s.client.Put(ctx, keyPath, string(data))
	if err != nil {
		return nil, err
	}

	s.updateWatchRev(putResp.Header.Revision)

	err = s.saveVersion(ctx, key, item)
	if err != nil {
		return nil, err
	}

	result := s.decryptItem(item)
	return result, nil
}

func (s *Store) decryptItem(item *model.ConfigItem) *model.ConfigItem {
	result := *item
	if item.Encrypted && item.EncryptedValue != "" && s.encryptor != nil {
		decrypted, err := s.decryptValue(item.EncryptedValue)
		if err != nil {
			log.Printf("Warning: failed to decrypt config %s: %v", item.Key, err)
			result.Value = map[string]interface{}{"_error": "decryption failed"}
		} else {
			result.Value = decrypted
		}
		result.EncryptedValue = ""
	}
	return &result
}

func (s *Store) Get(ctx context.Context, key string) (*model.ConfigItem, error) {
	keyPath := s.getKeyPath(key)
	resp, err := s.client.Get(ctx, keyPath)
	if err != nil {
		return nil, err
	}
	if len(resp.Kvs) == 0 {
		return nil, fmt.Errorf("config not found: %s", key)
	}

	var item model.ConfigItem
	if err := json.Unmarshal(resp.Kvs[0].Value, &item); err != nil {
		return nil, err
	}

	return s.decryptItem(&item), nil
}

func (s *Store) Update(ctx context.Context, key string, value map[string]interface{}, format string, encrypted bool) (*model.ConfigItem, error) {
	existing, err := s.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	item := &model.ConfigItem{
		Key:       key,
		Version:   existing.Version + 1,
		CreatedAt: existing.CreatedAt,
		UpdatedAt: now,
		Format:    format,
		Encrypted: encrypted,
	}

	if encrypted && s.encryptor != nil {
		encValue, err := s.encryptValue(value)
		if err != nil {
			return nil, fmt.Errorf("encryption failed: %w", err)
		}
		item.EncryptedValue = encValue
		item.Value = nil
	} else {
		item.Value = value
		item.Encrypted = false
	}

	data, err := json.Marshal(item)
	if err != nil {
		return nil, err
	}

	keyPath := s.getKeyPath(key)
	putResp, err := s.client.Put(ctx, keyPath, string(data))
	if err != nil {
		return nil, err
	}

	s.updateWatchRev(putResp.Header.Revision)

	err = s.saveVersion(ctx, key, item)
	if err != nil {
		return nil, err
	}

	err = s.cleanupOldVersions(ctx, key)
	if err != nil {
		return nil, err
	}

	result := s.decryptItem(item)
	return result, nil
}

func (s *Store) Delete(ctx context.Context, key string) error {
	keyPath := s.getKeyPath(key)
	versionsPrefix := s.getVersionsPrefix(key)

	delResp, err := s.client.Delete(ctx, keyPath)
	if err != nil {
		return err
	}

	s.updateWatchRev(delResp.Header.Revision)

	_, err = s.client.Delete(ctx, versionsPrefix, clientv3.WithPrefix())
	return err
}

func (s *Store) List(ctx context.Context) ([]*model.ConfigItem, error) {
	dataPrefix := path.Join(s.prefix, "data")
	resp, err := s.client.Get(ctx, dataPrefix, clientv3.WithPrefix())
	if err != nil {
		return nil, err
	}

	items := make([]*model.ConfigItem, 0, len(resp.Kvs))
	for _, kv := range resp.Kvs {
		var item model.ConfigItem
		if err := json.Unmarshal(kv.Value, &item); err != nil {
			continue
		}
		items = append(items, s.decryptItem(&item))
	}
	return items, nil
}

func (s *Store) saveVersion(ctx context.Context, key string, item *model.ConfigItem) error {
	version := &model.ConfigVersion{
		Key:            key,
		Value:          item.Value,
		EncryptedValue: item.EncryptedValue,
		Encrypted:      item.Encrypted,
		Version:        item.Version,
		CreatedAt:      item.UpdatedAt,
	}
	data, err := json.Marshal(version)
	if err != nil {
		return err
	}
	versionPath := s.getVersionPath(key, item.Version)
	_, err = s.client.Put(ctx, versionPath, string(data))
	return err
}

func (s *Store) cleanupOldVersions(ctx context.Context, key string) error {
	versionsPrefix := s.getVersionsPrefix(key)
	resp, err := s.client.Get(ctx, versionsPrefix, clientv3.WithPrefix())
	if err != nil {
		return err
	}

	if len(resp.Kvs) <= 10 {
		return nil
	}

	type versionEntry struct {
		version int
		path    string
	}

	versions := make([]versionEntry, 0, len(resp.Kvs))
	for _, kv := range resp.Kvs {
		var ver model.ConfigVersion
		if err := json.Unmarshal(kv.Value, &ver); err != nil {
			continue
		}
		versions = append(versions, versionEntry{version: ver.Version, path: string(kv.Key)})
	}

	for i := 0; i < len(versions)-10; i++ {
		_, err := s.client.Delete(ctx, versions[i].path)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *Store) GetVersions(ctx context.Context, key string) ([]*model.ConfigVersion, error) {
	versionsPrefix := s.getVersionsPrefix(key)
	resp, err := s.client.Get(ctx, versionsPrefix, clientv3.WithPrefix())
	if err != nil {
		return nil, err
	}

	versions := make([]*model.ConfigVersion, 0, len(resp.Kvs))
	for _, kv := range resp.Kvs {
		var ver model.ConfigVersion
		if err := json.Unmarshal(kv.Value, &ver); err != nil {
			continue
		}
		if ver.Encrypted && ver.EncryptedValue != "" && s.encryptor != nil {
			decrypted, err := s.decryptValue(ver.EncryptedValue)
			if err == nil {
				ver.Value = decrypted
				ver.EncryptedValue = ""
			}
		}
		versions = append(versions, &ver)
	}
	return versions, nil
}

func (s *Store) GetVersion(ctx context.Context, key string, version int) (*model.ConfigVersion, error) {
	versionPath := s.getVersionPath(key, version)
	resp, err := s.client.Get(ctx, versionPath)
	if err != nil {
		return nil, err
	}
	if len(resp.Kvs) == 0 {
		return nil, fmt.Errorf("version not found: %d", version)
	}

	var ver model.ConfigVersion
	if err := json.Unmarshal(resp.Kvs[0].Value, &ver); err != nil {
		return nil, err
	}

	if ver.Encrypted && ver.EncryptedValue != "" && s.encryptor != nil {
		decrypted, err := s.decryptValue(ver.EncryptedValue)
		if err == nil {
			ver.Value = decrypted
			ver.EncryptedValue = ""
		}
	}

	return &ver, nil
}

func (s *Store) Rollback(ctx context.Context, key string, version int) (*model.ConfigItem, error) {
	ver, err := s.GetVersion(ctx, key, version)
	if err != nil {
		return nil, err
	}

	return s.Update(ctx, key, ver.Value, "json", ver.Encrypted)
}

func (s *Store) RecordAudit(ctx context.Context, auditLog *model.AuditLog) error {
	id := fmt.Sprintf("%d_%s", time.Now().UnixNano(), auditLog.Key)
	auditLog.ID = id
	auditLog.Timestamp = time.Now()

	data, err := json.Marshal(auditLog)
	if err != nil {
		return err
	}

	auditPath := s.getAuditPath(id)
	_, err = s.client.Put(ctx, auditPath, string(data))
	return err
}

func (s *Store) QueryAuditLogs(ctx context.Context, query *model.AuditQueryRequest) ([]*model.AuditLog, error) {
	auditPrefix := s.getAuditPrefix()
	resp, err := s.client.Get(ctx, auditPrefix, clientv3.WithPrefix(), clientv3.WithSort(clientv3.SortByKey, clientv3.SortDescend))
	if err != nil {
		return nil, err
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := query.Offset
	if offset < 0 {
		offset = 0
	}

	var fromTime, toTime time.Time
	if query.From != "" {
		fromTime, _ = time.Parse(time.RFC3339, query.From)
	}
	if query.To != "" {
		toTime, _ = time.Parse(time.RFC3339, query.To)
	}

	logs := make([]*model.AuditLog, 0)
	skipped := 0

	for _, kv := range resp.Kvs {
		var auditLog model.AuditLog
		if err := json.Unmarshal(kv.Value, &auditLog); err != nil {
			continue
		}

		if query.Key != "" && auditLog.Key != query.Key {
			continue
		}
		if query.Action != "" && auditLog.Action != query.Action {
			continue
		}
		if query.Operator != "" && auditLog.Operator != query.Operator {
			continue
		}
		if !fromTime.IsZero() && auditLog.Timestamp.Before(fromTime) {
			continue
		}
		if !toTime.IsZero() && auditLog.Timestamp.After(toTime) {
			continue
		}

		if skipped < offset {
			skipped++
			continue
		}

		logs = append(logs, &auditLog)
		if len(logs) >= limit {
			break
		}
	}

	return logs, nil
}

func (s *Store) updateWatchRev(rev int64) {
	for {
		current := s.watchRev.Load()
		if rev <= current {
			break
		}
		if s.watchRev.CompareAndSwap(current, rev) {
			break
		}
	}
}

func (s *Store) ReliableWatchAll(ctx context.Context, handler func(events []*WatchEvent)) error {
	dataPrefix := path.Join(s.prefix, "data")

	for {
		rev := s.watchRev.Load()
		if rev == 0 {
			getResp, err := s.client.Get(ctx, dataPrefix, clientv3.WithPrefix())
			if err != nil {
				log.Printf("etcd watch: failed to get initial revision: %v", err)
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(time.Second):
					continue
				}
			}
			rev = getResp.Header.Revision
			s.watchRev.Store(rev)
		}

		watchRev := rev + 1
		log.Printf("etcd watch: starting from revision %d", watchRev)

		watchChan := s.client.Watch(ctx, dataPrefix, clientv3.WithPrefix(), clientv3.WithRev(watchRev))

		for watchResp := range watchChan {
			if err := watchResp.Err(); err != nil {
				log.Printf("etcd watch error: %v, will retry from revision %d", err, s.watchRev.Load()+1)
				break
			}

			if len(watchResp.Events) == 0 {
				continue
			}

			events := make([]*WatchEvent, 0, len(watchResp.Events))
			for _, event := range watchResp.Events {
				key := path.Base(string(event.Kv.Key))

				var configItem model.ConfigItem
				if event.Type != clientv3.EventTypeDelete {
					if err := json.Unmarshal(event.Kv.Value, &configItem); err != nil {
						continue
					}
				}

				events = append(events, &WatchEvent{
					Type:   event.Type,
					Key:    key,
					Config: s.decryptItem(&configItem),
					Rev:    event.Kv.ModRevision,
				})
			}

			if len(events) > 0 {
				lastRev := events[len(events)-1].Rev
				s.updateWatchRev(lastRev)
				handler(events)
			}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
}

type Watcher struct {
	store   *Store
	cancel  context.CancelFunc
	Events  chan []*WatchEvent
	LastRev int64
	mu      sync.Mutex
}

func (s *Store) NewWatcher(ctx context.Context) *Watcher {
	childCtx, cancel := context.WithCancel(ctx)
	w := &Watcher{
		store:  s,
		cancel: cancel,
		Events: make(chan []*WatchEvent, 64),
	}

	go func() {
		defer close(w.Events)
		err := s.ReliableWatchAll(childCtx, func(events []*WatchEvent) {
			w.mu.Lock()
			if len(events) > 0 {
				w.LastRev = events[len(events)-1].Rev
			}
			w.mu.Unlock()

			select {
			case w.Events <- events:
			default:
				log.Printf("watcher: event channel full, dropping events")
			}
		})
		if err != nil && err != context.Canceled {
			log.Printf("watcher stopped with error: %v", err)
		}
	}()

	return w
}

func (w *Watcher) Stop() {
	w.cancel()
}

func (w *Watcher) GetLastRev() int64 {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.LastRev
}
