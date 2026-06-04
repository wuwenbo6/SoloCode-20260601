package grpcpool

import (
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

func NewClientConn(target string) (*grpc.ClientConn, error) {
	return NewClientConnWithConfig(target, 10*time.Second, 3*time.Second)
}

func NewClientConnWithConfig(target string, keepaliveTime, keepaliveTimeout time.Duration) (*grpc.ClientConn, error) {
	kaParams := keepalive.ClientParameters{
		Time:                keepaliveTime,
		Timeout:             keepaliveTimeout,
		PermitWithoutStream: true,
	}

	conn, err := grpc.Dial(
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithKeepaliveParams(kaParams),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(4*1024*1024),
			grpc.MaxCallSendMsgSize(4*1024*1024),
		),
	)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

func ServerOptions() []grpc.ServerOption {
	kaParams := keepalive.ServerParameters{
		MaxConnectionIdle:     30 * time.Second,
		MaxConnectionAge:      5 * time.Minute,
		MaxConnectionAgeGrace: 10 * time.Second,
		Time:                  10 * time.Second,
		Timeout:               3 * time.Second,
	}

	kaEnforcement := keepalive.EnforcementPolicy{
		MinTime:             5 * time.Second,
		PermitWithoutStream: true,
	}

	return []grpc.ServerOption{
		grpc.KeepaliveParams(kaParams),
		grpc.KeepaliveEnforcementPolicy(kaEnforcement),
		grpc.MaxRecvMsgSize(4 * 1024 * 1024),
		grpc.MaxSendMsgSize(4 * 1024 * 1024),
	}
}
