package recommendation

import (
	context "context"
	grpc "google.golang.org/grpc"
	product "recommendation-system/api/proto/product"
)

type GetRecommendationsRequest struct {
	UserId    int64
	Limit     int32
	Algorithm string
}

type RecommendedProduct struct {
	Product *product.Product
	Reason  string
	Score   float64
}

type GetRecommendationsResponse struct {
	Recommendations  []*RecommendedProduct
	AlgorithmUsed    string
	ExperimentGroup  string
	RequestId        int64
	IsFallback       bool
}

type StreamRecommendationsRequest struct {
	UserId int64
	Limit  int32
}

type RecordClickRequest struct {
	UserId    int64
	ProductId int64
	RequestId int64
}

type RecordClickResponse struct {
	Success bool
}

type RecommendationServiceServer interface {
	GetRecommendations(context.Context, *GetRecommendationsRequest) (*GetRecommendationsResponse, error)
	StreamRecommendations(*StreamRecommendationsRequest, RecommendationService_StreamRecommendationsServer) error
	RecordClick(context.Context, *RecordClickRequest) (*RecordClickResponse, error)
}

type RecommendationService_StreamRecommendationsServer interface {
	Send(*GetRecommendationsResponse) error
	grpc.ServerStream
}

type UnimplementedRecommendationServiceServer struct{}

func (UnimplementedRecommendationServiceServer) GetRecommendations(context.Context, *GetRecommendationsRequest) (*GetRecommendationsResponse, error) {
	return nil, nil
}
func (UnimplementedRecommendationServiceServer) StreamRecommendations(*StreamRecommendationsRequest, RecommendationService_StreamRecommendationsServer) error {
	return nil
}
func (UnimplementedRecommendationServiceServer) RecordClick(context.Context, *RecordClickRequest) (*RecordClickResponse, error) {
	return nil, nil
}

func RegisterRecommendationServiceServer(s *grpc.Server, srv RecommendationServiceServer) {}

type RecommendationServiceClient interface {
	GetRecommendations(context.Context, *GetRecommendationsRequest, ...grpc.CallOption) (*GetRecommendationsResponse, error)
	StreamRecommendations(context.Context, *StreamRecommendationsRequest, ...grpc.CallOption) (RecommendationService_StreamRecommendationsClient, error)
	RecordClick(context.Context, *RecordClickRequest, ...grpc.CallOption) (*RecordClickResponse, error)
}

type RecommendationService_StreamRecommendationsClient interface {
	Recv() (*GetRecommendationsResponse, error)
	grpc.ClientStream
}

type recommendationServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewRecommendationServiceClient(cc grpc.ClientConnInterface) RecommendationServiceClient {
	return &recommendationServiceClient{cc}
}

func (c *recommendationServiceClient) GetRecommendations(ctx context.Context, in *GetRecommendationsRequest, opts ...grpc.CallOption) (*GetRecommendationsResponse, error) {
	out := new(GetRecommendationsResponse)
	err := c.cc.Invoke(ctx, "/recommendation.RecommendationService/GetRecommendations", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *recommendationServiceClient) StreamRecommendations(ctx context.Context, in *StreamRecommendationsRequest, opts ...grpc.CallOption) (RecommendationService_StreamRecommendationsClient, error) {
	stream, err := c.cc.NewStream(ctx, desc_RecommendationService_StreamRecommendations, "/recommendation.RecommendationService/StreamRecommendations", opts...)
	if err != nil {
		return nil, err
	}
	if err := stream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := stream.CloseSend(); err != nil {
		return nil, err
	}
	return &recommendationServiceStream{stream}, nil
}

func (c *recommendationServiceClient) RecordClick(ctx context.Context, in *RecordClickRequest, opts ...grpc.CallOption) (*RecordClickResponse, error) {
	out := new(RecordClickResponse)
	err := c.cc.Invoke(ctx, "/recommendation.RecommendationService/RecordClick", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

type recommendationServiceStream struct {
	grpc.ClientStream
}

func (x *recommendationServiceStream) Recv() (*GetRecommendationsResponse, error) {
	m := new(GetRecommendationsResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

var desc_RecommendationService_StreamRecommendations = &grpc.StreamDesc{
	StreamName:    "StreamRecommendations",
	ServerStreams: true,
	ClientStreams: false,
}
