/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, StyleSheet } from 'react-native';

export const Palette = {
  primary: '#52677D',
  primaryHover: '#495C70',
  secondary: '#BDC4D4',
  secondarySurface: 'rgba(189, 196, 212, 0.22)',
  background: '#F8F9FB',
  text: '#0F1A2B',
  textSecondary: '#52677D',
  muted: '#7C8796',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  white72: 'rgba(255, 255, 255, 0.72)',
  white75: 'rgba(255, 255, 255, 0.75)',
  white76: 'rgba(255, 255, 255, 0.76)',
  white77: 'rgba(255, 255, 255, 0.77)',
  white87: 'rgba(255, 255, 255, 0.87)',
  white90: 'rgba(255, 255, 255, 0.9)',
  white94: 'rgba(255, 255, 255, 0.94)',
  border: 'rgba(82, 103, 125, 0.15)',
  shadow: 'rgba(15, 26, 43, 0.08)',
  helper: '#7C8796',
  dark: '#0F1A2B',
  success: '#4CAF50',
  successSurface: 'rgba(76, 175, 80, 0.12)',
  warning: '#F4B400',
  warningSurface: 'rgba(244, 180, 0, 0.16)',
  error: '#E53935',
  errorSurface: 'rgba(229, 57, 53, 0.10)',
} as const;

export const Colors = {
  light: {
    text: Palette.text,
    background: Palette.background,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.primary,
    textSecondary: Palette.textSecondary,
  },
  dark: {
    text: Palette.text,
    background: Palette.background,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.primary,
    textSecondary: Palette.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const VoiceAssistantStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    experimental_backgroundImage: `linear-gradient(180deg, ${Palette.secondary} 0%, ${Palette.background} 48%, ${Palette.background} 100%)`,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    alignItems: 'center',
  },
  accountRow: {
    width: '100%',
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  accountName: {
    color: Palette.dark,
    fontSize: 14,
  },
  signOut: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  title: {
    fontSize: 42,
    fontFamily: 'serif',
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Palette.primary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Palette.dark,
    opacity: 0.9,
  },
  centerStage: {
    flex: 1,
    flexShrink: 1,
    minHeight: 150,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundwave: {
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  waveBar: {
    width: 4,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    shadowColor: Palette.primary,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  waveBarBright: {
    backgroundColor: Palette.secondary,
  },
  responseArea: {
    width: '100%',
    maxHeight: 180,
    marginTop: 24,
    flexShrink: 1,
  },
  message: {
    backgroundColor: Palette.white94,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  assistantMessage: {
    backgroundColor: Palette.surface,
  },
  label: {
    color: Palette.dark,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
  },
  assistantLabel: {
    color: Palette.primary,
  },
  text: {
    color: Palette.dark,
    fontSize: 16,
    lineHeight: 24,
  },
  assistantText: {
    color: Palette.dark,
  },
  errorText: {
    color: Palette.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  bottomArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 190,
    flexShrink: 0,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  particleField: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleBorder: {
    width: 154,
    height: 154,
    borderRadius: 77,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: `linear-gradient(135deg, ${Palette.primary}, ${Palette.dark})`,
    shadowColor: Palette.primary,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  circleFill: {
    flex: 1,
    width: '100%',
    borderRadius: 100,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFillRecording: {
    backgroundColor: Palette.primary,
  },
  microphone: {
    width: 30,
    height: 42,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  microphoneHead: {
    width: 13,
    height: 25,
    borderRadius: 7,
    backgroundColor: Palette.surface,
  },
  microphoneStem: {
    position: 'absolute',
    top: 16,
    width: 25,
    height: 22,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: Palette.surface,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
  microphoneStand: {
    position: 'absolute',
    top: 36,
    width: 2,
    height: 6,
    backgroundColor: Palette.surface,
  },
  microphoneBase: {
    position: 'absolute',
    top: 41,
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: Palette.surface,
  },
  buttonLabel: {
    marginTop: 16,
    color: Palette.dark,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  particle: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: Palette.secondary,
    shadowColor: Palette.secondary,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  particleOne: {
    width: 5,
    height: 5,
    top: 36,
    left: '22%',
  },
  particleTwo: {
    width: 4,
    height: 4,
    top: 72,
    right: '20%',
  },
  particleThree: {
    width: 3,
    height: 3,
    bottom: 48,
    left: '30%',
  },
  particleFour: {
    width: 6,
    height: 6,
    bottom: 32,
    right: '28%',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: Palette.dark,
    fontSize: 14,
  },
});

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
