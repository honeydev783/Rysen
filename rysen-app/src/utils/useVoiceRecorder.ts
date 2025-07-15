import { useState, useRef } from "react";

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  //   const stopRecording = (): Promise<Blob> => {
  //     return new Promise((resolve) => {
  //       if (!mediaRecorderRef.current) return;

  //       mediaRecorderRef.current.onstop = () => {
  //         const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
  //         resolve(audioBlob);
  //       };

  //       mediaRecorderRef.current.stop();
  //       setIsRecording(false);
  //     });
  //   };
  const stopRecording = (): Promise<File> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) return;

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const audioFile = new File([audioBlob], "recording.webm", {
          type: "audio/webm",
        });
        resolve(audioFile);
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  };

  return { isRecording, startRecording, stopRecording };
};
