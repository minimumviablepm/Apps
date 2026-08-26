/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-av is not available under the node test environment; the sound layer is
// exercised through its own pure registry instead.
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(async () => {}),
    Sound: { createAsync: jest.fn(async () => ({ sound: { playAsync: jest.fn(), setPositionAsync: jest.fn(), unloadAsync: jest.fn(), setIsLoopingAsync: jest.fn(), stopAsync: jest.fn(), setVolumeAsync: jest.fn() } })) },
  },
}));
