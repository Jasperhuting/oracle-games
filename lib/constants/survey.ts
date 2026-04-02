import type { SurveyQuestion } from '@/lib/types/survey';

export const SURVEY_ROUND_ID = '2026-Q2';

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'q1',
    text: 'Wat mis je nog op de website?',
    placeholder: 'Bijv. meer statistieken, een bepaalde functie...',
  },
  {
    id: 'q2',
    text: 'Gebruik je het forum? Wat zou het beter maken?',
    placeholder: 'Bijv. betere notificaties, meer categorieën...',
  },
  {
    id: 'q3',
    text: 'Mis je nog spellen die je graag zou willen spelen?',
    placeholder: 'Bijv. een ander type fantasy spel, een andere sport...',
  },
  {
    id: 'q4',
    text: 'Gebruik je de website vooral op je pc of op je telefoon, en hoe bevalt dat?',
    placeholder: 'Bijv. op telefoon werkt de lay-out niet prettig, of juist wel...',
  },
  {
    id: 'q5',
    text: 'Is er iets wat je frustrerend vindt aan de huidige website?',
    placeholder: 'Alles mag, ook kleine ergernissen...',
  },
  {
    id: 'q6',
    text: 'Heb je nog andere feedback of suggesties?',
    placeholder: 'Alles wat je kwijt wilt...',
  },
];
