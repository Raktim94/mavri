import { Font } from '@react-pdf/renderer';
import Inter_18pt_Bold from '../../../assets/inter/Inter_18pt-Bold.ttf';
import Inter_18pt_BoldItalic from '../../../assets/inter/Inter_18pt-BoldItalic.ttf';
import Inter_18pt_Italic from '../../../assets/inter/Inter_18pt-Italic.ttf';
import Inter_18pt_Medium from '../../../assets/inter/Inter_18pt-Medium.ttf';
import Inter_18pt_MediumItalic from '../../../assets/inter/Inter_18pt-MediumItalic.ttf';
import Inter_18pt_Regular from '../../../assets/inter/Inter_18pt-Regular.ttf';
import Inter_18pt_SemiBold from '../../../assets/inter/Inter_18pt-SemiBold.ttf';
import Inter_18pt_SemiBoldItalic from '../../../assets/inter/Inter_18pt-SemiBoldItalic.ttf';
import Inter_24pt_Bold from '../../../assets/inter/Inter_24pt-Bold.ttf';
import Inter_24pt_BoldItalic from '../../../assets/inter/Inter_24pt-BoldItalic.ttf';
import Inter_24pt_Italic from '../../../assets/inter/Inter_24pt-Italic.ttf';
import Inter_24pt_Medium from '../../../assets/inter/Inter_24pt-Medium.ttf';
import Inter_24pt_MediumItalic from '../../../assets/inter/Inter_24pt-MediumItalic.ttf';
import Inter_24pt_Regular from '../../../assets/inter/Inter_24pt-Regular.ttf';
import Inter_24pt_SemiBold from '../../../assets/inter/Inter_24pt-SemiBold.ttf';
import Inter_24pt_SemiBoldItalic from '../../../assets/inter/Inter_24pt-SemiBoldItalic.ttf';
import Inter_28pt_Bold from '../../../assets/inter/Inter_28pt-Bold.ttf';
import Inter_28pt_BoldItalic from '../../../assets/inter/Inter_28pt-BoldItalic.ttf';
import Inter_28pt_Italic from '../../../assets/inter/Inter_28pt-Italic.ttf';
import Inter_28pt_Medium from '../../../assets/inter/Inter_28pt-Medium.ttf';
import Inter_28pt_MediumItalic from '../../../assets/inter/Inter_28pt-MediumItalic.ttf';
import Inter_28pt_Regular from '../../../assets/inter/Inter_28pt-Regular.ttf';
import Inter_28pt_SemiBold from '../../../assets/inter/Inter_28pt-SemiBold.ttf';
import Inter_28pt_SemiBoldItalic from '../../../assets/inter/Inter_28pt-SemiBoldItalic.ttf';
import RobotoBold from '../../../assets/roboto/Roboto-Bold.ttf';
import RobotoBoldItalic from '../../../assets/roboto/Roboto-BoldItalic.ttf';
import RobotoItalic from '../../../assets/roboto/Roboto-Italic.ttf';
import RobotoMedium from '../../../assets/roboto/Roboto-Medium.ttf';
import RobotoMediumItalic from '../../../assets/roboto/Roboto-MediumItalic.ttf';
import RobotoRegular from '../../../assets/roboto/Roboto-Regular.ttf';
import RobotoSemiBold from '../../../assets/roboto/Roboto-SemiBold.ttf';
import RobotoSemiBoldItalic from '../../../assets/roboto/Roboto-SemiBoldItalic.ttf';

const ROBOTO: Array<{ weight: number; italic?: boolean; src: string }> = [
  { weight: 400, src: RobotoRegular },
  { weight: 500, src: RobotoMedium },
  { weight: 600, src: RobotoSemiBold },
  { weight: 700, src: RobotoBold },
  { weight: 400, italic: true, src: RobotoItalic },
  { weight: 500, italic: true, src: RobotoMediumItalic },
  { weight: 600, italic: true, src: RobotoSemiBoldItalic },
  { weight: 700, italic: true, src: RobotoBoldItalic }
];

const INTER_REGULARS = [Inter_18pt_Regular, Inter_24pt_Regular, Inter_28pt_Regular];
const INTER_MEDIUMS = [Inter_18pt_Medium, Inter_24pt_Medium, Inter_28pt_Medium];
const INTER_SEMIBOLDS = [Inter_18pt_SemiBold, Inter_24pt_SemiBold, Inter_28pt_SemiBold];
const INTER_BOLDS = [Inter_18pt_Bold, Inter_24pt_Bold, Inter_28pt_Bold];
const INTER_ITALICS = [Inter_18pt_Italic, Inter_24pt_Italic, Inter_28pt_Italic];
const INTER_MEDIUM_ITALICS = [Inter_18pt_MediumItalic, Inter_24pt_MediumItalic, Inter_28pt_MediumItalic];
const INTER_SEMIBOLD_ITALICS = [Inter_18pt_SemiBoldItalic, Inter_24pt_SemiBoldItalic, Inter_28pt_SemiBoldItalic];
const INTER_BOLD_ITALICS = [Inter_18pt_BoldItalic, Inter_24pt_BoldItalic, Inter_28pt_BoldItalic];

const INTER: Array<{ weight: number; italic?: boolean; src: string }> = [
  ...INTER_REGULARS.map(src => ({ weight: 400, src })),
  ...INTER_MEDIUMS.map(src => ({ weight: 500, src })),
  ...INTER_SEMIBOLDS.map(src => ({ weight: 600, src })),
  ...INTER_BOLDS.map(src => ({ weight: 700, src })),
  ...INTER_ITALICS.map(src => ({ weight: 400, italic: true, src })),
  ...INTER_MEDIUM_ITALICS.map(src => ({ weight: 500, italic: true, src })),
  ...INTER_SEMIBOLD_ITALICS.map(src => ({ weight: 600, italic: true, src })),
  ...INTER_BOLD_ITALICS.map(src => ({ weight: 700, italic: true, src }))
];

const registerFamily = (family: string, fonts: Array<{ weight: number; italic?: boolean; src: string }>): void => {
  fonts.forEach(({ weight, italic, src }) => {
    Font.register(
      italic ? { family, src, fontWeight: weight, fontStyle: 'italic' } : { family, src, fontWeight: weight }
    );
  });
};

let fontsRegistered = false;

export const registerPdfFonts = (): void => {
  if (fontsRegistered) return;
  fontsRegistered = true;

  registerFamily('Roboto', ROBOTO);
  registerFamily('Inter', INTER);
};
