import { createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';

const galaBrand: BrandVariants = {
  10: '#02060b',
  20: '#07111d',
  30: '#0b1f36',
  40: '#102d4c',
  50: '#173c61',
  60: '#204d77',
  70: '#2d5f8c',
  80: '#3d72a1',
  90: '#5686b4',
  100: '#719ac5',
  110: '#8daed3',
  120: '#aac2df',
  130: '#c5d5e9',
  140: '#dbe5f0',
  150: '#edf2f7',
  160: '#f8fafc',
};

export const galaLightTheme: Theme = {
  ...createLightTheme(galaBrand),
  colorBrandForeground1: '#9a7418',
  colorBrandForeground2: '#76570e',
  colorBrandBackground: '#0b1f36',
  colorBrandBackgroundHover: '#173c61',
  colorBrandBackgroundPressed: '#07111d',
  colorBrandStroke1: '#b78a1f',
  colorNeutralForeground1: '#0b1f36',
  colorNeutralForeground2: '#334155',
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground2: '#f8fafc',
  colorNeutralStroke1: '#d9e1ea',
  borderRadiusMedium: '10px',
  borderRadiusLarge: '16px',
};
