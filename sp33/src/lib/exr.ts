export function encodeEXR(
  width: number,
  height: number,
  hdrData: Float32Array
): ArrayBuffer {
  const channels = ['R', 'G', 'B'];
  const numChannels = channels.length;
  const pixelStride = numChannels * 4;

  const headerSize =
    4 +
    writeAttribute('channels', 'chlist', buildChannelList(channels)).byteLength +
    writeAttribute('compression', 'compression', Uint8Array.of(0)).byteLength +
    writeAttribute('dataWindow', 'box2i', buildBox2i(0, 0, width - 1, height - 1)).byteLength +
    writeAttribute('displayWindow', 'box2i', buildBox2i(0, 0, width - 1, height - 1)).byteLength +
    writeAttribute('lineOrder', 'lineOrder', Uint8Array.of(0)).byteLength +
    writeAttribute('pixelAspectRatio', 'float', float32ToBytes(1.0)).byteLength +
    writeAttribute('screenWindowCenter', 'v2f', float32x2ToBytes(0, 0)).byteLength +
    writeAttribute('screenWindowWidth', 'float', float32ToBytes(1.0)).byteLength +
    1;

  const lineOffsetsSize = height * 8;
  const pixelsSize = height * (8 + pixelStride * width);
  const totalSize = headerSize + lineOffsetsSize + pixelsSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint32(offset, 20000630, true);
  offset += 4;

  offset = writeAttributeToView(view, offset, 'channels', 'chlist', buildChannelList(channels));
  offset = writeAttributeToView(view, offset, 'compression', 'compression', Uint8Array.of(0));
  offset = writeAttributeToView(view, offset, 'dataWindow', 'box2i', buildBox2i(0, 0, width - 1, height - 1));
  offset = writeAttributeToView(view, offset, 'displayWindow', 'box2i', buildBox2i(0, 0, width - 1, height - 1));
  offset = writeAttributeToView(view, offset, 'lineOrder', 'lineOrder', Uint8Array.of(0));
  offset = writeAttributeToView(view, offset, 'pixelAspectRatio', 'float', float32ToBytes(1.0));
  offset = writeAttributeToView(view, offset, 'screenWindowCenter', 'v2f', float32x2ToBytes(0, 0));
  offset = writeAttributeToView(view, offset, 'screenWindowWidth', 'float', float32ToBytes(1.0));

  view.setUint8(offset, 0);
  offset++;

  const lineOffsetStart = offset;
  offset += lineOffsetsSize;

  const pixelStart = offset;
  for (let y = 0; y < height; y++) {
    const lineOffset = offset - pixelStart;
    view.setBigUint64(lineOffsetStart + y * 8, BigInt(lineOffset), true);

    view.setInt32(offset, y, true);
    offset += 4;

    const dataSize = pixelStride * width;
    view.setInt32(offset, dataSize, true);
    offset += 4;

    const flippedY = height - 1 - y;

    for (let c = 0; c < numChannels; c++) {
      const channelIndex = numChannels - 1 - c;
      for (let x = 0; x < width; x++) {
        const pixelIndex = (flippedY * width + x) * 4 + channelIndex;
        view.setFloat32(offset, hdrData[pixelIndex], true);
        offset += 4;
      }
    }
  }

  return buffer;
}

function writeAttribute(name: string, type: string, value: Uint8Array): Uint8Array {
  const nameLength = name.length + 1;
  const typeLength = type.length + 1;
  const totalLength = nameLength + typeLength + 4 + value.length;

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  for (let i = 0; i < name.length; i++) {
    view.setUint8(offset++, name.charCodeAt(i));
  }
  view.setUint8(offset++, 0);

  for (let i = 0; i < type.length; i++) {
    view.setUint8(offset++, type.charCodeAt(i));
  }
  view.setUint8(offset++, 0);

  view.setInt32(offset, value.length, true);
  offset += 4;

  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset++, value[i]);
  }

  return buffer;
}

function writeAttributeToView(
  view: DataView,
  offset: number,
  name: string,
  type: string,
  value: Uint8Array
): number {
  const attr = writeAttribute(name, type, value);
  for (let i = 0; i < attr.length; i++) {
    view.setUint8(offset++, attr[i]);
  }
  return offset;
}

function buildChannelList(channels: string[]): Uint8Array {
  const perChannel = 256 + 1 + 4 + 4 + 4;
  const buffer = new Uint8Array(channels.length * perChannel + 1);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      view.setUint8(offset++, ch.charCodeAt(i));
    }
    view.setUint8(offset++, 0);

    view.setInt32(offset, 2, true);
    offset += 4;

    view.setUint8(offset++, 0);

    view.setInt32(offset, 0, true);
    offset += 4;

    view.setInt32(offset, 1, true);
    offset += 4;

    view.setInt32(offset, 1, true);
    offset += 4;
  }

  view.setUint8(offset++, 0);

  return buffer.slice(0, offset);
}

function buildBox2i(xmin: number, ymin: number, xmax: number, ymax: number): Uint8Array {
  const buffer = new Uint8Array(16);
  const view = new DataView(buffer.buffer);
  view.setInt32(0, xmin, true);
  view.setInt32(4, ymin, true);
  view.setInt32(8, xmax, true);
  view.setInt32(12, ymax, true);
  return buffer;
}

function float32ToBytes(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  const view = new DataView(buffer.buffer);
  view.setFloat32(0, value, true);
  return buffer;
}

function float32x2ToBytes(x: number, y: number): Uint8Array {
  const buffer = new Uint8Array(8);
  const view = new DataView(buffer.buffer);
  view.setFloat32(0, x, true);
  view.setFloat32(4, y, true);
  return buffer;
}

export function downloadEXR(
  width: number,
  height: number,
  hdrData: Float32Array,
  filename: string = 'render.exr'
): void {
  const exrBuffer = encodeEXR(width, height, hdrData);
  const blob = new Blob([exrBuffer], { type: 'image/x-exr' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
