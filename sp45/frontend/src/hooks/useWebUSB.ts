import { useState, useCallback, useEffect } from 'react';

const MARLIN_USB_IDS = [
  { vendorId: 0x1a86, productId: 0x7523 },
  { vendorId: 0x0403, productId: 0x6001 },
  { vendorId: 0x10c4, productId: 0xea60 },
  { vendorId: 0x2341, productId: 0x0042 },
  { vendorId: 0x2341, productId: 0x0010 },
];

interface WebUSBDevice {
  device: USBDevice;
  connected: boolean;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
}

export function useWebUSB() {
  const [devices, setDevices] = useState<WebUSBDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<WebUSBDevice | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported('usb' in navigator);
  }, []);

  const listDevices = useCallback(async () => {
    if (!('usb' in navigator)) {
      setError('WebUSB not supported');
      return [];
    }

    try {
      const pairedDevices = await navigator.usb.getDevices();
      const deviceList: WebUSBDevice[] = pairedDevices.map((device) => ({
        device,
        connected: device.opened,
        manufacturer: device.manufacturerName,
        product: device.productName,
        serialNumber: device.serialNumber,
      }));
      setDevices(deviceList);
      setError(null);
      return deviceList;
    } catch (e) {
      setError('Failed to list devices');
      return [];
    }
  }, []);

  const requestDevice = useCallback(async () => {
    if (!('usb' in navigator)) {
      setError('WebUSB not supported');
      return null;
    }

    try {
      const device = await navigator.usb.requestDevice({
        filters: MARLIN_USB_IDS.map((id) => ({
          vendorId: id.vendorId,
          productId: id.productId,
        })),
      });

      const webUSBDevice: WebUSBDevice = {
        device,
        connected: device.opened,
        manufacturer: device.manufacturerName,
        product: device.productName,
        serialNumber: device.serialNumber,
      };

      setSelectedDevice(webUSBDevice);
      setError(null);
      return webUSBDevice;
    } catch (e) {
      if ((e as Error).name === 'NotFoundError') {
        setError('No device selected');
      } else {
        setError('Failed to request device');
      }
      return null;
    }
  }, []);

  const connectDevice = useCallback(async (usbDevice: WebUSBDevice) => {
    try {
      if (!usbDevice.device.opened) {
        await usbDevice.device.open();
      }

      const iface = usbDevice.device.configuration?.interfaces[0];
      if (iface) {
        await usbDevice.device.claimInterface(iface.interfaceNumber);
      }

      const updated: WebUSBDevice = {
        ...usbDevice,
        connected: true,
      };
      setSelectedDevice(updated);
      setError(null);
      return true;
    } catch (e) {
      setError('Failed to connect to device');
      return false;
    }
  }, []);

  const disconnectDevice = useCallback(async () => {
    if (selectedDevice?.device.opened) {
      try {
        const iface = selectedDevice.device.configuration?.interfaces[0];
        if (iface) {
          await selectedDevice.device.releaseInterface(iface.interfaceNumber);
        }
        await selectedDevice.device.close();
      } catch (e) {
        console.error('Error disconnecting:', e);
      }
    }
    setSelectedDevice(null);
  }, [selectedDevice]);

  const sendCommand = useCallback(async (command: string): Promise<string> => {
    if (!selectedDevice?.connected) {
      throw new Error('Device not connected');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(command + '\n');

    const endpoint = selectedDevice.device.configuration?.interfaces[0]?.alternates[0]?.endpoints.find(
      (ep) => ep.direction === 'out'
    );

    if (!endpoint) {
      throw new Error('No output endpoint found');
    }

    await selectedDevice.device.transferOut(endpoint.endpointNumber, data);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const inEndpoint = selectedDevice.device.configuration?.interfaces[0]?.alternates[0]?.endpoints.find(
      (ep) => ep.direction === 'in'
    );

    if (!inEndpoint) {
      return 'ok';
    }

    const result = await selectedDevice.device.transferIn(inEndpoint.endpointNumber, 64);
    const decoder = new TextDecoder();
    return decoder.decode(result.data || new Uint8Array());
  }, [selectedDevice]);

  useEffect(() => {
    listDevices();

    const handleConnect = (event: USBConnectionEvent) => {
      console.log('Device connected:', event.device);
      listDevices();
    };

    const handleDisconnect = (event: USBConnectionEvent) => {
      console.log('Device disconnected:', event.device);
      if (selectedDevice?.device === event.device) {
        setSelectedDevice(null);
      }
      listDevices();
    };

    if ('usb' in navigator) {
      navigator.usb.addEventListener('connect', handleConnect);
      navigator.usb.addEventListener('disconnect', handleDisconnect);
    }

    return () => {
      if ('usb' in navigator) {
        navigator.usb.removeEventListener('connect', handleConnect);
        navigator.usb.removeEventListener('disconnect', handleDisconnect);
      }
    };
  }, [listDevices, selectedDevice]);

  return {
    isSupported,
    devices,
    selectedDevice,
    error,
    listDevices,
    requestDevice,
    connectDevice,
    disconnectDevice,
    sendCommand,
  };
}
