import { Howl } from 'howler';

let drips: Howl | null = null;
let swoopTone: Howl | null = null;
let metallic: Howl | null = null;
let metallicSting: Howl | null = null;

let metallicTensionOn = false;

function loadSound(src: string, loop: boolean, volume: number): Promise<Howl> {
  return new Promise((resolve, reject) => {
    const sound = new Howl({
      src: [src],
      loop,
      volume,
      onload: () => resolve(sound),
      onloaderror: (_id, err) => reject(new Error(`Failed to load ${src}: ${err}`)),
    });
  });
}

export async function initAudio(): Promise<void> {
  [drips, swoopTone, metallic, metallicSting] = await Promise.all([
    loadSound('/sounds/bg-drips.mp3', true, 1.0),
    loadSound('/sounds/bg-swoop-tone.mp3', true, 0),
    loadSound('/sounds/bg-metallic.mp3', true, 0),
    loadSound('/sounds/bg-metallic-sting.mp3', false, 1.0),
  ]);
}

export function startAmbience(): void {
  if (!drips || !swoopTone) return;
  drips.play();
  swoopTone.play();
  swoopTone.fade(0, 1.0, 20000);
}

export function setMetallicTension(on: boolean): void {
  if (!metallic || metallicTensionOn === on) return;
  metallicTensionOn = on;
  if (on) {
    if (!metallic.playing()) metallic.play();
    metallic.fade(metallic.volume() as number, 1.0, 1000);
  } else {
    metallic.fade(metallic.volume() as number, 0, 1000);
  }
}

export function playMetallicSting(): void {
  metallicSting?.play();
}

export function resetAudio(): void {
  metallicTensionOn = false;

  // Fade out tense sounds then stop them
  const FADE_OUT = 1500;
  if (metallic && metallic.playing()) {
    metallic.fade(metallic.volume() as number, 0, FADE_OUT);
    metallic.once('fade', () => metallic!.stop());
  }
  if (metallicSting && metallicSting.playing()) {
    metallicSting.fade(metallicSting.volume() as number, 0, FADE_OUT);
    metallicSting.once('fade', () => metallicSting!.stop());
  }

  // Restart base layers immediately — they're independent of the sting
  drips?.stop();
  swoopTone?.stop();
  drips?.play();
  swoopTone?.volume(0);
  swoopTone?.play();
  swoopTone?.fade(0, 1.0, 20000);
}
