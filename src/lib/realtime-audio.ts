const TARGET_SAMPLE_RATE = 24000;
const PROCESSOR_BUFFER_SIZE = 4096;

export interface RealtimeAudioCaptureHandles {
  context: AudioContext;
  mute: GainNode;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
  socket: WebSocket;
}

interface RealtimeAudioCaptureOptions {
  websocketUrl: string;
  onMessage: (message: MessageEvent) => void;
  onSocketClose: () => void;
  onSocketError: () => void;
}

function floatToPcm16(samples: Float32Array) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(index * 2, value, true);
  });

  return buffer;
}

function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
) {
  if (fromRate === toRate) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, samples.length - 1);
    const weight = sourceIndex - lowerIndex;
    output[index] =
      samples[lowerIndex] * (1 - weight) + samples[upperIndex] * weight;
  }

  return output;
}

function waitForSocketOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Could not connect to realtime server.")),
      { once: true },
    );
  });
}

export async function startRealtimeAudioCapture({
  websocketUrl,
  onMessage,
  onSocketClose,
  onSocketError,
}: RealtimeAudioCaptureOptions) {
  let stream: MediaStream | null = null;
  let socket: WebSocket | null = null;
  let context: AudioContext | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    socket = new WebSocket(websocketUrl);
    socket.binaryType = "arraybuffer";

    await waitForSocketOpen(socket);

    context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(
      PROCESSOR_BUFFER_SIZE,
      1,
      1,
    );
    const mute = context.createGain();
    mute.gain.value = 0;

    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onSocketError);
    socket.addEventListener("close", onSocketClose);

    processor.onaudioprocess = (event) => {
      if (socket?.readyState !== WebSocket.OPEN || !context) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const samples = resampleLinear(
        input,
        context.sampleRate,
        TARGET_SAMPLE_RATE,
      );
      socket.send(floatToPcm16(samples));
    };

    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);

    return {
      context,
      mute,
      processor,
      source,
      stream,
      socket,
    };
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    if (
      socket &&
      socket.readyState !== WebSocket.CLOSING &&
      socket.readyState !== WebSocket.CLOSED
    ) {
      socket.close();
    }
    if (context && context.state !== "closed") {
      void context.close();
    }
    throw error;
  }
}

export function cleanupRealtimeAudioCapture(
  handles: RealtimeAudioCaptureHandles | null,
  { gracefulStop = false }: { gracefulStop?: boolean } = {},
) {
  if (!handles) {
    return;
  }

  handles.processor.disconnect();
  handles.mute.disconnect();
  handles.source.disconnect();
  handles.stream.getTracks().forEach((track) => track.stop());

  if (handles.socket.readyState === WebSocket.OPEN) {
    handles.socket.send(JSON.stringify({ type: "stop" }));
  }

  if (gracefulStop) {
    window.setTimeout(() => handles.socket.close(), 1300);
  } else {
    handles.socket.close();
  }

  if (handles.context.state !== "closed") {
    void handles.context.close();
  }
}
