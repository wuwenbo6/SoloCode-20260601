package abtest

import (
	context "context"
	grpc "google.golang.org/grpc"
)

type Experiment struct {
	ExperimentId string
	Name         string
	Description  string
	Groups       []*Group
	Enabled      bool
	CreatedAt    int64
	UpdatedAt    int64
}

type Group struct {
	GroupId           string
	Name              string
	TrafficPercentage int32
	Variables         map[string]string
}

type GetUserGroupRequest struct {
	ExperimentId string
	UserId       int64
}

type GetUserGroupResponse struct {
	GroupId      string
	GroupName    string
	Variables    map[string]string
	InExperiment bool
}

type CreateExperimentRequest struct {
	Name        string
	Description string
	Groups      []*Group
}

type GetExperimentRequest struct {
	ExperimentId string
}

type ListExperimentsRequest struct {
	Page     int32
	PageSize int32
}

type ListExperimentsResponse struct {
	Experiments []*Experiment
	Total       int32
}

type RecordClickRequest struct {
	ExperimentId string
	UserId       int64
	GroupId      string
	ProductId    int64
	RequestId    int64
}

type RecordClickResponse struct {
	Success bool
}

type RecordImpressionRequest struct {
	ExperimentId string
	UserId       int64
	GroupId      string
	ProductIds   []int64
	RequestId    int64
}

type RecordImpressionResponse struct {
	Success bool
}

type GroupStats struct {
	GroupId     string
	GroupName   string
	Impressions int64
	Clicks      int64
	Ctr         float64
}

type GetExperimentStatsRequest struct {
	ExperimentId string
}

type GetExperimentStatsResponse struct {
	ExperimentId string
	GroupStats   []*GroupStats
	Timestamp    int64
}

type ABTestServiceServer interface {
	GetUserGroup(context.Context, *GetUserGroupRequest) (*GetUserGroupResponse, error)
	CreateExperiment(context.Context, *CreateExperimentRequest) (*Experiment, error)
	GetExperiment(context.Context, *GetExperimentRequest) (*Experiment, error)
	ListExperiments(context.Context, *ListExperimentsRequest) (*ListExperimentsResponse, error)
	RecordClick(context.Context, *RecordClickRequest) (*RecordClickResponse, error)
	RecordImpression(context.Context, *RecordImpressionRequest) (*RecordImpressionResponse, error)
	GetExperimentStats(context.Context, *GetExperimentStatsRequest) (*GetExperimentStatsResponse, error)
}

type UnimplementedABTestServiceServer struct{}

func (UnimplementedABTestServiceServer) GetUserGroup(context.Context, *GetUserGroupRequest) (*GetUserGroupResponse, error) {
	return nil, nil
}
func (UnimplementedABTestServiceServer) CreateExperiment(context.Context, *CreateExperimentRequest) (*Experiment, error) {
	return nil, nil
}
func (UnimplementedABTestServiceServer) GetExperiment(context.Context, *GetExperimentRequest) (*Experiment, error) {
	return nil, nil
}
func (UnimplementedABTestServiceServer) ListExperiments(context.Context, *ListExperimentsRequest) (*ListExperimentsResponse, error) {
	return nil, nil
}
func (UnimplementedABTestServiceServer) RecordClick(context.Context, *RecordClickRequest) (*RecordClickResponse, error) {
	return nil, nil
}
func (UnimplementedABTestServiceServer) RecordImpression(context.Context, *RecordImpressionRequest) (*RecordImpressionResponse, error) {
	return nil, nil
}
func (UnimplementedABTestServiceServer) GetExperimentStats(context.Context, *GetExperimentStatsRequest) (*GetExperimentStatsResponse, error) {
	return nil, nil
}

func RegisterABTestServiceServer(s *grpc.Server, srv ABTestServiceServer) {}

type ABTestServiceClient interface {
	GetUserGroup(context.Context, *GetUserGroupRequest, ...grpc.CallOption) (*GetUserGroupResponse, error)
	CreateExperiment(context.Context, *CreateExperimentRequest, ...grpc.CallOption) (*Experiment, error)
	GetExperiment(context.Context, *GetExperimentRequest, ...grpc.CallOption) (*Experiment, error)
	ListExperiments(context.Context, *ListExperimentsRequest, ...grpc.CallOption) (*ListExperimentsResponse, error)
	RecordClick(context.Context, *RecordClickRequest, ...grpc.CallOption) (*RecordClickResponse, error)
	RecordImpression(context.Context, *RecordImpressionRequest, ...grpc.CallOption) (*RecordImpressionResponse, error)
	GetExperimentStats(context.Context, *GetExperimentStatsRequest, ...grpc.CallOption) (*GetExperimentStatsResponse, error)
}

type abTestServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewABTestServiceClient(cc grpc.ClientConnInterface) ABTestServiceClient {
	return &abTestServiceClient{cc}
}

func (c *abTestServiceClient) GetUserGroup(ctx context.Context, in *GetUserGroupRequest, opts ...grpc.CallOption) (*GetUserGroupResponse, error) {
	out := new(GetUserGroupResponse)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/GetUserGroup", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *abTestServiceClient) CreateExperiment(ctx context.Context, in *CreateExperimentRequest, opts ...grpc.CallOption) (*Experiment, error) {
	out := new(Experiment)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/CreateExperiment", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *abTestServiceClient) GetExperiment(ctx context.Context, in *GetExperimentRequest, opts ...grpc.CallOption) (*Experiment, error) {
	out := new(Experiment)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/GetExperiment", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *abTestServiceClient) ListExperiments(ctx context.Context, in *ListExperimentsRequest, opts ...grpc.CallOption) (*ListExperimentsResponse, error) {
	out := new(ListExperimentsResponse)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/ListExperiments", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *abTestServiceClient) RecordClick(ctx context.Context, in *RecordClickRequest, opts ...grpc.CallOption) (*RecordClickResponse, error) {
	out := new(RecordClickResponse)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/RecordClick", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *abTestServiceClient) RecordImpression(ctx context.Context, in *RecordImpressionRequest, opts ...grpc.CallOption) (*RecordImpressionResponse, error) {
	out := new(RecordImpressionResponse)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/RecordImpression", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *abTestServiceClient) GetExperimentStats(ctx context.Context, in *GetExperimentStatsRequest, opts ...grpc.CallOption) (*GetExperimentStatsResponse, error) {
	out := new(GetExperimentStatsResponse)
	err := c.cc.Invoke(ctx, "/abtest.ABTestService/GetExperimentStats", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}
