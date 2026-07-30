export const MAX_VTT_BYTES = 5 * 1024 * 1024;

const MAX_VTT_CUES = 20000;
const MAX_VTT_CUE_TEXT_LENGTH = 16 * 1024;

export const addVttCue = (cues, cue) => {
  if (cues.length >= MAX_VTT_CUES) {
    const error = new Error(`VTT exceeds ${MAX_VTT_CUES} cues`);
    error.name = 'VttLimitError';
    throw error;
  }

  if (cue.text.length > MAX_VTT_CUE_TEXT_LENGTH) {
    const error = new Error(`VTT cue text exceeds ${MAX_VTT_CUE_TEXT_LENGTH} characters`);
    error.name = 'VttLimitError';
    throw error;
  }

  cues.push(cue);
};
