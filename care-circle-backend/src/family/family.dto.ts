import { IsIn } from 'class-validator';

export class DailyHealthCheckDto {
  @IsIn(['Fine', 'Not quite right', 'Not well at all'])
  feeling!: 'Fine' | 'Not quite right' | 'Not well at all';

  @IsIn(['Yes', 'Somewhat', 'No'])
  sleptWell!: 'Yes' | 'Somewhat' | 'No';

  @IsIn(['No', 'Yes'])
  pain!: 'No' | 'Yes';

  @IsIn(['Yes', 'Not yet'])
  breakfast!: 'Yes' | 'Not yet';
}
