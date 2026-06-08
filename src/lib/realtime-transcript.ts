export interface RealtimeTranscriptEvent {
  type: string;
  delta?: string;
  itemId?: string;
  sequence?: number;
  transcript?: string;
}

interface TranscriptSegment {
  itemId: string;
  isFinal: boolean;
  sequence: number;
  text: string;
}

export interface TranscriptStreamState {
  segments: TranscriptSegment[];
  sessionText: string;
}

export function createTranscriptStreamState(): TranscriptStreamState {
  return {
    segments: [],
    sessionText: "",
  };
}

export function appendTextDelta(text: string, delta: string | undefined) {
  if (!delta) {
    return text;
  }

  return text + delta;
}

function getNextSequence(segments: TranscriptSegment[]) {
  return segments.reduce(
    (nextSequence, segment) => Math.max(nextSequence, segment.sequence + 1),
    1,
  );
}

function upsertSegment(
  state: TranscriptStreamState,
  event: RealtimeTranscriptEvent,
  text: string,
  { replace, isFinal }: { isFinal: boolean; replace: boolean },
): TranscriptStreamState {
  if (!event.itemId) {
    return state;
  }

  const existingSegment = state.segments.find(
    (segment) => segment.itemId === event.itemId,
  );
  const sequence =
    event.sequence ??
    existingSegment?.sequence ??
    getNextSequence(state.segments);
  const nextSegment: TranscriptSegment = {
    itemId: event.itemId,
    isFinal,
    sequence,
    text: replace ? text : appendTextDelta(existingSegment?.text ?? "", text),
  };
  const segments = existingSegment
    ? state.segments.map((segment) =>
        segment.itemId === event.itemId ? nextSegment : segment,
      )
    : [...state.segments, nextSegment];

  return {
    ...state,
    segments,
  };
}

export function applyTranscriptEvent(
  state: TranscriptStreamState,
  event: RealtimeTranscriptEvent,
): TranscriptStreamState {
  if (event.type === "transcript.delta") {
    if (event.itemId) {
      return upsertSegment(state, event, event.delta ?? "", {
        isFinal: false,
        replace: false,
      });
    }

    return {
      ...state,
      sessionText: appendTextDelta(state.sessionText, event.delta),
    };
  }

  if (event.type === "transcript.completed") {
    if (event.itemId) {
      return upsertSegment(state, event, event.transcript ?? "", {
        isFinal: true,
        replace: true,
      });
    }

    return {
      ...state,
      sessionText: event.transcript ?? state.sessionText,
    };
  }

  return state;
}

export function getTranscriptText(state: TranscriptStreamState) {
  const itemText = state.segments
    .filter((segment) => segment.text.trim())
    .sort((first, second) => first.sequence - second.sequence)
    .map((segment) => segment.text.trim())
    .join(" ");

  return [state.sessionText.trim(), itemText].filter(Boolean).join(" ");
}
