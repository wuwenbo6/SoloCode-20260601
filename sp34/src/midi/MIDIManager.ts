import { MIDIDevice } from '../types';

type MIDINoteCallback = (midiNumber: number, velocity: number, timestamp: number) => void;
type MIDIControlCallback = (controller: number, value: number, timestamp: number) => void;

export class MIDIManager {
  private midiAccess: MIDIAccess | null = null;
  private inputs: Map<string, MIDIInput> = new Map();
  private outputs: Map<string, MIDIOutput> = new Map();
  private selectedInputId: string | null = null;
  
  private onNoteOnCallbacks: MIDINoteCallback[] = [];
  private onNoteOffCallbacks: MIDINoteCallback[] = [];
  private onControlChangeCallbacks: MIDIControlCallback[] = [];
  private onDeviceChangeCallbacks: (() => void)[] = [];

  async init(): Promise<boolean> {
    try {
      if (!navigator.requestMIDIAccess) {
        console.warn('WebMIDI API is not supported in this browser');
        return false;
      }

      this.midiAccess = await navigator.requestMIDIAccess({
        sysex: false
      });

      this.refreshDevices();
      this.midiAccess.onstatechange = () => {
        this.refreshDevices();
        this.notifyDeviceChange();
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      return false;
    }
  }

  private refreshDevices() {
    if (!this.midiAccess) return;

    this.inputs.clear();
    this.outputs.clear();

    this.midiAccess.inputs.forEach((input) => {
      this.inputs.set(input.id, input);
    });

    this.midiAccess.outputs.forEach((output) => {
      this.outputs.set(output.id, output);
    });
  }

  getInputs(): MIDIDevice[] {
    const devices: MIDIDevice[] = [];
    this.inputs.forEach((input, id) => {
      devices.push({
        id,
        name: input.name || 'Unknown Input',
        type: 'input'
      });
    });
    return devices;
  }

  getOutputs(): MIDIDevice[] {
    const devices: MIDIDevice[] = [];
    this.outputs.forEach((output, id) => {
      devices.push({
        id,
        name: output.name || 'Unknown Output',
        type: 'output'
      });
    });
    return devices;
  }

  selectInput(deviceId: string | null): boolean {
    if (this.selectedInputId) {
      const oldInput = this.inputs.get(this.selectedInputId);
      if (oldInput) {
        oldInput.onmidimessage = null;
      }
    }

    this.selectedInputId = deviceId;

    if (deviceId) {
      const input = this.inputs.get(deviceId);
      if (input) {
        input.onmidimessage = this.handleMIDIMessage.bind(this);
        return true;
      }
    }

    return false;
  }

  getSelectedInput(): string | null {
    return this.selectedInputId;
  }

  private handleMIDIMessage(event: MIDIMessageEvent) {
    const data = event.data;
    if (!data || data.length < 2) return;
    
    const status = data[0];
    const data1 = data[1];
    const data2 = data.length > 2 ? data[2] : 0;
    const command = status >> 4;

    switch (command) {
      case 9:
        if (data2 > 0) {
          this.notifyNoteOn(data1, data2, event.timeStamp);
        } else {
          this.notifyNoteOff(data1, 0, event.timeStamp);
        }
        break;

      case 8:
        this.notifyNoteOff(data1, data2, event.timeStamp);
        break;

      case 11:
        this.notifyControlChange(data1, data2, event.timeStamp);
        break;

      case 12:
        break;

      case 13:
        break;

      case 14:
        break;
    }
  }

  onNoteOn(callback: MIDINoteCallback): () => void {
    this.onNoteOnCallbacks.push(callback);
    return () => {
      this.onNoteOnCallbacks = this.onNoteOnCallbacks.filter(cb => cb !== callback);
    };
  }

  onNoteOff(callback: MIDINoteCallback): () => void {
    this.onNoteOffCallbacks.push(callback);
    return () => {
      this.onNoteOffCallbacks = this.onNoteOffCallbacks.filter(cb => cb !== callback);
    };
  }

  onControlChange(callback: MIDIControlCallback): () => void {
    this.onControlChangeCallbacks.push(callback);
    return () => {
      this.onControlChangeCallbacks = this.onControlChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  onDeviceChange(callback: () => void): () => void {
    this.onDeviceChangeCallbacks.push(callback);
    return () => {
      this.onDeviceChangeCallbacks = this.onDeviceChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyNoteOn(midiNumber: number, velocity: number, timestamp: number) {
    this.onNoteOnCallbacks.forEach(cb => cb(midiNumber, velocity, timestamp));
  }

  private notifyNoteOff(midiNumber: number, velocity: number, timestamp: number) {
    this.onNoteOffCallbacks.forEach(cb => cb(midiNumber, velocity, timestamp));
  }

  private notifyControlChange(controller: number, value: number, timestamp: number) {
    this.onControlChangeCallbacks.forEach(cb => cb(controller, value, timestamp));
  }

  private notifyDeviceChange() {
    this.onDeviceChangeCallbacks.forEach(cb => cb());
  }

  sendNoteOn(midiNumber: number, velocity: number = 100, outputId?: string) {
    const output = outputId 
      ? this.outputs.get(outputId) 
      : this.outputs.values().next().value;
    
    if (output) {
      output.send([0x90, midiNumber, velocity]);
    }
  }

  sendNoteOff(midiNumber: number, outputId?: string) {
    const output = outputId 
      ? this.outputs.get(outputId) 
      : this.outputs.values().next().value;
    
    if (output) {
      output.send([0x80, midiNumber, 0]);
    }
  }

  dispose() {
    this.inputs.forEach(input => {
      input.onmidimessage = null;
    });
    this.inputs.clear();
    this.outputs.clear();
    this.onNoteOnCallbacks = [];
    this.onNoteOffCallbacks = [];
    this.onControlChangeCallbacks = [];
    this.onDeviceChangeCallbacks = [];
    this.midiAccess = null;
  }
}

export const midiManager = new MIDIManager();
