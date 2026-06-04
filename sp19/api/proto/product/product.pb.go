package product

import (
	context "context"
	grpc "google.golang.org/grpc"
)

type Product struct {
	ProductId   int64
	Name        string
	Description string
	Price       float64
	Category    string
	ViewCount   int64
	HotScore    float64
	CreatedAt   int64
	UpdatedAt   int64
}

type GetProductRequest struct {
	ProductId int64
}

type ListProductsRequest struct {
	Page     int32
	PageSize int32
	Category string
}

type ListProductsResponse struct {
	Products []*Product
	Total    int32
}

type CreateProductRequest struct {
	Name        string
	Description string
	Price       float64
	Category    string
}

type UpdateProductRequest struct {
	ProductId   int64
	Name        string
	Description string
	Price       float64
	Category    string
}

type DeleteProductRequest struct {
	ProductId int64
}

type DeleteProductResponse struct {
	Success bool
}

type GetHotProductsRequest struct {
	Limit    int32
	Category string
}

type GetHotProductsResponse struct {
	Products []*Product
}

type IncrementViewCountRequest struct {
	ProductId int64
}

type IncrementViewCountResponse struct {
	Success bool
}

type GetProductsRequest struct {
	ProductIds []int64
}

type GetProductsResponse struct {
	Products []*Product
}

type ProductServiceServer interface {
	GetProduct(context.Context, *GetProductRequest) (*Product, error)
	ListProducts(context.Context, *ListProductsRequest) (*ListProductsResponse, error)
	CreateProduct(context.Context, *CreateProductRequest) (*Product, error)
	UpdateProduct(context.Context, *UpdateProductRequest) (*Product, error)
	DeleteProduct(context.Context, *DeleteProductRequest) (*DeleteProductResponse, error)
	GetHotProducts(context.Context, *GetHotProductsRequest) (*GetHotProductsResponse, error)
	IncrementViewCount(context.Context, *IncrementViewCountRequest) (*IncrementViewCountResponse, error)
	GetProducts(context.Context, *GetProductsRequest) (*GetProductsResponse, error)
}

type UnimplementedProductServiceServer struct{}

func (UnimplementedProductServiceServer) GetProduct(context.Context, *GetProductRequest) (*Product, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) ListProducts(context.Context, *ListProductsRequest) (*ListProductsResponse, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) CreateProduct(context.Context, *CreateProductRequest) (*Product, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) UpdateProduct(context.Context, *UpdateProductRequest) (*Product, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) DeleteProduct(context.Context, *DeleteProductRequest) (*DeleteProductResponse, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) GetHotProducts(context.Context, *GetHotProductsRequest) (*GetHotProductsResponse, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) IncrementViewCount(context.Context, *IncrementViewCountRequest) (*IncrementViewCountResponse, error) {
	return nil, nil
}
func (UnimplementedProductServiceServer) GetProducts(context.Context, *GetProductsRequest) (*GetProductsResponse, error) {
	return nil, nil
}

func RegisterProductServiceServer(s *grpc.Server, srv ProductServiceServer) {}

type ProductServiceClient interface {
	GetProduct(context.Context, *GetProductRequest, ...grpc.CallOption) (*Product, error)
	ListProducts(context.Context, *ListProductsRequest, ...grpc.CallOption) (*ListProductsResponse, error)
	CreateProduct(context.Context, *CreateProductRequest, ...grpc.CallOption) (*Product, error)
	UpdateProduct(context.Context, *UpdateProductRequest, ...grpc.CallOption) (*Product, error)
	DeleteProduct(context.Context, *DeleteProductRequest, ...grpc.CallOption) (*DeleteProductResponse, error)
	GetHotProducts(context.Context, *GetHotProductsRequest, ...grpc.CallOption) (*GetHotProductsResponse, error)
	IncrementViewCount(context.Context, *IncrementViewCountRequest, ...grpc.CallOption) (*IncrementViewCountResponse, error)
	GetProducts(context.Context, *GetProductsRequest, ...grpc.CallOption) (*GetProductsResponse, error)
}

type productServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewProductServiceClient(cc grpc.ClientConnInterface) ProductServiceClient {
	return &productServiceClient{cc}
}

func (c *productServiceClient) GetProduct(ctx context.Context, in *GetProductRequest, opts ...grpc.CallOption) (*Product, error) {
	out := new(Product)
	err := c.cc.Invoke(ctx, "/product.ProductService/GetProduct", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) ListProducts(ctx context.Context, in *ListProductsRequest, opts ...grpc.CallOption) (*ListProductsResponse, error) {
	out := new(ListProductsResponse)
	err := c.cc.Invoke(ctx, "/product.ProductService/ListProducts", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) CreateProduct(ctx context.Context, in *CreateProductRequest, opts ...grpc.CallOption) (*Product, error) {
	out := new(Product)
	err := c.cc.Invoke(ctx, "/product.ProductService/CreateProduct", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) UpdateProduct(ctx context.Context, in *UpdateProductRequest, opts ...grpc.CallOption) (*Product, error) {
	out := new(Product)
	err := c.cc.Invoke(ctx, "/product.ProductService/UpdateProduct", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) DeleteProduct(ctx context.Context, in *DeleteProductRequest, opts ...grpc.CallOption) (*DeleteProductResponse, error) {
	out := new(DeleteProductResponse)
	err := c.cc.Invoke(ctx, "/product.ProductService/DeleteProduct", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) GetHotProducts(ctx context.Context, in *GetHotProductsRequest, opts ...grpc.CallOption) (*GetHotProductsResponse, error) {
	out := new(GetHotProductsResponse)
	err := c.cc.Invoke(ctx, "/product.ProductService/GetHotProducts", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) IncrementViewCount(ctx context.Context, in *IncrementViewCountRequest, opts ...grpc.CallOption) (*IncrementViewCountResponse, error) {
	out := new(IncrementViewCountResponse)
	err := c.cc.Invoke(ctx, "/product.ProductService/IncrementViewCount", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *productServiceClient) GetProducts(ctx context.Context, in *GetProductsRequest, opts ...grpc.CallOption) (*GetProductsResponse, error) {
	out := new(GetProductsResponse)
	err := c.cc.Invoke(ctx, "/product.ProductService/GetProducts", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}
