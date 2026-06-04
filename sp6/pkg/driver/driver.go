package driver

import (
	"net"
	"sync"

	"github.com/csi-mock-driver/pkg/store"
	"google.golang.org/grpc"
	"k8s.io/klog/v2"
)

const (
	DriverName    = "mock.csi.k8s.io"
	DriverVersion = "1.0.0"
)

type Driver struct {
	store      *store.Store
	grpcServer *grpc.Server
	listener   net.Listener
	serverWG   sync.WaitGroup
	options    *Options
}

type Options struct {
	Endpoint     string
	NodeID       string
	MaxVolumes   int64
	Capabilities []string
}

func NewDriver(options *Options) *Driver {
	if options.MaxVolumes == 0 {
		options.MaxVolumes = 100
	}
	if options.NodeID == "" {
		options.NodeID = "mock-node"
	}
	if options.Endpoint == "" {
		options.Endpoint = "unix:///tmp/csi-mock.sock"
	}

	return &Driver{
		store:   store.NewStore(),
		options: options,
	}
}

func (d *Driver) Run() error {
	listener, err := net.Listen("tcp", d.options.Endpoint)
	if err != nil {
		klog.Fatalf("Failed to listen: %v", err)
	}
	d.listener = listener

	d.grpcServer = grpc.NewServer()
	d.registerServices()

	klog.Infof("CSI Mock Driver starting on %s", d.options.Endpoint)
	d.serverWG.Add(1)
	go func() {
		defer d.serverWG.Done()
		if err := d.grpcServer.Serve(listener); err != nil {
			klog.Fatalf("Failed to serve: %v", err)
		}
	}()

	return nil
}

func (d *Driver) Stop() {
	if d.grpcServer != nil {
		d.grpcServer.GracefulStop()
	}
	if d.listener != nil {
		d.listener.Close()
	}
	d.serverWG.Wait()
}

func (d *Driver) registerServices() {
	registerIdentityServer(d.grpcServer, d)
	registerControllerServer(d.grpcServer, d)
	registerNodeServer(d.grpcServer, d)
}

func (d *Driver) GetStore() *store.Store {
	return d.store
}
