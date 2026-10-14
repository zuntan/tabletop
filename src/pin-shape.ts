export type PinFrame = 'text' | 'rect' | 'roundedRect' | 'ellipse' | 'pin';

/** The rounded head occupies the upper three quarters; the tip is bottom-center. */
export function pinPath(width: number, height: number): string {
  const center = height * 0.375;
  return `M ${width / 2} ${height} C ${width * 0.4} ${height * 0.8} 0 ${height * 0.65} 0 ${center} A ${width / 2} ${center} 0 0 1 ${width} ${center} C ${width} ${height * 0.65} ${width * 0.6} ${height * 0.8} ${width / 2} ${height} Z`;
}
export function numberCenterY(shape: PinFrame | undefined, height: number) {
  return height * (shape === 'pin' ? 0.375 : 0.5);
}
export function tightFrame(fontSize: number, shape: PinFrame, texts: string[] = ['1'], measure?: (text: string) => number) {
  const textWidth = Math.max(0, ...texts.map(text => measure ? measure(text)
    : [...text].reduce((width, character) => width + fontSize * (/^[\x20-\x7e]$/.test(character) ? 0.65 : 1), 0)));
  const width = Math.ceil(Math.max(fontSize + 12, textWidth + 12));
  return { width, height: shape === 'pin' ? Math.ceil(width * 4 / 3) : Math.ceil(fontSize + 12) };
}
