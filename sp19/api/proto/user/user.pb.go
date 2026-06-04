package user

import (
	context "context"
	grpc "google.golang.org/grpc"
)

type User struct {
	UserId    int64
	Username  string
	Email     string
	CreatedAt int64
	UpdatedAt int64
}

type GetUserRequest struct {
	UserId int64
}

type CreateUserRequest struct {
	Username string
	Email    string
}

type UpdateUserRequest struct {
	UserId   int64
	Username string
	Email    string
}

type DeleteUserRequest struct {
	UserId int64
}

type DeleteUserResponse struct {
	Success bool
}

type BrowseHistoryRequest struct {
	UserId    int64
	ProductId int64
}

type BrowseHistoryResponse struct {
	Success bool
}

type GetBrowseHistoryRequest struct {
	UserId int64
	Limit  int32
}

type GetBrowseHistoryResponse struct {
	ProductIds []int64
}

type UserServiceServer interface {
	GetUser(context.Context, *GetUserRequest) (*User, error)
	CreateUser(context.Context, *CreateUserRequest) (*User, error)
	UpdateUser(context.Context, *UpdateUserRequest) (*User, error)
	DeleteUser(context.Context, *DeleteUserRequest) (*DeleteUserResponse, error)
	RecordBrowseHistory(context.Context, *BrowseHistoryRequest) (*BrowseHistoryResponse, error)
	GetBrowseHistory(context.Context, *GetBrowseHistoryRequest) (*GetBrowseHistoryResponse, error)
}

type UnimplementedUserServiceServer struct{}

func (UnimplementedUserServiceServer) GetUser(context.Context, *GetUserRequest) (*User, error) {
	return nil, nil
}
func (UnimplementedUserServiceServer) CreateUser(context.Context, *CreateUserRequest) (*User, error) {
	return nil, nil
}
func (UnimplementedUserServiceServer) UpdateUser(context.Context, *UpdateUserRequest) (*User, error) {
	return nil, nil
}
func (UnimplementedUserServiceServer) DeleteUser(context.Context, *DeleteUserRequest) (*DeleteUserResponse, error) {
	return nil, nil
}
func (UnimplementedUserServiceServer) RecordBrowseHistory(context.Context, *BrowseHistoryRequest) (*BrowseHistoryResponse, error) {
	return nil, nil
}
func (UnimplementedUserServiceServer) GetBrowseHistory(context.Context, *GetBrowseHistoryRequest) (*GetBrowseHistoryResponse, error) {
	return nil, nil
}

func RegisterUserServiceServer(s *grpc.Server, srv UserServiceServer) {}

type UserServiceClient interface {
	GetUser(context.Context, *GetUserRequest, ...grpc.CallOption) (*User, error)
	CreateUser(context.Context, *CreateUserRequest, ...grpc.CallOption) (*User, error)
	UpdateUser(context.Context, *UpdateUserRequest, ...grpc.CallOption) (*User, error)
	DeleteUser(context.Context, *DeleteUserRequest, ...grpc.CallOption) (*DeleteUserResponse, error)
	RecordBrowseHistory(context.Context, *BrowseHistoryRequest, ...grpc.CallOption) (*BrowseHistoryResponse, error)
	GetBrowseHistory(context.Context, *GetBrowseHistoryRequest, ...grpc.CallOption) (*GetBrowseHistoryResponse, error)
}

type userServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewUserServiceClient(cc grpc.ClientConnInterface) UserServiceClient {
	return &userServiceClient{cc}
}

func (c *userServiceClient) GetUser(ctx context.Context, in *GetUserRequest, opts ...grpc.CallOption) (*User, error) {
	out := new(User)
	err := c.cc.Invoke(ctx, "/user.UserService/GetUser", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) CreateUser(ctx context.Context, in *CreateUserRequest, opts ...grpc.CallOption) (*User, error) {
	out := new(User)
	err := c.cc.Invoke(ctx, "/user.UserService/CreateUser", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) UpdateUser(ctx context.Context, in *UpdateUserRequest, opts ...grpc.CallOption) (*User, error) {
	out := new(User)
	err := c.cc.Invoke(ctx, "/user.UserService/UpdateUser", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) DeleteUser(ctx context.Context, in *DeleteUserRequest, opts ...grpc.CallOption) (*DeleteUserResponse, error) {
	out := new(DeleteUserResponse)
	err := c.cc.Invoke(ctx, "/user.UserService/DeleteUser", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) RecordBrowseHistory(ctx context.Context, in *BrowseHistoryRequest, opts ...grpc.CallOption) (*BrowseHistoryResponse, error) {
	out := new(BrowseHistoryResponse)
	err := c.cc.Invoke(ctx, "/user.UserService/RecordBrowseHistory", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) GetBrowseHistory(ctx context.Context, in *GetBrowseHistoryRequest, opts ...grpc.CallOption) (*GetBrowseHistoryResponse, error) {
	out := new(GetBrowseHistoryResponse)
	err := c.cc.Invoke(ctx, "/user.UserService/GetBrowseHistory", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}
