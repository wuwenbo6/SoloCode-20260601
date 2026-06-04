import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const GamepadContext = createContext();

export const useGamepad = () => {
  const context = useContext(GamepadContext);
  if (!context) {
    throw new Error('useGamepad must be used within a GamepadProvider');
  }
  return context;
};

const HID_USAGE_PAGE = {
  GENERIC_DESKTOP: 0x01,
  SIMULATION: 0x02,
  VR: 0x03,
  SPORT: 0x04,
  GAME: 0x05,
  KEYBOARD: 0x07,
  LED: 0x08,
  BUTTON: 0x09,
  ORDINAL: 0x0A,
  TELEPHONY: 0x0B,
  CONSUMER: 0x0C
};

const HID_REPORT_ITEM_TYPE = {
  MAIN: 0,
  GLOBAL: 1,
  LOCAL: 2,
  RESERVED: 3
};

const HID_MAIN_ITEM_TAG = {
  INPUT: 0x08,
  OUTPUT: 0x09,
  FEATURE: 0x0B,
  COLLECTION: 0x0A,
  END_COLLECTION: 0xC0
};

const HID_GLOBAL_ITEM_TAG = {
  USAGE_PAGE: 0x00,
  LOGICAL_MIN: 0x01,
  LOGICAL_MAX: 0x02,
  PHYSICAL_MIN: 0x03,
  PHYSICAL_MAX: 0x04,
  UNIT_EXPONENT: 0x05,
  UNIT: 0x06,
  REPORT_SIZE: 0x07,
  REPORT_ID: 0x08,
  REPORT_COUNT: 0x09,
  PUSH: 0x0A,
  POP: 0x0B
};

const HID_LOCAL_ITEM_TAG = {
  USAGE: 0x00,
  USAGE_MIN: 0x01,
  USAGE_MAX: 0x02,
  DESIGNATOR_INDEX: 0x03,
  DESIGNATOR_MIN: 0x04,
  DESIGNATOR_MAX: 0x05,
  STRING_INDEX: 0x07,
  STRING_MIN: 0x08,
  STRING_MAX: 0x09,
  DELIMITER: 0x0A
};

class HIDReportDescriptorParser {
  constructor() {
    this.reset();
  }

  reset() {
    this.globalItems = { usagePage: 0, reportId: 0, reportSize: 0, reportCount: 0, logicalMin: 0, logicalMax: 0, physicalMin: 0, physicalMax: 0 };
    this.localItems = { usages: [], usageMin: 0, usageMax: 0 };
    this.collections = [];
    this.inputReports = [];
    this.outputReports = [];
    this.featureReports = [];
    this.currentReportId = 0;
  }

  parseItem(data, offset) {
    const bTag = (data[offset] >> 4) & 0x0F;
    const bType = (data[offset] >> 2) & 0x03;
    let bSize = data[offset] & 0x03;
    if (bSize === 3) bSize = 4;
    let value = 0;
    for (let i = 0; i < bSize; i++) {
      value |= (data[offset + 1 + i] << (i * 8));
    }
    return { bTag, bType, bSize, value, totalSize: 1 + bSize };
  }

  parse(descriptorData) {
    this.reset();
    let offset = 0;
    const data = new Uint8Array(descriptorData);

    while (offset < data.length) {
      const item = this.parseItem(data, offset);
      offset += item.totalSize;
      this.processItem(item);
    }

    return {
      inputReports: this.inputReports,
      outputReports: this.outputReports,
      featureReports: this.featureReports,
      collections: this.collections
    };
  }

  processItem(item) {
    const { bTag, bType, value } = item;

    switch (bType) {
      case HID_REPORT_ITEM_TYPE.GLOBAL:
        this.processGlobalItem(bTag, value);
        break;
      case HID_REPORT_ITEM_TYPE.LOCAL:
        this.processLocalItem(bTag, value);
        break;
      case HID_REPORT_ITEM_TYPE.MAIN:
        this.processMainItem(bTag, value);
        break;
    }
  }

  processGlobalItem(bTag, value) {
    switch (bTag) {
      case HID_GLOBAL_ITEM_TAG.USAGE_PAGE:
        this.globalItems.usagePage = value;
        break;
      case HID_GLOBAL_ITEM_TAG.LOGICAL_MIN:
        this.globalItems.logicalMin = this.signExtend(value, 32);
        break;
      case HID_GLOBAL_ITEM_TAG.LOGICAL_MAX:
        this.globalItems.logicalMax = this.signExtend(value, 32);
        break;
      case HID_GLOBAL_ITEM_TAG.REPORT_SIZE:
        this.globalItems.reportSize = value;
        break;
      case HID_GLOBAL_ITEM_TAG.REPORT_COUNT:
        this.globalItems.reportCount = value;
        break;
      case HID_GLOBAL_ITEM_TAG.REPORT_ID:
        this.globalItems.reportId = value;
        this.currentReportId = value;
        break;
    }
  }

  processLocalItem(bTag, value) {
    switch (bTag) {
      case HID_LOCAL_ITEM_TAG.USAGE:
        this.localItems.usages.push(value);
        break;
      case HID_LOCAL_ITEM_TAG.USAGE_MIN:
        this.localItems.usageMin = value;
        break;
      case HID_LOCAL_ITEM_TAG.USAGE_MAX:
        this.localItems.usageMax = value;
        break;
    }
  }

  processMainItem(bTag, value) {
    switch (bTag) {
      case HID_MAIN_ITEM_TAG.INPUT:
        this.addReport(this.inputReports, 'input', value);
        break;
      case HID_MAIN_ITEM_TAG.OUTPUT:
        this.addReport(this.outputReports, 'output', value);
        break;
      case HID_MAIN_ITEM_TAG.FEATURE:
        this.addReport(this.featureReports, 'feature', value);
        break;
      case HID_MAIN_ITEM_TAG.COLLECTION:
        this.collections.push({
          type: value,
          usagePage: this.globalItems.usagePage,
          usages: [...this.localItems.usages]
        });
        break;
      case HID_MAIN_ITEM_TAG.END_COLLECTION:
        break;
    }
    this.localItems.usages = [];
  }

  addReport(reportsArray, type, flags) {
    const report = {
      reportId: this.globalItems.reportId,
      reportSize: this.globalItems.reportSize,
      reportCount: this.globalItems.reportCount,
      usagePage: this.globalItems.usagePage,
      logicalMin: this.globalItems.logicalMin,
      logicalMax: this.globalItems.logicalMax,
      usages: [...this.localItems.usages],
      usageMin: this.localItems.usageMin,
      usageMax: this.localItems.usageMax,
      flags
    };

    let reportEntry = reportsArray.find(r => r.reportId === this.globalItems.reportId);
    if (!reportEntry) {
      reportEntry = { reportId: this.globalItems.reportId, fields: [] };
      reportsArray.push(reportEntry);
    }
    reportEntry.fields.push(report);
  }

  signExtend(value, bits) {
    const signBit = 1 << (bits - 1);
    if (value & signBit) {
      return value | (~0 << bits);
    }
    return value;
  }
}

class UniversalHIDParser {
  constructor() {
    this.descriptorParser = new HIDReportDescriptorParser();
    this.parsedDescriptor = null;
    this.deviceType = 'unknown';
  }

  setDescriptor(descriptorData) {
    this.parsedDescriptor = this.descriptorParser.parse(descriptorData);
    this.detectDeviceType();
    return this.parsedDescriptor;
  }

  detectDeviceType() {
    const collections = this.parsedDescriptor?.collections || [];
    for (const col of collections) {
      if (col.usagePage === HID_USAGE_PAGE.GENERIC_DESKTOP) {
        if (col.usages.includes(0x05)) {
          this.deviceType = 'gamepad';
          return;
        }
        if (col.usages.includes(0x04)) {
          this.deviceType = 'joystick';
          return;
        }
      }
    }
    this.deviceType = 'unknown';
  }

  parseInputReport(data, reportId) {
    const dataArray = new Uint8Array(data.buffer || data);
    const result = { axes: [], buttons: [], hats: [], rawData: Array.from(dataArray), reportId };
    if (!this.parsedDescriptor?.inputReports) return result;

    const inputReport = this.parsedDescriptor.inputReports.find(r => r.reportId === reportId);
    if (!inputReport) return this.fallbackParse(dataArray, reportId);

    let bitOffset = reportId > 0 ? 8 : 0;
    let buttonIndex = 0;
    let axisIndex = 0;

    for (const field of inputReport.fields) {
      for (let i = 0; i < field.reportCount; i++) {
        const value = this.extractValue(dataArray, bitOffset, field.reportSize);
        const normalizedValue = this.normalizeValue(value, field);

        if (field.usagePage === HID_USAGE_PAGE.BUTTON || 
            (field.usages.some(u => (u & 0xFFFF0000) >>> 16 === HID_USAGE_PAGE.BUTTON))) {
          result.buttons[buttonIndex++] = normalizedValue !== 0;
        } else if (field.usagePage === HID_USAGE_PAGE.GENERIC_DESKTOP || 
                   field.usages.length > 0) {
          const usage = field.usages[i] || field.usages[0];
          const usageId = usage & 0xFFFF;

          if (usageId >= 0x30 && usageId <= 0x39) {
            result.axes[axisIndex++] = normalizedValue;
          } else if (usageId === 0x39) {
            result.hats.push(value);
          }
        }

        bitOffset += field.reportSize;
      }
    }

    return result;
  }

  extractValue(data, bitOffset, bitSize) {
    let value = 0;
    for (let i = 0; i < bitSize; i++) {
      const byteIndex = Math.floor((bitOffset + i) / 8);
      const bitIndex = (bitOffset + i) % 8;
      if (byteIndex < data.length) {
        value |= ((data[byteIndex] >> bitIndex) & 1) << i;
      }
    }
    return value;
  }

  normalizeValue(value, field) {
    const range = field.logicalMax - field.logicalMin;
    if (range <= 0) return value;
    if (field.reportSize <= 1) return value;
    return ((value - field.logicalMin) / range) * 2 - 1;
  }

  fallbackParse(dataArray, reportId) {
    const result = { axes: [], buttons: [], hats: [], rawData: Array.from(dataArray), reportId };

    if (dataArray.length >= 4) {
      result.axes[0] = (dataArray[0] - 128) / 128;
      result.axes[1] = (dataArray[1] - 128) / 128;
      result.axes[2] = (dataArray[2] - 128) / 128;
      result.axes[3] = (dataArray[3] - 128) / 128;
    }

    if (dataArray.length >= 6) {
      const buttonByte = dataArray[5];
      for (let i = 0; i < 8; i++) {
        result.buttons[i] = (buttonByte & (1 << i)) !== 0;
      }
    }

    if (dataArray.length >= 7) {
      const buttonByte2 = dataArray[6];
      for (let i = 0; i < 8; i++) {
        result.buttons[8 + i] = (buttonByte2 & (1 << i)) !== 0;
      }
    }

    if (dataArray.length >= 8) {
      const hatSwitch = dataArray[7] & 0x0F;
      result.hats.push(hatSwitch);
      const hatButtons = [false, false, false, false];
      if (hatSwitch === 0 || hatSwitch === 1 || hatSwitch === 7) hatButtons[0] = true;
      if (hatSwitch === 1 || hatSwitch === 2 || hatSwitch === 3) hatButtons[1] = true;
      if (hatSwitch === 3 || hatSwitch === 4 || hatSwitch === 5) hatButtons[2] = true;
      if (hatSwitch === 5 || hatSwitch === 6 || hatSwitch === 7) hatButtons[3] = true;
      result.buttons.splice(16, 0, ...hatButtons);
    }

    return result;
  }

  getSupportedOutputReports() {
    return this.parsedDescriptor?.outputReports || [];
  }
}

export const GamepadProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [inputState, setInputState] = useState({
    axes: [],
    buttons: [],
    hats: [],
    rawData: null,
    reportId: null
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordedMacro, setRecordedMacro] = useState([]);
  const [isPlayingMacro, setIsPlayingMacro] = useState(false);
  const [descriptorInfo, setDescriptorInfo] = useState(null);
  const [rumbleMode, setRumbleMode] = useState('auto');
  const [rumbleAvailable, setRumbleAvailable] = useState(false);
  const [turboButtons, setTurboButtons] = useState({});
  const [turboRate, setTurboRate] = useState(10);
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('gamepadProfiles');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeProfileId, setActiveProfileId] = useState(null);

  const recordingStartTime = useRef(0);
  const lastInputTime = useRef(0);
  const macroPlaybackLock = useRef(false);
  const hidParsers = useRef(new Map());
  const lastButtonState = useRef([]);
  const turboIntervals = useRef({});
  const turboCallbackRef = useRef(null);

  const requestDevice = useCallback(async () => {
    if (!navigator.hid) {
      alert('您的浏览器不支持 WebHID API，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    try {
      const devices = await navigator.hid.requestDevice({ filters: [] });
      if (devices && devices.length > 0) {
        await connectDevice(devices[0]);
      }
    } catch (error) {
      console.error('选择设备失败:', error);
    }
  }, []);

  const connectDevice = useCallback(async (device) => {
    try {
      await device.open();
      console.log('已连接设备:', device.productName);

      const parser = new UniversalHIDParser();
      
      if (device.collections && device.collections.length > 0) {
        const allReports = [];
        for (const col of device.collections) {
          if (col.inputReports) allReports.push(...col.inputReports);
          if (col.outputReports) allReports.push(...col.outputReports);
          if (col.featureReports) allReports.push(...col.featureReports);
        }
        console.log('设备报告描述符:', allReports);
      }

      if (device.reports && device.reports.length > 0) {
        console.log('设备报告:', device.reports);
      }

      const descriptorInfo = {
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName,
        deviceType: parser.deviceType,
        reports: device.reports || [],
        collections: device.collections || []
      };

      hidParsers.current.set(device, parser);
      setDescriptorInfo(descriptorInfo);

      device.oninputreport = (event) => {
        if (macroPlaybackLock.current) return;
        handleInputReport(event, device, parser);
      };

      const hasOutput = device.collections?.some(c => 
        c.outputReports && c.outputReports.length > 0
      ) || device.reports?.some(r => r.type === 'output');
      setRumbleAvailable(!!hasOutput);

      setDevices(prev => {
        const exists = prev.find(d => d.device === device);
        if (exists) return prev;
        return [...prev, { 
          device, 
          name: device.productName, 
          vendorId: device.vendorId, 
          productId: device.productId,
          hasRumble: !!hasOutput
        }];
      });

      setSelectedDevice({ device, name: device.productName });
    } catch (error) {
      console.error('连接设备失败:', error);
    }
  }, []);

  const handleInputReport = useCallback((event, device, parser) => {
    const { data, reportId } = event;
    const parsed = parser.parseInputReport(data, reportId);

    setInputState({
      axes: parsed.axes,
      buttons: parsed.buttons,
      hats: parsed.hats,
      rawData: parsed.rawData,
      reportId
    });

    if (isRecording) {
      const now = Date.now();
      const delay = recordingStartTime.current ? now - lastInputTime.current : 0;
      lastInputTime.current = now;
      if (!recordingStartTime.current) recordingStartTime.current = now;

      const buttonChanged = parsed.buttons.some((b, i) => b !== lastButtonState.current[i]);
      
      if (buttonChanged || parsed.axes.some(a => Math.abs(a) > 0.1)) {
        if (delay > 0) {
          setRecordedMacro(prev => [...prev, { type: 'delay', duration: delay }]);
        }

        setRecordedMacro(prev => [...prev, {
          type: 'input',
          axes: [...parsed.axes],
          buttons: [...parsed.buttons]
        }]);
      }
      
      lastButtonState.current = [...parsed.buttons];
    }
  }, [isRecording]);

  const toggleTurbo = useCallback((buttonIndex) => {
    setTurboButtons(prev => {
      const next = { ...prev };
      if (next[buttonIndex]) {
        delete next[buttonIndex];
        if (turboIntervals.current[buttonIndex]) {
          clearInterval(turboIntervals.current[buttonIndex]);
          delete turboIntervals.current[buttonIndex];
        }
      } else {
        next[buttonIndex] = true;
      }
      return next;
    });
  }, []);

  const updateTurboRate = useCallback((rate) => {
    setTurboRate(rate);
    Object.keys(turboIntervals.current).forEach(key => {
      clearInterval(turboIntervals.current[key]);
      delete turboIntervals.current[key];
    });
  }, []);

  useEffect(() => {
    return () => {
      Object.values(turboIntervals.current).forEach(id => clearInterval(id));
    };
  }, []);

  const saveProfile = useCallback((profileId, name, gameName) => {
    setProfiles(prev => {
      const mappings = JSON.parse(localStorage.getItem('buttonMappings') || '{}');
      const macros = JSON.parse(localStorage.getItem('localMacros') || '[]');
      const profile = {
        id: profileId || Date.now().toString(),
        name,
        gameName: gameName || '',
        mappings,
        macros,
        turboButtons: { ...turboButtons },
        turboRate,
        rumbleMode,
        createdAt: prev[profileId]?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      const next = { ...prev, [profile.id]: profile };
      localStorage.setItem('gamepadProfiles', JSON.stringify(next));
      return next;
    });
  }, [turboButtons, turboRate, rumbleMode]);

  const loadProfile = useCallback((profileId) => {
    const profile = profiles[profileId];
    if (!profile) return;
    
    if (profile.mappings) {
      localStorage.setItem('buttonMappings', JSON.stringify(profile.mappings));
    }
    if (profile.macros) {
      localStorage.setItem('localMacros', JSON.stringify(profile.macros));
    }
    if (profile.turboButtons) {
      Object.values(turboIntervals.current).forEach(id => clearInterval(id));
      turboIntervals.current = {};
      setTurboButtons(profile.turboButtons);
    }
    if (profile.turboRate) {
      setTurboRate(profile.turboRate);
    }
    if (profile.rumbleMode) {
      setRumbleMode(profile.rumbleMode);
    }
    setActiveProfileId(profileId);
  }, [profiles]);

  const deleteProfile = useCallback((profileId) => {
    setProfiles(prev => {
      const next = { ...prev };
      delete next[profileId];
      localStorage.setItem('gamepadProfiles', JSON.stringify(next));
      return next;
    });
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
    }
  }, [activeProfileId]);

  const disconnectDevice = useCallback(async (device) => {
    try {
      await device.close();
      hidParsers.current.delete(device);
      setDevices(prev => prev.filter(d => d.device !== device));
      if (selectedDevice?.device === device) {
        setSelectedDevice(null);
        setInputState({ axes: [], buttons: [], hats: [], rawData: null, reportId: null });
        setDescriptorInfo(null);
        setRumbleAvailable(false);
      }
    } catch (error) {
      console.error('断开设备失败:', error);
    }
  }, [selectedDevice]);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordedMacro([]);
    recordingStartTime.current = 0;
    lastInputTime.current = 0;
    lastButtonState.current = [];
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => {
    setRecordedMacro([]);
  }, []);

  const playMacro = useCallback(async (macroData) => {
    if (macroPlaybackLock.current) return;

    macroPlaybackLock.current = true;
    setIsPlayingMacro(true);

    try {
      for (const step of macroData) {
        if (!macroPlaybackLock.current) break;

        if (step.type === 'delay') {
          await new Promise(resolve => setTimeout(resolve, step.duration));
        } else if (step.type === 'input') {
          console.log('宏播放 - 输入:', step);
        }
      }
    } finally {
      macroPlaybackLock.current = false;
      setIsPlayingMacro(false);
    }
  }, []);

  const stopMacroPlayback = useCallback(() => {
    macroPlaybackLock.current = false;
    setIsPlayingMacro(false);
  }, []);

  const triggerRumble = useCallback(async (duration = 500, weakMagnitude = 0.5, strongMagnitude = 0.5) => {
    if (!selectedDevice?.device) return;

    const device = selectedDevice.device;
    const modes = rumbleMode === 'auto' ? ['xbox', 'ds4', 'generic'] : [rumbleMode];

    for (const mode of modes) {
      try {
        let report;
        let reportId = 0;

        switch (mode) {
          case 'xbox':
            report = new Uint8Array(8);
            report[0] = 0x00;
            report[1] = 0x08;
            report[2] = 0x00;
            report[3] = Math.floor(weakMagnitude * 255);
            report[4] = Math.floor(strongMagnitude * 255);
            report[5] = 0;
            report[6] = 0;
            report[7] = 0;
            break;

          case 'ds4':
            report = new Uint8Array(32);
            report[0] = 0x05;
            report[1] = 0x01;
            report[3] = Math.floor(weakMagnitude * 255);
            report[4] = Math.floor(strongMagnitude * 255);
            reportId = 0x05;
            break;

          case 'generic':
          default:
            report = new Uint8Array(5);
            report[0] = 0x00;
            report[1] = 1;
            report[2] = Math.floor(strongMagnitude * 255);
            report[3] = Math.floor(weakMagnitude * 255);
            report[4] = 10;
            break;
        }

        await device.sendReport(reportId, report);
        
        setTimeout(async () => {
          try {
            const stopReport = new Uint8Array(report.length);
            stopReport[0] = report[0];
            if (mode === 'xbox') stopReport[1] = 0x08;
            await device.sendReport(reportId, stopReport);
          } catch (e) {}
        }, duration);

        return true;
      } catch (error) {
        console.log(`震动模式 ${mode} 失败:`, error.message);
        continue;
      }
    }

    console.log('所有震动模式均失败');
    return false;
  }, [selectedDevice, rumbleMode]);

  useEffect(() => {
    if (navigator.hid) {
      navigator.hid.getDevices().then(hidDevices => {
        hidDevices.forEach(device => {
          if (device.opened) {
            connectDevice(device);
          }
        });
      });
    }
  }, [connectDevice]);

  const value = {
    devices,
    selectedDevice,
    inputState,
    isRecording,
    recordedMacro,
    isPlayingMacro,
    descriptorInfo,
    rumbleMode,
    rumbleAvailable,
    turboButtons,
    turboRate,
    profiles,
    activeProfileId,
    requestDevice,
    connectDevice,
    disconnectDevice,
    setSelectedDevice,
    startRecording,
    stopRecording,
    clearRecording,
    setRecordedMacro,
    triggerRumble,
    setRumbleMode,
    playMacro,
    stopMacroPlayback,
    macroPlaybackLock,
    toggleTurbo,
    updateTurboRate,
    saveProfile,
    loadProfile,
    deleteProfile,
    setActiveProfileId
  };

  return <GamepadContext.Provider value={value}>{children}</GamepadContext.Provider>;
};
