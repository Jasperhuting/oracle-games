export interface SurveyAnswers {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export interface SurveyResponse {
  userId: string;
  userName: string;
  roundId: string;
  skipped: boolean;
  answers: SurveyAnswers;
  submittedAt: string; // ISO string aan client-kant
}

export interface SurveyQuestion {
  id: keyof SurveyAnswers;
  text: string;
  placeholder: string;
}
