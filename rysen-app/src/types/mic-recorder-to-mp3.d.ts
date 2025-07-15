declare module "mic-recorder-to-mp3" {
  class MicRecorder {
    constructor(options?: { bitRate?: number; sampleRate?: number });
    start(): Promise<void>;
    stop(): {
      getMp3(): Promise<[ArrayBuffer, Blob]>;
    };
  }

  export default MicRecorder;
}
