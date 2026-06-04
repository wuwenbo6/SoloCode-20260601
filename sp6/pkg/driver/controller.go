package driver

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/container-storage-interface/spec/lib/go/csi"
	"github.com/csi-mock-driver/pkg/store"
	"github.com/golang/protobuf/ptypes"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/klog/v2"
)

type controllerServer struct {
	csi.UnimplementedControllerServer
	driver *Driver
}

func registerControllerServer(s *grpc.Server, d *Driver) {
	csi.RegisterControllerServer(s, &controllerServer{driver: d})
}

func (cs *controllerServer) CreateVolume(ctx context.Context, req *csi.CreateVolumeRequest) (*csi.CreateVolumeResponse, error) {
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "Volume name must be provided")
	}

	capacityBytes := req.CapacityRange.GetRequiredBytes()
	if capacityBytes == 0 {
		capacityBytes = req.CapacityRange.GetLimitBytes()
	}
	if capacityBytes == 0 {
		capacityBytes = 1 * 1024 * 1024 * 1024
	}

	existingVol := cs.driver.store.GetVolumeByName(req.Name)
	if existingVol != nil {
		if existingVol.SizeBytes < capacityBytes {
			return nil, status.Errorf(codes.AlreadyExists,
				"Volume with name %s exists but with smaller size %d < %d",
				req.Name, existingVol.SizeBytes, capacityBytes)
		}
		return &csi.CreateVolumeResponse{
			Volume: &csi.Volume{
				VolumeId:           existingVol.ID,
				CapacityBytes:      existingVol.SizeBytes,
				VolumeContext:      map[string]string{},
				ContentSource:      getVolumeContentSource(existingVol.ContentSource),
				AccessibleTopology: []*csi.Topology{{Segments: map[string]string{"topology.csi.mock/zone": "default"}}},
			},
		}, nil
	}

	volID := generateVolumeID(req.Name)

	var contentSource *store.VolumeContentSource
	if req.VolumeContentSource != nil {
		if snapSource := req.VolumeContentSource.GetSnapshot(); snapSource != nil {
			snap := cs.driver.store.GetSnapshot(snapSource.SnapshotId)
			if snap == nil {
				return nil, status.Errorf(codes.NotFound, "Snapshot %s not found", snapSource.SnapshotId)
			}

			valid, storedChecksum, currentChecksum := cs.driver.store.VerifySnapshotChecksum(snapSource.SnapshotId)
			if !valid {
				klog.Warningf("Snapshot checksum mismatch! Stored: %s, Current: %s", storedChecksum, currentChecksum)
				return nil, status.Errorf(codes.DataLoss,
					"Snapshot checksum verification failed: stored=%s, current=%s",
					storedChecksum, currentChecksum)
			}
			klog.Infof("Snapshot checksum verified successfully: %s", storedChecksum)

			contentSource = &store.VolumeContentSource{
				SnapshotID: snapSource.SnapshotId,
			}
			if capacityBytes < snap.SizeBytes {
				capacityBytes = snap.SizeBytes
			}
		} else if volSource := req.VolumeContentSource.GetVolume(); volSource != nil {
			sourceVol := cs.driver.store.GetVolume(volSource.VolumeId)
			if sourceVol == nil {
				return nil, status.Errorf(codes.NotFound, "Source volume %s not found", volSource.VolumeId)
			}
			klog.Infof("Cloning volume from source: %s", volSource.VolumeId)

			contentSource = &store.VolumeContentSource{
				VolumeCloneID: volSource.VolumeId,
			}
			if capacityBytes < sourceVol.SizeBytes {
				capacityBytes = sourceVol.SizeBytes
			}
		}
	}

	vol := cs.driver.store.CreateVolume(volID, req.Name, capacityBytes, contentSource)

	if contentSource != nil {
		if contentSource.SnapshotID != "" {
			klog.Infof("Restoring volume from snapshot chain, snapshot ID: %s", contentSource.SnapshotID)
			cs.driver.store.RestoreVolumeFromSnapshotChain(volID, contentSource.SnapshotID)
		} else if contentSource.VolumeCloneID != "" {
			klog.Infof("Cloning volume from source volume: %s", contentSource.VolumeCloneID)
			_, err := cs.driver.store.CloneVolume(contentSource.VolumeCloneID, volID, req.Name)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "Failed to clone volume: %v", err)
			}
			vol = cs.driver.store.GetVolume(volID)
		}
	}

	contentSourceType := "none"
	if contentSource != nil {
		if contentSource.SnapshotID != "" {
			contentSourceType = "snapshot:" + contentSource.SnapshotID
		} else if contentSource.VolumeCloneID != "" {
			contentSourceType = "clone:" + contentSource.VolumeCloneID
		}
	}
	klog.Infof("Created volume %s (ID: %s) with size %d bytes, content source: %s",
		vol.Name, vol.ID, vol.SizeBytes, contentSourceType)

	return &csi.CreateVolumeResponse{
		Volume: &csi.Volume{
			VolumeId:           vol.ID,
			CapacityBytes:      vol.SizeBytes,
			VolumeContext:      map[string]string{},
			ContentSource:      getVolumeContentSource(vol.ContentSource),
			AccessibleTopology: []*csi.Topology{{Segments: map[string]string{"topology.csi.mock/zone": "default"}}},
		},
	}, nil
}

func (cs *controllerServer) DeleteVolume(ctx context.Context, req *csi.DeleteVolumeRequest) (*csi.DeleteVolumeResponse, error) {
	if req.VolumeId == "" {
		return nil, status.Error(codes.InvalidArgument, "Volume ID must be provided")
	}

	if !cs.driver.store.DeleteVolume(req.VolumeId) {
		klog.Warningf("Volume %s not found for deletion", req.VolumeId)
	}

	klog.Infof("Deleted volume %s", req.VolumeId)
	return &csi.DeleteVolumeResponse{}, nil
}

func (cs *controllerServer) CreateSnapshot(ctx context.Context, req *csi.CreateSnapshotRequest) (*csi.CreateSnapshotResponse, error) {
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "Snapshot name must be provided")
	}
	if req.SourceVolumeId == "" {
		return nil, status.Error(codes.InvalidArgument, "Source volume ID must be provided")
	}

	existingSnap := cs.driver.store.GetSnapshotByName(req.Name)
	if existingSnap != nil {
		if existingSnap.SourceVolumeID != req.SourceVolumeId {
			return nil, status.Errorf(codes.AlreadyExists,
				"Snapshot %s exists but from different volume", req.Name)
		}

		valid, _, _ := cs.driver.store.VerifySnapshotChecksum(existingSnap.ID)
		klog.Infof("Existing snapshot checksum verified: valid=%v", valid)

		ct, _ := ptypes.TimestampProto(existingSnap.CreationTime)
		return &csi.CreateSnapshotResponse{
			Snapshot: &csi.Snapshot{
				SnapshotId:     existingSnap.ID,
				SourceVolumeId: existingSnap.SourceVolumeID,
				SizeBytes:      existingSnap.SizeBytes,
				CreationTime:   ct,
				ReadyToUse:     existingSnap.ReadyToUse,
			},
		}, nil
	}

	vol := cs.driver.store.GetVolume(req.SourceVolumeId)
	if vol == nil {
		return nil, status.Errorf(codes.NotFound, "Source volume %s not found", req.SourceVolumeId)
	}

	snapID := generateSnapshotID(req.Name)
	sizeBytes := vol.SizeBytes

	parentSnapshotID := req.Parameters["parent-snapshot-id"]
	var snap *store.Snapshot

	if parentSnapshotID != "" {
		klog.Infof("Creating incremental snapshot based on parent: %s", parentSnapshotID)
		snap = cs.driver.store.CreateIncrementalSnapshot(snapID, req.Name, req.SourceVolumeId, parentSnapshotID, sizeBytes)
		if snap == nil {
			return nil, status.Errorf(codes.NotFound, "Parent snapshot %s not found or volume not found", parentSnapshotID)
		}
		changedCount := snap.ChangedBitmap.Count()
		klog.Infof("Incremental snapshot %s created: %d changed blocks (%.2f%%)",
			snap.ID, changedCount, float64(changedCount)/float64(snap.BlockCount)*100)
	} else {
		klog.Infof("Creating full snapshot")
		snap = cs.driver.store.CreateFullSnapshot(snapID, req.Name, req.SourceVolumeId, sizeBytes)
		if snap == nil {
			return nil, status.Errorf(codes.Internal, "Failed to create full snapshot")
		}
		klog.Infof("Full snapshot %s created: %d blocks", snap.ID, snap.BlockCount)
	}

	klog.Infof("Snapshot checksum: %s", snap.Checksum)

	ct, _ := ptypes.TimestampProto(snap.CreationTime)
	return &csi.CreateSnapshotResponse{
		Snapshot: &csi.Snapshot{
			SnapshotId:     snap.ID,
			SourceVolumeId: snap.SourceVolumeID,
			SizeBytes:      snap.SizeBytes,
			CreationTime:   ct,
			ReadyToUse:     snap.ReadyToUse,
		},
	}, nil
}

func (cs *controllerServer) DeleteSnapshot(ctx context.Context, req *csi.DeleteSnapshotRequest) (*csi.DeleteSnapshotResponse, error) {
	if req.SnapshotId == "" {
		return nil, status.Error(codes.InvalidArgument, "Snapshot ID must be provided")
	}

	snap := cs.driver.store.GetSnapshot(req.SnapshotId)
	if snap != nil {
		if len(snap.ChildIDs) > 0 {
			klog.Warningf("Snapshot %s has %d children, deleting will break the chain",
				req.SnapshotId, len(snap.ChildIDs))
		}
	}

	if !cs.driver.store.DeleteSnapshot(req.SnapshotId) {
		klog.Warningf("Snapshot %s not found for deletion", req.SnapshotId)
	}

	klog.Infof("Deleted snapshot %s", req.SnapshotId)
	return &csi.DeleteSnapshotResponse{}, nil
}

func (cs *controllerServer) ListSnapshots(ctx context.Context, req *csi.ListSnapshotsRequest) (*csi.ListSnapshotsResponse, error) {
	var snapshots []*csi.Snapshot

	if req.SnapshotId != "" {
		snap := cs.driver.store.GetSnapshot(req.SnapshotId)
		if snap != nil {
			ct, _ := ptypes.TimestampProto(snap.CreationTime)
			snapshots = append(snapshots, &csi.Snapshot{
				SnapshotId:     snap.ID,
				SourceVolumeId: snap.SourceVolumeID,
				SizeBytes:      snap.SizeBytes,
				CreationTime:   ct,
				ReadyToUse:     snap.ReadyToUse,
			})
		}
	} else {
		for _, snap := range cs.driver.store.ListSnapshots() {
			ct, _ := ptypes.TimestampProto(snap.CreationTime)
			snapshots = append(snapshots, &csi.Snapshot{
				SnapshotId:     snap.ID,
				SourceVolumeId: snap.SourceVolumeID,
				SizeBytes:      snap.SizeBytes,
				CreationTime:   ct,
				ReadyToUse:     snap.ReadyToUse,
			})
		}
	}

	return &csi.ListSnapshotsResponse{
		Entries:   snapshotsToEntries(snapshots),
		NextToken: "",
	}, nil
}

func (cs *controllerServer) ControllerGetCapabilities(ctx context.Context, req *csi.ControllerGetCapabilitiesRequest) (*csi.ControllerGetCapabilitiesResponse, error) {
	return &csi.ControllerGetCapabilitiesResponse{
		Capabilities: []*csi.ControllerServiceCapability{
			{Type: &csi.ControllerServiceCapability_Rpc{Rpc: &csi.ControllerServiceCapability_RPC{Type: csi.ControllerServiceCapability_RPC_CREATE_DELETE_VOLUME}}},
			{Type: &csi.ControllerServiceCapability_Rpc{Rpc: &csi.ControllerServiceCapability_RPC{Type: csi.ControllerServiceCapability_RPC_CREATE_DELETE_SNAPSHOT}}},
			{Type: &csi.ControllerServiceCapability_Rpc{Rpc: &csi.ControllerServiceCapability_RPC{Type: csi.ControllerServiceCapability_RPC_LIST_SNAPSHOTS}}},
			{Type: &csi.ControllerServiceCapability_Rpc{Rpc: &csi.ControllerServiceCapability_RPC{Type: csi.ControllerServiceCapability_RPC_PUBLISH_UNPUBLISH_VOLUME}}},
			{Type: &csi.ControllerServiceCapability_Rpc{Rpc: &csi.ControllerServiceCapability_RPC{Type: csi.ControllerServiceCapability_RPC_CLONE_VOLUME}}},
		},
	}, nil
}

func (cs *controllerServer) ControllerPublishVolume(ctx context.Context, req *csi.ControllerPublishVolumeRequest) (*csi.ControllerPublishVolumeResponse, error) {
	return &csi.ControllerPublishVolumeResponse{PublishContext: map[string]string{}}, nil
}

func (cs *controllerServer) ControllerUnpublishVolume(ctx context.Context, req *csi.ControllerUnpublishVolumeRequest) (*csi.ControllerUnpublishVolumeResponse, error) {
	return &csi.ControllerUnpublishVolumeResponse{}, nil
}

func (cs *controllerServer) ValidateVolumeCapabilities(ctx context.Context, req *csi.ValidateVolumeCapabilitiesRequest) (*csi.ValidateVolumeCapabilitiesResponse, error) {
	confirmed := make([]*csi.VolumeCapability, 0, len(req.VolumeCapabilities))
	for _, cap := range req.VolumeCapabilities {
		if cap.GetAccessMode() != nil {
			confirmed = append(confirmed, cap)
		}
	}
	return &csi.ValidateVolumeCapabilitiesResponse{Confirmed: &csi.ValidateVolumeCapabilitiesResponse_Confirmed{VolumeCapabilities: confirmed}}, nil
}

func (cs *controllerServer) ListVolumes(ctx context.Context, req *csi.ListVolumesRequest) (*csi.ListVolumesResponse, error) {
	var volumes []*csi.ListVolumesResponse_Entry
	for _, vol := range cs.driver.store.ListVolumes() {
		volumes = append(volumes, &csi.ListVolumesResponse_Entry{
			Volume: &csi.Volume{
				VolumeId:      vol.ID,
				CapacityBytes: vol.SizeBytes,
				VolumeContext: map[string]string{},
				ContentSource: getVolumeContentSource(vol.ContentSource),
			},
		})
	}
	return &csi.ListVolumesResponse{Entries: volumes, NextToken: ""}, nil
}

func (cs *controllerServer) ControllerGetVolume(ctx context.Context, req *csi.ControllerGetVolumeRequest) (*csi.ControllerGetVolumeResponse, error) {
	vol := cs.driver.store.GetVolume(req.VolumeId)
	if vol == nil {
		return nil, status.Errorf(codes.NotFound, "Volume %s not found", req.VolumeId)
	}
	return &csi.ControllerGetVolumeResponse{
		Volume: &csi.Volume{
			VolumeId:      vol.ID,
			CapacityBytes: vol.SizeBytes,
			VolumeContext: map[string]string{},
			ContentSource: getVolumeContentSource(vol.ContentSource),
		},
	}, nil
}

func generateVolumeID(name string) string {
	hash := sha256.Sum256([]byte(name + time.Now().String()))
	return "vol-" + hex.EncodeToString(hash[:])[:12]
}

func generateSnapshotID(name string) string {
	hash := sha256.Sum256([]byte(name + time.Now().String()))
	return "snap-" + hex.EncodeToString(hash[:])[:12]
}

func getVolumeContentSource(source *store.VolumeContentSource) *csi.VolumeContentSource {
	if source == nil {
		return nil
	}
	if source.SnapshotID != "" {
		return &csi.VolumeContentSource{
			Type: &csi.VolumeContentSource_Snapshot{
				Snapshot: &csi.VolumeContentSource_SnapshotSource{
					SnapshotId: source.SnapshotID,
				},
			},
		}
	}
	if source.VolumeCloneID != "" {
		return &csi.VolumeContentSource{
			Type: &csi.VolumeContentSource_Volume{
				Volume: &csi.VolumeContentSource_VolumeSource{
					VolumeId: source.VolumeCloneID,
				},
			},
		}
	}
	return nil
}

func snapshotsToEntries(snapshots []*csi.Snapshot) []*csi.ListSnapshotsResponse_Entry {
	entries := make([]*csi.ListSnapshotsResponse_Entry, len(snapshots))
	for i, snap := range snapshots {
		entries[i] = &csi.ListSnapshotsResponse_Entry{Snapshot: snap}
	}
	return entries
}
