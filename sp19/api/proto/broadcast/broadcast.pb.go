package broadcast

type CacheType int32

const (
	CacheType_UNKNOWN        CacheType = 0
	CacheType_USER           CacheType = 1
	CacheType_PRODUCT        CacheType = 2
	CacheType_RECOMMENDATION CacheType = 3
	CacheType_BROWSE_HISTORY CacheType = 4
)

type OperationType int32

const (
	OperationType_OPERATION_UNKNOWN OperationType = 0
	OperationType_CREATE             OperationType = 1
	OperationType_UPDATE             OperationType = 2
	OperationType_DELETE             OperationType = 3
	OperationType_INVALIDATE         OperationType = 4
)

type CacheUpdateRequest struct {
	CacheType CacheType
	Key       string
	Operation OperationType
	Timestamp int64
}

type CacheUpdateResponse struct {
	Success bool
}

type CacheBroadcastServiceClient interface{}
