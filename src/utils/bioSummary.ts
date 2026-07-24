export interface BioInputData {
  fullName?: string;
  name?: string;
  quote?: string;
  graduationQuote?: string;
  favoriteMemory?: string;
  futureAmbition?: string;
  aspirations?: string;
  parentAppreciation?: string;
  parentMessage?: string;
  graduationYear?: string;
  class?: string;
  house?: string;
  graduationCategory?: string;
  bioSummary?: string;
}

/**
 * Synthesizes a cohesive, inspirational bio narrative summary describing the student
 * based on their quote, favorite school memories, future ambitions, and parent appreciation message.
 */
export function generateBioSummary(data: BioInputData): string {
  if (data.bioSummary && data.bioSummary.trim().length > 15) {
    return data.bioSummary.trim();
  }

  const name = (data.fullName || data.name || 'This graduate').trim();
  const rawQuote = (data.quote || data.graduationQuote || '').trim();
  const rawMemory = (data.favoriteMemory || '').trim();
  const rawAmbition = (data.futureAmbition || data.aspirations || '').trim();
  const rawParentMsg = (data.parentAppreciation || data.parentMessage || '').trim();
  const year = (data.graduationYear || '2026').trim();

  const cleanText = (str: string) => str.replace(/^["']|["']$/g, '').trim();

  const parts: string[] = [];

  // 1. Motto / Quote narrative
  if (rawQuote) {
    parts.push(`Guided by the motto "${cleanText(rawQuote)}", ${name} approaches life and learning with purpose and enthusiasm.`);
  } else {
    parts.push(`${name} is a proud graduate of the Class of ${year}.`);
  }

  // 2. Favorite Memory narrative
  if (rawMemory) {
    const memoryClean = cleanText(rawMemory);
    const startsWithVerbOrArticle = /^(the|a|an|winning|leading|playing|joining|my|our|when|during)/i.test(memoryClean);
    if (startsWithVerbOrArticle) {
      parts.push(`Reflecting on their school journey, ${name}'s most cherished memory is ${memoryClean}.`);
    } else {
      parts.push(`Reflecting on their school journey, ${name} fondly treasures ${memoryClean}.`);
    }
  }

  // 3. Future Ambition narrative
  if (rawAmbition) {
    const ambitionClean = cleanText(rawAmbition);
    const isFullSentence = /aspire|become|goal|aim|plans to|wants to/i.test(ambitionClean);
    if (isFullSentence) {
      parts.push(`Looking ahead with clear ambition, ${ambitionClean}.`);
    } else {
      const article = /^[aeiou]/i.test(ambitionClean) ? 'an' : 'a';
      const hasArticle = /^(a|an)\s+/i.test(ambitionClean);
      parts.push(`With big dreams for the future, ${name} aspires to excel as ${hasArticle ? ambitionClean : `${article} ${ambitionClean}`}.`);
    }
  }

  // 4. Parent Appreciation narrative
  if (rawParentMsg) {
    parts.push(`In a heartfelt message of gratitude, family notes: "${cleanText(rawParentMsg)}".`);
  }

  return parts.join(' ');
}
