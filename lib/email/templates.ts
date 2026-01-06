import { getServerFirebase } from '@/lib/firebase/server';
import { EmailTemplateType } from '@/lib/types/admin';

interface EmailTemplateTranslation {
  subject: string;
  body: string;
}

interface EmailTemplateData {
  type: EmailTemplateType;
  translations: {
    [locale: string]: EmailTemplateTranslation;
  };
  variables: string[];
}

/**
 * Get an email template from the database
 * Falls back to 'nl' locale if requested locale is not available
 */
export async function getEmailTemplate(
  type: EmailTemplateType,
  locale: string = 'nl'
): Promise<EmailTemplateTranslation | null> {
  try {
    const db = getServerFirebase();
    const doc = await db.collection('emailTemplates').doc(type).get();

    if (!doc.exists) {
      console.warn(`[EMAIL-TEMPLATES] Template not found: ${type}`);
      return null;
    }

    const data = doc.data() as EmailTemplateData;
    
    // Try requested locale, fall back to 'nl'
    const translation = data.translations[locale] || data.translations['nl'];
    
    if (!translation) {
      console.warn(`[EMAIL-TEMPLATES] No translation found for template ${type} in locale ${locale} or nl`);
      return null;
    }

    return translation;
  } catch (error) {
    console.error(`[EMAIL-TEMPLATES] Error fetching template ${type}:`, error);
    return null;
  }
}

/**
 * Replace template variables with actual values
 * Variables are in the format {{variableName}}
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

/**
 * Get and process an email template with variables replaced
 */
export async function getProcessedEmailTemplate(
  type: EmailTemplateType,
  variables: Record<string, string | number>,
  locale: string = 'nl'
): Promise<{ subject: string; body: string } | null> {
  const template = await getEmailTemplate(type, locale);
  
  if (!template) {
    return null;
  }

  return {
    subject: replaceTemplateVariables(template.subject, variables),
    body: replaceTemplateVariables(template.body, variables),
  };
}
