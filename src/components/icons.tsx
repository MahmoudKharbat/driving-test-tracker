import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

/**
 * Line icons, drawn on a 24×24 grid to match the redesign mockup. Stroke-only
 * so they take the text colour they sit next to.
 */

interface IconProps {
  size?: number;
  color?: string;
}

function Stroke({
  size = 22,
  color = colors.text,
  width = 1.6,
  children,
}: IconProps & { width?: number; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Stroke {...p}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4-4" />
    </Stroke>
  );
}

export function MoreIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={5} cy={12} r={1.7} />
      <Circle cx={12} cy={12} r={1.7} />
      <Circle cx={19} cy={12} r={1.7} />
    </Svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Stroke width={1.8} {...p}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Stroke>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Stroke width={1.8} {...p}>
      <Path d="M12 5v14M5 12h14" />
    </Stroke>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Stroke width={2} {...p}>
      <Path d="M6 9l6 6 6-6" />
    </Stroke>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Stroke width={2} {...p}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Stroke>
  );
}

export function UserPlusIcon(p: IconProps) {
  return (
    <Stroke {...p}>
      <Circle cx={10} cy={8} r={4} />
      <Path d="M3 20c0-3.5 3-6 7-6M18 14v6M15 17h6" />
    </Stroke>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <Stroke {...p}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
    </Stroke>
  );
}

export function EyeOffIcon(p: IconProps) {
  return (
    <Stroke {...p}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
      <Path d="M4 4l16 16" />
    </Stroke>
  );
}

/** Steering wheel — the app's mark on the sign-in screen. */
export function WheelIcon(p: IconProps) {
  return (
    <Stroke {...p}>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={2.5} />
      <Path d="M3.5 10h6M14.5 10h6M12 14.5V21" />
    </Stroke>
  );
}
