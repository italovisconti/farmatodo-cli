import pc from "picocolors";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ASCII_FRAMES = ["-", "\\", "|", "/"];

export function getSpinnerFrames(): string[] {
  const env = process.env;
  if (env.NO_NERD_FONTS === "1" || env.NERD_FONTS === "0" || env.NERD_FONTS === "false") {
    return ASCII_FRAMES;
  }
  return BRAILLE_FRAMES;
}

export function startCliSpinner(text: string) {
  const frames = getSpinnerFrames();
  let frameIdx = 0;

  process.stdout.write(`\r${pc.blue(frames[frameIdx])} ${pc.blue(text)}`);

  const interval = setInterval(() => {
    frameIdx = (frameIdx + 1) % frames.length;
    process.stdout.write(`\r${pc.blue(frames[frameIdx])} ${pc.blue(text)}`);
  }, 80);

  return {
    stop(finalText?: string) {
      clearInterval(interval);
      process.stdout.write("\r\x1b[K"); // Clear current line
      if (finalText) {
        console.log(finalText);
      }
    }
  };
}
