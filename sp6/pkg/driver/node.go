package driver

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/container-storage-interface/spec/lib/go/csi"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/klog/v2"
)

type nodeServer struct {
	csi.UnimplementedNodeServer
	driver *Driver
}

func registerNodeServer(s *grpc.Server, d *Driver) {
	csi.RegisterNodeServer(s, &nodeServer{driver: d})
}

func (ns *nodeServer) NodeStageVolume(ctx context.Context, req *csi.NodeStageVolumeRequest) (*csi.NodeStageVolumeResponse, error) {
	return &csi.NodeStageVolumeResponse{}, nil
}

func (ns *nodeServer) NodeUnstageVolume(ctx context.Context, req *csi.NodeUnstageVolumeRequest) (*csi.NodeUnstageVolumeResponse, error) {
	return &csi.NodeUnstageVolumeResponse{}, nil
}

func (ns *nodeServer) NodePublishVolume(ctx context.Context, req *csi.NodePublishVolumeRequest) (*csi.NodePublishVolumeResponse, error) {
	if req.VolumeId == "" {
		return nil, status.Error(codes.InvalidArgument, "Volume ID must be provided")
	}
	if req.TargetPath == "" {
		return nil, status.Error(codes.InvalidArgument, "Target path must be provided")
	}

	if err := os.MkdirAll(req.TargetPath, 0755); err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to create target path %s: %v", req.TargetPath, err)
	}

	dataPath := filepath.Join(req.TargetPath, "mock-data")
	if err := os.MkdirAll(dataPath, 0755); err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to create data path: %v", err)
	}

	readmePath := filepath.Join(req.TargetPath, "README.txt")
	content := fmt.Sprintf("Mock CSI Volume\nVolume ID: %s\nNode ID: %s\nCreated at: %s\n",
		req.VolumeId, ns.driver.options.NodeID, req.TargetPath)
	if err := os.WriteFile(readmePath, []byte(content), 0644); err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to write README: %v", err)
	}

	klog.Infof("Published volume %s to %s", req.VolumeId, req.TargetPath)
	return &csi.NodePublishVolumeResponse{}, nil
}

func (ns *nodeServer) NodeUnpublishVolume(ctx context.Context, req *csi.NodeUnpublishVolumeRequest) (*csi.NodeUnpublishVolumeResponse, error) {
	if req.VolumeId == "" {
		return nil, status.Error(codes.InvalidArgument, "Volume ID must be provided")
	}
	if req.TargetPath == "" {
		return nil, status.Error(codes.InvalidArgument, "Target path must be provided")
	}

	if err := os.RemoveAll(req.TargetPath); err != nil {
		klog.Warningf("Failed to remove target path %s: %v", req.TargetPath, err)
	}

	klog.Infof("Unpublished volume %s from %s", req.VolumeId, req.TargetPath)
	return &csi.NodeUnpublishVolumeResponse{}, nil
}

func (ns *nodeServer) NodeGetVolumeStats(ctx context.Context, req *csi.NodeGetVolumeStatsRequest) (*csi.NodeGetVolumeStatsResponse, error) {
	if req.VolumeId == "" {
		return nil, status.Error(codes.InvalidArgument, "Volume ID must be provided")
	}

	vol := ns.driver.store.GetVolume(req.VolumeId)
	if vol == nil {
		return nil, status.Errorf(codes.NotFound, "Volume %s not found", req.VolumeId)
	}

	return &csi.NodeGetVolumeStatsResponse{
		Usage: []*csi.VolumeUsage{
			{
				Available: vol.SizeBytes,
				Total:     vol.SizeBytes,
				Used:      0,
				Unit:      csi.VolumeUsage_BYTES,
			},
		},
	}, nil
}

func (ns *nodeServer) NodeGetCapabilities(ctx context.Context, req *csi.NodeGetCapabilitiesRequest) (*csi.NodeGetCapabilitiesResponse, error) {
	return &csi.NodeGetCapabilitiesResponse{
		Capabilities: []*csi.NodeServiceCapability{
			{Type: &csi.NodeServiceCapability_Rpc{Rpc: &csi.NodeServiceCapability_RPC{Type: csi.NodeServiceCapability_RPC_STAGE_UNSTAGE_VOLUME}}},
			{Type: &csi.NodeServiceCapability_Rpc{Rpc: &csi.NodeServiceCapability_RPC{Type: csi.NodeServiceCapability_RPC_GET_VOLUME_STATS}}},
		},
	}, nil
}

func (ns *nodeServer) NodeGetInfo(ctx context.Context, req *csi.NodeGetInfoRequest) (*csi.NodeGetInfoResponse, error) {
	return &csi.NodeGetInfoResponse{
		NodeId:             ns.driver.options.NodeID,
		MaxVolumesPerNode:  ns.driver.options.MaxVolumes,
		AccessibleTopology: &csi.Topology{Segments: map[string]string{"topology.csi.mock/zone": "default"}},
	}, nil
}

func (ns *nodeServer) NodeExpandVolume(ctx context.Context, req *csi.NodeExpandVolumeRequest) (*csi.NodeExpandVolumeResponse, error) {
	return &csi.NodeExpandVolumeResponse{CapacityBytes: req.CapacityRange.GetRequiredBytes()}, nil
}
