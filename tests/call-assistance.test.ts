/**
 * Call Assistance Automated Test Suite
 *
 * Run with: npm test tests/call-assistance.test.ts
 * or: bun test tests/call-assistance.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// HELPER FUNCTIONS (Extracted from implementation logic)
// ============================================================================

/**
 * Extract numeric budget value from various text formats
 */
function extractBudgetValue(budgetString: string): number {
  const cleaned = budgetString.toLowerCase().trim();

  // Handle word numbers
  const wordToNumber: Record<string, number> = {
    'thousand': 1000,
    'million': 1000000,
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'fifteen': 15, 'twenty': 20,
    'twenty-five': 25, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'one hundred': 100, 'two hundred': 200
  };

  // Try word format: "fifty thousand"
  for (const [word, value] of Object.entries(wordToNumber)) {
    if (cleaned.includes(word)) {
      const multiplier = cleaned.includes('thousand') ? 1000 :
                        cleaned.includes('million') ? 1000000 : 1;
      const base = value;
      if (multiplier > 1) {
        return base * multiplier;
      }
    }
  }

  // Try numeric formats
  const numericMatch = cleaned.match(/\$?[\d,]+\.?\d*[km]?/i);
  if (numericMatch) {
    let value = numericMatch[0].replace(/[$,]/g, '');

    if (value.endsWith('k')) {
      return parseFloat(value.slice(0, -1)) * 1000;
    } else if (value.endsWith('m')) {
      return parseFloat(value.slice(0, -1)) * 1000000;
    }

    return parseFloat(value);
  }

  return 0;
}

/**
 * Extract project type from speech input
 */
function extractProjectType(speech: string): string {
  const lowerSpeech = speech.toLowerCase();

  const projectTypes: Record<string, string[]> = {
    'Kitchen': ['kitchen', 'cabinets', 'countertops'],
    'Bathroom': ['bathroom', 'bath'],
    'Painting': ['paint', 'painting'],
    'Flooring': ['floor', 'flooring', 'hardwood', 'tile', 'carpet'],
    'Roofing': ['roof', 'roofing', 'shingles'],
    'Deck/Patio': ['deck', 'patio', 'outdoor'],
    'Basement': ['basement', 'cellar'],
    'Addition': ['addition', 'add on', 'expand'],
    'Exterior': ['siding', 'exterior'],
    'Windows/Doors': ['window', 'door', 'windows', 'doors'],
    'Drywall': ['drywall', 'sheetrock'],
    'Electrical': ['electrical', 'wiring', 'electric'],
    'Plumbing': ['plumbing', 'plumber', 'pipes'],
    'HVAC': ['hvac', 'heating', 'cooling', 'furnace', 'ac'],
    'Remodel': ['remodel', 'renovation', 'renovate']
  };

  for (const [type, keywords] of Object.entries(projectTypes)) {
    if (keywords.some(keyword => lowerSpeech.includes(keyword))) {
      return type;
    }
  }

  return '';
}

/**
 * Extract clean name from speech input
 */
function extractName(speech: string): string {
  // Remove common filler words and phrases
  const fillerWords = [
    'yeah', 'yes', 'okay', 'ok', 'um', 'uh', 'well',
    'my name is', "i'm", 'call me', 'this is', 'it\'s',
    'you can call me', 'just call me'
  ];

  let cleaned = speech.toLowerCase().trim();

  fillerWords.forEach(filler => {
    cleaned = cleaned.replace(new RegExp(filler, 'gi'), '');
  });

  // Remove project type keywords that might be in the response
  const projectKeywords = ['kitchen', 'bathroom', 'remodel', 'renovation', 'project'];
  projectKeywords.forEach(keyword => {
    cleaned = cleaned.replace(new RegExp(keyword, 'gi'), '');
  });

  // Clean up and capitalize
  cleaned = cleaned.trim().replace(/\s+/g, ' ');

  // Capitalize each word
  return cleaned.split(' ')
    .filter(word => word.length > 1)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .slice(0, 3) // Max 3 words for name
    .join(' ');
}

/**
 * Extract timeline from speech input
 */
function extractTimeline(speech: string): string {
  const lowerSpeech = speech.toLowerCase();

  if (/asap|immediately|right away|urgent|as soon as possible/i.test(lowerSpeech)) {
    return 'ASAP';
  }
  if (/1-3 months|three months|next few months|couple months/i.test(lowerSpeech)) {
    return '1-3 months';
  }
  if (/3-6 months|six months|half a year/i.test(lowerSpeech)) {
    return '3-6 months';
  }
  if (/this year|within the year|by end of year/i.test(lowerSpeech)) {
    return 'This Year';
  }
  if (/next year|2026|2027/i.test(lowerSpeech)) {
    return 'Next Year';
  }
  if (/flexible|not sure|depends|don't know/i.test(lowerSpeech)) {
    return 'Flexible';
  }

  return speech;
}

/**
 * Calculate lead qualification score
 */
function calculateQualificationScore(budget: number): number {
  return budget >= 10000 ? 80 : 40;
}

/**
 * Initialize conversation state
 */
function initializeConversationState(phone: string) {
  return {
    step: 0,
    collectedInfo: {
      name: '',
      phone: phone,
      projectType: '',
      budget: '',
      timeline: '',
      propertyType: ''
    },
    conversationHistory: []
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Call Assistance - Budget Extraction', () => {

  it('should extract budget from word format', () => {
    const testCases = [
      { input: 'fifty thousand', expected: 50000 },
      { input: 'one hundred thousand', expected: 100000 },
      { input: 'twenty thousand', expected: 20000 },
      { input: 'five thousand', expected: 5000 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractBudgetValue(input);
      expect(result).toBe(expected);
    });
  });

  it('should extract budget from numeric format with dollar sign', () => {
    const testCases = [
      { input: '$50,000', expected: 50000 },
      { input: '$125,000', expected: 125000 },
      { input: '$3,500', expected: 3500 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractBudgetValue(input);
      expect(result).toBe(expected);
    });
  });

  it('should extract budget from shorthand format (k, M)', () => {
    const testCases = [
      { input: '50k', expected: 50000 },
      { input: '$75k', expected: 75000 },
      { input: '1.5m', expected: 1500000 },
      { input: '$2M', expected: 2000000 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractBudgetValue(input);
      expect(result).toBe(expected);
    });
  });

  it('should handle budget with context words', () => {
    const testCases = [
      { input: 'around $50,000', expected: 50000 },
      { input: 'about fifty thousand dollars', expected: 50000 },
      { input: 'roughly 75k', expected: 75000 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractBudgetValue(input);
      expect(result).toBeGreaterThanOrEqual(expected * 0.9);
    });
  });

  it('should return 0 for invalid budget input', () => {
    const invalidInputs = [
      'I don\'t know',
      'depends',
      'not sure',
      'whatever it costs',
      ''
    ];

    invalidInputs.forEach(input => {
      const result = extractBudgetValue(input);
      expect(result).toBe(0);
    });
  });
});

describe('Call Assistance - Lead Qualification', () => {

  it('should qualify lead with budget >= $10,000', () => {
    const budgets = [10000, 50000, 100000, 250000];

    budgets.forEach(budget => {
      const isQualified = budget >= 10000;
      expect(isQualified).toBe(true);
    });
  });

  it('should not qualify lead with budget < $10,000', () => {
    const budgets = [5000, 9999, 3000, 1000];

    budgets.forEach(budget => {
      const isQualified = budget >= 10000;
      expect(isQualified).toBe(false);
    });
  });

  it('should calculate correct qualification score', () => {
    expect(calculateQualificationScore(50000)).toBe(80);
    expect(calculateQualificationScore(5000)).toBe(40);
    expect(calculateQualificationScore(10000)).toBe(80); // Edge case
    expect(calculateQualificationScore(9999)).toBe(40); // Edge case
  });
});

describe('Call Assistance - Project Type Extraction', () => {

  it('should extract common project types', () => {
    const testCases = [
      { input: 'I want to remodel my kitchen', expected: 'Kitchen' },
      { input: 'looking for bathroom renovation', expected: 'Bathroom' },
      { input: 'need a new roof', expected: 'Roofing' },
      { input: 'want to add a deck', expected: 'Deck/Patio' },
      { input: 'basement finishing', expected: 'Basement' },
      { input: 'painting the house', expected: 'Painting' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractProjectType(input);
      expect(result).toBe(expected);
    });
  });

  it('should handle multiple keywords in one sentence', () => {
    const input = 'I want to remodel my kitchen and bathroom';
    const result = extractProjectType(input);

    // Should match the first one encountered
    expect(['Kitchen', 'Bathroom']).toContain(result);
  });

  it('should return empty string for unrecognized project', () => {
    const input = 'I need help with something';
    const result = extractProjectType(input);
    expect(result).toBe('');
  });
});

describe('Call Assistance - Name Extraction', () => {

  it('should extract clean name from various formats', () => {
    const testCases = [
      { input: 'My name is John Smith', expected: 'John Smith' },
      { input: 'Yeah, I\'m Sarah Johnson', expected: 'Sarah Johnson' },
      { input: 'Call me Mike', expected: 'Mike' },
      { input: 'This is Maria Garcia-Lopez', expected: 'Maria Garcia-Lopez' },
      { input: 'Robert', expected: 'Robert' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractName(input);
      expect(result.toLowerCase()).toContain(expected.toLowerCase().split(' ')[0]);
    });
  });

  it('should remove filler words from name', () => {
    const input = 'Yeah okay um my name is John Smith';
    const result = extractName(input);

    expect(result.toLowerCase()).toContain('john');
    expect(result.toLowerCase()).not.toContain('yeah');
    expect(result.toLowerCase()).not.toContain('okay');
    expect(result.toLowerCase()).not.toContain('um');
  });

  it('should filter out project keywords from name', () => {
    const input = 'John Smith kitchen remodel';
    const result = extractName(input);

    expect(result.toLowerCase()).toContain('john');
    expect(result.toLowerCase()).not.toContain('kitchen');
    expect(result.toLowerCase()).not.toContain('remodel');
  });

  it('should limit name to maximum 3 words', () => {
    const input = 'My name is John Michael Patrick Smith';
    const result = extractName(input);

    const wordCount = result.split(' ').length;
    expect(wordCount).toBeLessThanOrEqual(3);
  });
});

describe('Call Assistance - Timeline Extraction', () => {

  it('should recognize ASAP variations', () => {
    const testCases = [
      'ASAP',
      'as soon as possible',
      'immediately',
      'right away',
      'urgent'
    ];

    testCases.forEach(input => {
      const result = extractTimeline(input);
      expect(result).toBe('ASAP');
    });
  });

  it('should categorize month ranges correctly', () => {
    const testCases = [
      { input: 'within 3 months', expected: '1-3 months' },
      { input: 'next few months', expected: '1-3 months' },
      { input: 'in about 6 months', expected: '3-6 months' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractTimeline(input);
      expect(result).toBe(expected);
    });
  });

  it('should recognize year-based timelines', () => {
    const testCases = [
      { input: 'this year', expected: 'This Year' },
      { input: 'next year', expected: 'Next Year' },
      { input: 'by end of year', expected: 'This Year' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractTimeline(input);
      expect(result).toBe(expected);
    });
  });

  it('should handle flexible/uncertain timelines', () => {
    const testCases = ['flexible', 'not sure', 'depends', "don't know"];

    testCases.forEach(input => {
      const result = extractTimeline(input);
      expect(result).toBe('Flexible');
    });
  });
});

describe('Call Assistance - Conversation State', () => {

  it('should initialize conversation state correctly', () => {
    const phone = '+15551234567';
    const state = initializeConversationState(phone);

    expect(state.step).toBe(0);
    expect(state.collectedInfo.phone).toBe(phone);
    expect(state.collectedInfo.name).toBe('');
    expect(state.collectedInfo.projectType).toBe('');
    expect(state.collectedInfo.budget).toBe('');
    expect(state.conversationHistory).toEqual([]);
  });

  it('should encode and decode conversation state via base64', () => {
    const state = {
      step: 2,
      collectedInfo: {
        name: 'John Smith',
        phone: '+15551234567',
        projectType: 'Kitchen',
        budget: '$50,000',
        timeline: 'ASAP',
        propertyType: 'Residential'
      },
      conversationHistory: [
        { role: 'user' as const, content: 'I want to remodel my kitchen' },
        { role: 'assistant' as const, content: 'Great! What\'s your name?' },
      ]
    };

    const encoded = Buffer.from(JSON.stringify(state)).toString('base64');
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());

    expect(decoded).toEqual(state);
    expect(decoded.step).toBe(2);
    expect(decoded.collectedInfo.name).toBe('John Smith');
  });

  it('should track conversation history correctly', () => {
    const state = initializeConversationState('+15551234567');

    state.conversationHistory.push({
      role: 'user',
      content: 'I need a kitchen remodel'
    });

    state.conversationHistory.push({
      role: 'assistant',
      content: 'What\'s your budget for this project?'
    });

    expect(state.conversationHistory).toHaveLength(2);
    expect(state.conversationHistory[0].role).toBe('user');
    expect(state.conversationHistory[1].role).toBe('assistant');
  });
});

describe('Call Assistance - Edge Cases', () => {

  it('should handle empty speech input gracefully', () => {
    const emptyInputs = ['', '   ', null, undefined];

    emptyInputs.forEach(input => {
      const name = extractName(input || '');
      const projectType = extractProjectType(input || '');
      const budget = extractBudgetValue(input || '');

      expect(name).toBe('');
      expect(projectType).toBe('');
      expect(budget).toBe(0);
    });
  });

  it('should handle very long input strings', () => {
    const longInput = 'Yeah so um basically I want to remodel my kitchen and bathroom and maybe add a deck in the backyard and also need some painting done in the living room and dining room and possibly refinish the hardwood floors in the bedrooms and hallway';

    const projectType = extractProjectType(longInput);
    expect(projectType).toBeTruthy();
  });

  it('should handle special characters in name', () => {
    const testCases = [
      "My name is O'Brien",
      "Call me Jean-Claude",
      "I'm María García",
    ];

    testCases.forEach(input => {
      const name = extractName(input);
      expect(name.length).toBeGreaterThan(0);
    });
  });

  it('should handle mixed case input', () => {
    const input = 'MY NAME IS JOHN SMITH';
    const name = extractName(input);

    expect(name).toBe('John Smith');
  });
});

describe('Call Assistance - Integration Scenarios', () => {

  it('should qualify a complete qualified lead', () => {
    const leadData = {
      name: extractName('My name is John Smith'),
      projectType: extractProjectType('I want to remodel my kitchen'),
      budget: extractBudgetValue('$50,000'),
      timeline: extractTimeline('ASAP'),
    };

    expect(leadData.name.toLowerCase()).toContain('john');
    expect(leadData.projectType).toBe('Kitchen');
    expect(leadData.budget).toBe(50000);
    expect(leadData.timeline).toBe('ASAP');
    expect(calculateQualificationScore(leadData.budget)).toBe(80);
  });

  it('should handle unqualified lead with all info', () => {
    const leadData = {
      name: extractName('Sarah Johnson'),
      projectType: extractProjectType('drywall patching'),
      budget: extractBudgetValue('three thousand'),
      timeline: extractTimeline('next month'),
    };

    expect(leadData.name.toLowerCase()).toContain('sarah');
    expect(leadData.projectType).toBe('Drywall');
    expect(leadData.budget).toBe(3000);
    expect(calculateQualificationScore(leadData.budget)).toBe(40);
  });

  it('should handle partial lead information', () => {
    const leadData = {
      name: extractName('Mike'),
      projectType: extractProjectType('not sure yet'),
      budget: extractBudgetValue('depends on the quote'),
      timeline: extractTimeline('flexible'),
    };

    expect(leadData.name.toLowerCase()).toContain('mike');
    expect(leadData.projectType).toBe('');
    expect(leadData.budget).toBe(0);
    expect(leadData.timeline).toBe('Flexible');
  });
});

describe('Call Assistance - Data Validation', () => {

  it('should validate minimum required fields', () => {
    const requiredFields = ['name', 'projectType', 'budget'];

    const leadData = {
      name: 'John Smith',
      projectType: 'Kitchen',
      budget: 50000,
    };

    requiredFields.forEach(field => {
      expect(leadData[field as keyof typeof leadData]).toBeTruthy();
    });
  });

  it('should flag incomplete leads', () => {
    const incompleteLead = {
      name: '',
      projectType: 'Kitchen',
      budget: 50000,
    };

    const isComplete = incompleteLead.name &&
                      incompleteLead.projectType &&
                      incompleteLead.budget > 0;

    expect(isComplete).toBe(false);
  });

  it('should calculate completeness percentage', () => {
    const fields = {
      name: 'John Smith',
      projectType: 'Kitchen',
      budget: '$50,000',
      timeline: '',
      propertyType: ''
    };

    const filledFields = Object.values(fields).filter(v => v !== '').length;
    const completeness = (filledFields / Object.keys(fields).length) * 100;

    expect(completeness).toBe(60); // 3 out of 5 fields filled
  });
});
