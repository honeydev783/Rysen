// export async function transcribeAudio(file: Blob, apiKey: string): Promise<string> {
//   const formData = new FormData();
//   formData.append("file", file);
//   formData.append("model", "whisper-1");

//   const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${apiKey}`,
//     },
//     body: formData,
//   });

//   if (!response.ok) {
//     throw new Error("Transcription failed.");
//   }

//   const data = await response.json();
//   return data.text;
// }

export async function transcribeAudio(audioFile: File, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Transcription error:", errorData);
    throw new Error(errorData?.error?.message || "Failed to transcribe audio");
  }

  const result = await response.json();
  return result.text;
}
