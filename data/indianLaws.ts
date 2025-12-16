/**
 * Indian Laws Database for NyayaSutra
 * Contains state-specific acts, court jurisdiction mappings, and legal context
 */

// Indian States and Union Territories
export type IndianState =
  | 'Andhra Pradesh' | 'Arunachal Pradesh' | 'Assam' | 'Bihar' | 'Chhattisgarh'
  | 'Goa' | 'Gujarat' | 'Haryana' | 'Himachal Pradesh' | 'Jharkhand'
  | 'Karnataka' | 'Kerala' | 'Madhya Pradesh' | 'Maharashtra' | 'Manipur'
  | 'Meghalaya' | 'Mizoram' | 'Nagaland' | 'Odisha' | 'Punjab'
  | 'Rajasthan' | 'Sikkim' | 'Tamil Nadu' | 'Telangana' | 'Tripura'
  | 'Uttar Pradesh' | 'Uttarakhand' | 'West Bengal'
  | 'Delhi' | 'Jammu and Kashmir' | 'Ladakh' | 'Puducherry'
  | 'Chandigarh' | 'Andaman and Nicobar Islands' | 'Dadra and Nagar Haveli and Daman and Diu' | 'Lakshadweep';

// Court levels in Indian judiciary
export type CourtLevel = 'supreme' | 'high' | 'district' | 'tribunal' | 'magistrate' | 'sessions';

// High Court Jurisdiction Mapping
export interface HighCourtJurisdiction {
  name: string;
  code: string;
  states: IndianState[];
  establishedYear: number;
  benchLocations: string[];
}

export const HIGH_COURTS: HighCourtJurisdiction[] = [
  {
    name: 'Supreme Court of India',
    code: 'SCI',
    states: [], // Apex court - all India
    establishedYear: 1950,
    benchLocations: ['New Delhi']
  },
  {
    name: 'Allahabad High Court',
    code: 'AHC',
    states: ['Uttar Pradesh'],
    establishedYear: 1866,
    benchLocations: ['Allahabad', 'Lucknow']
  },
  {
    name: 'Andhra Pradesh High Court',
    code: 'APHC',
    states: ['Andhra Pradesh'],
    establishedYear: 2019,
    benchLocations: ['Amaravati']
  },
  {
    name: 'Bombay High Court',
    code: 'BHC',
    states: ['Maharashtra', 'Goa', 'Dadra and Nagar Haveli and Daman and Diu'],
    establishedYear: 1862,
    benchLocations: ['Mumbai', 'Nagpur', 'Aurangabad', 'Panaji']
  },
  {
    name: 'Calcutta High Court',
    code: 'CHC',
    states: ['West Bengal', 'Andaman and Nicobar Islands'],
    establishedYear: 1862,
    benchLocations: ['Kolkata', 'Port Blair']
  },
  {
    name: 'Chhattisgarh High Court',
    code: 'CGHC',
    states: ['Chhattisgarh'],
    establishedYear: 2000,
    benchLocations: ['Bilaspur']
  },
  {
    name: 'Delhi High Court',
    code: 'DHC',
    states: ['Delhi'],
    establishedYear: 1966,
    benchLocations: ['New Delhi']
  },
  {
    name: 'Gauhati High Court',
    code: 'GHC',
    states: ['Assam', 'Nagaland', 'Mizoram', 'Arunachal Pradesh'],
    establishedYear: 1948,
    benchLocations: ['Guwahati', 'Kohima', 'Aizawl', 'Itanagar']
  },
  {
    name: 'Gujarat High Court',
    code: 'GJHC',
    states: ['Gujarat'],
    establishedYear: 1960,
    benchLocations: ['Ahmedabad']
  },
  {
    name: 'Himachal Pradesh High Court',
    code: 'HPHC',
    states: ['Himachal Pradesh'],
    establishedYear: 1971,
    benchLocations: ['Shimla']
  },
  {
    name: 'Jammu and Kashmir High Court',
    code: 'JKHC',
    states: ['Jammu and Kashmir', 'Ladakh'],
    establishedYear: 1928,
    benchLocations: ['Srinagar', 'Jammu']
  },
  {
    name: 'Jharkhand High Court',
    code: 'JHHC',
    states: ['Jharkhand'],
    establishedYear: 2000,
    benchLocations: ['Ranchi']
  },
  {
    name: 'Karnataka High Court',
    code: 'KHC',
    states: ['Karnataka'],
    establishedYear: 1884,
    benchLocations: ['Bengaluru', 'Dharwad', 'Kalaburagi']
  },
  {
    name: 'Kerala High Court',
    code: 'KLHC',
    states: ['Kerala', 'Lakshadweep'],
    establishedYear: 1958,
    benchLocations: ['Kochi']
  },
  {
    name: 'Madhya Pradesh High Court',
    code: 'MPHC',
    states: ['Madhya Pradesh'],
    establishedYear: 1956,
    benchLocations: ['Jabalpur', 'Gwalior', 'Indore']
  },
  {
    name: 'Madras High Court',
    code: 'MHC',
    states: ['Tamil Nadu', 'Puducherry'],
    establishedYear: 1862,
    benchLocations: ['Chennai', 'Madurai']
  },
  {
    name: 'Manipur High Court',
    code: 'MNHC',
    states: ['Manipur'],
    establishedYear: 2013,
    benchLocations: ['Imphal']
  },
  {
    name: 'Meghalaya High Court',
    code: 'MGHC',
    states: ['Meghalaya'],
    establishedYear: 2013,
    benchLocations: ['Shillong']
  },
  {
    name: 'Orissa High Court',
    code: 'OHC',
    states: ['Odisha'],
    establishedYear: 1948,
    benchLocations: ['Cuttack']
  },
  {
    name: 'Patna High Court',
    code: 'PHC',
    states: ['Bihar'],
    establishedYear: 1916,
    benchLocations: ['Patna']
  },
  {
    name: 'Punjab and Haryana High Court',
    code: 'P&HHC',
    states: ['Punjab', 'Haryana', 'Chandigarh'],
    establishedYear: 1966,
    benchLocations: ['Chandigarh']
  },
  {
    name: 'Rajasthan High Court',
    code: 'RHC',
    states: ['Rajasthan'],
    establishedYear: 1949,
    benchLocations: ['Jodhpur', 'Jaipur']
  },
  {
    name: 'Sikkim High Court',
    code: 'SHC',
    states: ['Sikkim'],
    establishedYear: 1975,
    benchLocations: ['Gangtok']
  },
  {
    name: 'Telangana High Court',
    code: 'THC',
    states: ['Telangana'],
    establishedYear: 2019,
    benchLocations: ['Hyderabad']
  },
  {
    name: 'Tripura High Court',
    code: 'TRHC',
    states: ['Tripura'],
    establishedYear: 2013,
    benchLocations: ['Agartala']
  },
  {
    name: 'Uttarakhand High Court',
    code: 'UKHC',
    states: ['Uttarakhand'],
    establishedYear: 2000,
    benchLocations: ['Nainital']
  }
];

// State-specific Acts Database
export interface StateSpecificAct {
  name: string;
  shortName: string;
  year: number;
  states: IndianState[] | 'all'; // 'all' for central acts
  category: 'property' | 'family' | 'criminal' | 'civil' | 'revenue' | 'labour' | 'commercial' | 'administrative' | 'environmental';
  description: string;
  keyProvisions?: string[];
}

export const STATE_SPECIFIC_ACTS: StateSpecificAct[] = [
  // Central Acts (applicable to all states)
  {
    name: 'Indian Penal Code',
    shortName: 'IPC',
    year: 1860,
    states: 'all',
    category: 'criminal',
    description: 'Main criminal code of India defining offences and punishments',
    keyProvisions: ['Section 302 - Murder', 'Section 420 - Cheating', 'Section 498A - Cruelty by husband']
  },
  {
    name: 'Code of Criminal Procedure',
    shortName: 'CrPC',
    year: 1973,
    states: 'all',
    category: 'criminal',
    description: 'Procedural law for criminal cases',
    keyProvisions: ['Section 154 - FIR', 'Section 161 - Examination of witnesses', 'Section 439 - Bail']
  },
  {
    name: 'Code of Civil Procedure',
    shortName: 'CPC',
    year: 1908,
    states: 'all',
    category: 'civil',
    description: 'Procedural law for civil cases',
    keyProvisions: ['Order VII - Plaint', 'Order VIII - Written Statement', 'Order XXXIX - Temporary Injunctions']
  },
  {
    name: 'Indian Evidence Act',
    shortName: 'IEA',
    year: 1872,
    states: 'all',
    category: 'civil',
    description: 'Law governing admissibility of evidence in Indian courts',
    keyProvisions: ['Section 3 - Evidence defined', 'Section 65B - Electronic records', 'Section 114 - Presumptions']
  },
  {
    name: 'Transfer of Property Act',
    shortName: 'TPA',
    year: 1882,
    states: 'all',
    category: 'property',
    description: 'Law governing transfer of property between living persons',
    keyProvisions: ['Section 54 - Sale', 'Section 58 - Mortgage', 'Section 105 - Lease']
  },
  {
    name: 'Indian Contract Act',
    shortName: 'ICA',
    year: 1872,
    states: 'all',
    category: 'commercial',
    description: 'Law governing contracts in India',
    keyProvisions: ['Section 2 - Definitions', 'Section 10 - Valid contracts', 'Section 73 - Compensation']
  },
  {
    name: 'Specific Relief Act',
    shortName: 'SRA',
    year: 1963,
    states: 'all',
    category: 'civil',
    description: 'Law for specific performance and other equitable reliefs',
    keyProvisions: ['Section 10 - Specific performance', 'Section 38 - Perpetual injunction']
  },
  {
    name: 'Limitation Act',
    shortName: 'LA',
    year: 1963,
    states: 'all',
    category: 'civil',
    description: 'Law prescribing time limits for legal proceedings',
    keyProvisions: ['Article 54 - Suit for specific performance (3 years)', 'Article 65 - Suit for possession (12 years)']
  },
  {
    name: 'Arbitration and Conciliation Act',
    shortName: 'A&C Act',
    year: 1996,
    states: 'all',
    category: 'commercial',
    description: 'Law governing arbitration and alternative dispute resolution',
    keyProvisions: ['Section 9 - Interim measures', 'Section 34 - Challenge to award', 'Section 36 - Enforcement']
  },
  {
    name: 'Negotiable Instruments Act',
    shortName: 'NI Act',
    year: 1881,
    states: 'all',
    category: 'commercial',
    description: 'Law governing promissory notes, bills of exchange, and cheques',
    keyProvisions: ['Section 138 - Dishonour of cheque', 'Section 142 - Cognizance']
  },

  // State-specific Property Laws
  {
    name: 'Maharashtra Rent Control Act',
    shortName: 'MRCA',
    year: 1999,
    states: ['Maharashtra'],
    category: 'property',
    description: 'Rent control legislation for Maharashtra',
    keyProvisions: ['Section 15 - Eviction grounds', 'Section 16 - Subletting restrictions']
  },
  {
    name: 'Delhi Rent Control Act',
    shortName: 'DRCA',
    year: 1958,
    states: ['Delhi'],
    category: 'property',
    description: 'Rent control legislation for Delhi',
    keyProvisions: ['Section 14 - Eviction grounds', 'Section 25B - Summary procedure']
  },
  {
    name: 'Tamil Nadu Buildings (Lease and Rent Control) Act',
    shortName: 'TNBRC',
    year: 1960,
    states: ['Tamil Nadu'],
    category: 'property',
    description: 'Rent control legislation for Tamil Nadu'
  },
  {
    name: 'Karnataka Rent Act',
    shortName: 'KRA',
    year: 1999,
    states: ['Karnataka'],
    category: 'property',
    description: 'Rent control legislation for Karnataka'
  },
  {
    name: 'West Bengal Premises Tenancy Act',
    shortName: 'WBPTA',
    year: 1997,
    states: ['West Bengal'],
    category: 'property',
    description: 'Tenancy law for West Bengal'
  },

  // State-specific Land Revenue Laws
  {
    name: 'Maharashtra Land Revenue Code',
    shortName: 'MLRC',
    year: 1966,
    states: ['Maharashtra'],
    category: 'revenue',
    description: 'Land revenue administration in Maharashtra',
    keyProvisions: ['Section 37 - Mutation', 'Section 149 - Right of way', 'Section 257 - Encroachment']
  },
  {
    name: 'Karnataka Land Revenue Act',
    shortName: 'KLRA',
    year: 1964,
    states: ['Karnataka'],
    category: 'revenue',
    description: 'Land revenue administration in Karnataka'
  },
  {
    name: 'Uttar Pradesh Revenue Code',
    shortName: 'UPRC',
    year: 2006,
    states: ['Uttar Pradesh'],
    category: 'revenue',
    description: 'Land revenue administration in Uttar Pradesh'
  },
  {
    name: 'Rajasthan Land Revenue Act',
    shortName: 'RLRA',
    year: 1956,
    states: ['Rajasthan'],
    category: 'revenue',
    description: 'Land revenue administration in Rajasthan'
  },
  {
    name: 'Gujarat Land Revenue Code',
    shortName: 'GLRC',
    year: 1879,
    states: ['Gujarat'],
    category: 'revenue',
    description: 'Land revenue administration in Gujarat'
  },

  // State-specific Agricultural Land Laws
  {
    name: 'Maharashtra Agricultural Lands (Ceiling on Holdings) Act',
    shortName: 'MALCHA',
    year: 1961,
    states: ['Maharashtra'],
    category: 'revenue',
    description: 'Agricultural land ceiling in Maharashtra'
  },
  {
    name: 'Karnataka Land Reforms Act',
    shortName: 'KLRF',
    year: 1961,
    states: ['Karnataka'],
    category: 'revenue',
    description: 'Land reforms and tenancy in Karnataka'
  },
  {
    name: 'Kerala Land Reforms Act',
    shortName: 'KERLR',
    year: 1963,
    states: ['Kerala'],
    category: 'revenue',
    description: 'Land reforms in Kerala'
  },

  // Family Laws (Personal Laws)
  {
    name: 'Hindu Marriage Act',
    shortName: 'HMA',
    year: 1955,
    states: 'all',
    category: 'family',
    description: 'Marriage laws for Hindus',
    keyProvisions: ['Section 5 - Conditions for marriage', 'Section 13 - Divorce grounds', 'Section 24 - Maintenance pendente lite']
  },
  {
    name: 'Hindu Succession Act',
    shortName: 'HSA',
    year: 1956,
    states: 'all',
    category: 'family',
    description: 'Succession and inheritance for Hindus',
    keyProvisions: ['Section 6 - Coparcenary property', 'Section 8 - Class I heirs', 'Section 14 - Property of female Hindu']
  },
  {
    name: 'Muslim Personal Law (Shariat) Application Act',
    shortName: 'MPLA',
    year: 1937,
    states: 'all',
    category: 'family',
    description: 'Application of Shariat to Muslims in personal matters'
  },
  {
    name: 'Protection of Women from Domestic Violence Act',
    shortName: 'PWDVA',
    year: 2005,
    states: 'all',
    category: 'family',
    description: 'Protection against domestic violence',
    keyProvisions: ['Section 3 - Domestic violence defined', 'Section 18 - Protection orders', 'Section 20 - Monetary relief']
  },
  {
    name: 'Maintenance and Welfare of Parents and Senior Citizens Act',
    shortName: 'MWPSCA',
    year: 2007,
    states: 'all',
    category: 'family',
    description: 'Maintenance obligations towards parents and senior citizens'
  },

  // Labour Laws
  {
    name: 'Industrial Disputes Act',
    shortName: 'IDA',
    year: 1947,
    states: 'all',
    category: 'labour',
    description: 'Resolution of industrial disputes',
    keyProvisions: ['Section 2A - Individual disputes', 'Section 10 - Reference to Labour Court', 'Section 25F - Retrenchment']
  },
  {
    name: 'Maharashtra Recognition of Trade Unions and Prevention of Unfair Labour Practices Act',
    shortName: 'MRTU-PULP',
    year: 1971,
    states: ['Maharashtra'],
    category: 'labour',
    description: 'Trade union recognition and unfair labour practices in Maharashtra'
  },

  // Environmental Laws
  {
    name: 'Environment Protection Act',
    shortName: 'EPA',
    year: 1986,
    states: 'all',
    category: 'environmental',
    description: 'Framework law for environmental protection'
  },
  {
    name: 'Maharashtra Regional and Town Planning Act',
    shortName: 'MRTP',
    year: 1966,
    states: ['Maharashtra'],
    category: 'environmental',
    description: 'Town planning and development control in Maharashtra'
  },

  // Special Tribunals
  {
    name: 'Consumer Protection Act',
    shortName: 'CPA',
    year: 2019,
    states: 'all',
    category: 'civil',
    description: 'Consumer rights and dispute resolution',
    keyProvisions: ['Section 34 - District Commission', 'Section 47 - State Commission', 'Section 58 - National Commission']
  },
  {
    name: 'Real Estate (Regulation and Development) Act',
    shortName: 'RERA',
    year: 2016,
    states: 'all',
    category: 'property',
    description: 'Regulation of real estate sector',
    keyProvisions: ['Section 3 - Registration of projects', 'Section 18 - Return of amount with interest', 'Section 31 - Adjudication']
  },
  {
    name: 'Insolvency and Bankruptcy Code',
    shortName: 'IBC',
    year: 2016,
    states: 'all',
    category: 'commercial',
    description: 'Corporate insolvency resolution',
    keyProvisions: ['Section 7 - Financial creditor application', 'Section 9 - Operational creditor application', 'Section 12 - Time limit for CIRP']
  }
];

// Tribunals Database
export interface Tribunal {
  name: string;
  shortName: string;
  jurisdiction: 'national' | IndianState[];
  subjectMatter: string;
  appealTo: string;
}

export const TRIBUNALS: Tribunal[] = [
  {
    name: 'National Company Law Tribunal',
    shortName: 'NCLT',
    jurisdiction: 'national',
    subjectMatter: 'Company law matters, IBC proceedings',
    appealTo: 'National Company Law Appellate Tribunal (NCLAT)'
  },
  {
    name: 'National Green Tribunal',
    shortName: 'NGT',
    jurisdiction: 'national',
    subjectMatter: 'Environmental matters',
    appealTo: 'Supreme Court of India'
  },
  {
    name: 'Debt Recovery Tribunal',
    shortName: 'DRT',
    jurisdiction: 'national',
    subjectMatter: 'Recovery of debts due to banks/financial institutions',
    appealTo: 'Debt Recovery Appellate Tribunal (DRAT)'
  },
  {
    name: 'Income Tax Appellate Tribunal',
    shortName: 'ITAT',
    jurisdiction: 'national',
    subjectMatter: 'Income tax appeals',
    appealTo: 'High Court'
  },
  {
    name: 'Central Administrative Tribunal',
    shortName: 'CAT',
    jurisdiction: 'national',
    subjectMatter: 'Service matters of central government employees',
    appealTo: 'High Court'
  },
  {
    name: 'Armed Forces Tribunal',
    shortName: 'AFT',
    jurisdiction: 'national',
    subjectMatter: 'Armed forces service matters',
    appealTo: 'Supreme Court of India'
  },
  {
    name: 'Securities Appellate Tribunal',
    shortName: 'SAT',
    jurisdiction: 'national',
    subjectMatter: 'Securities market appeals (SEBI orders)',
    appealTo: 'Supreme Court of India'
  },
  {
    name: 'Telecom Disputes Settlement and Appellate Tribunal',
    shortName: 'TDSAT',
    jurisdiction: 'national',
    subjectMatter: 'Telecom disputes',
    appealTo: 'Supreme Court of India'
  },
  {
    name: 'Real Estate Appellate Tribunal',
    shortName: 'REAT',
    jurisdiction: 'national',
    subjectMatter: 'Appeals from RERA Authority',
    appealTo: 'High Court'
  },
  {
    name: 'Motor Accident Claims Tribunal',
    shortName: 'MACT',
    jurisdiction: 'national',
    subjectMatter: 'Motor accident compensation claims',
    appealTo: 'High Court'
  },
  {
    name: 'Labour Court',
    shortName: 'LC',
    jurisdiction: 'national',
    subjectMatter: 'Industrial disputes, labour matters',
    appealTo: 'High Court'
  },
  {
    name: 'Industrial Tribunal',
    shortName: 'IT',
    jurisdiction: 'national',
    subjectMatter: 'Industrial disputes',
    appealTo: 'High Court'
  }
];

// Helper Functions
export function getHighCourtForState(state: IndianState): HighCourtJurisdiction | undefined {
  return HIGH_COURTS.find(hc => hc.states.includes(state));
}

export function getActsForState(state: IndianState): StateSpecificAct[] {
  return STATE_SPECIFIC_ACTS.filter(act =>
    act.states === 'all' || act.states.includes(state)
  );
}

export function getActsByCategory(category: StateSpecificAct['category']): StateSpecificAct[] {
  return STATE_SPECIFIC_ACTS.filter(act => act.category === category);
}

export function getActByShortName(shortName: string): StateSpecificAct | undefined {
  return STATE_SPECIFIC_ACTS.find(act =>
    act.shortName.toLowerCase() === shortName.toLowerCase()
  );
}

export function getTribunalForSubject(subjectKeywords: string[]): Tribunal[] {
  return TRIBUNALS.filter(tribunal =>
    subjectKeywords.some(keyword =>
      tribunal.subjectMatter.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

// Jurisdiction Context Builder
export interface JurisdictionContext {
  state?: IndianState;
  courtLevel: CourtLevel;
  courtName?: string;
  applicableCentralActs: StateSpecificAct[];
  applicableStateActs: StateSpecificAct[];
  relevantTribunals: Tribunal[];
  bindingHighCourt?: HighCourtJurisdiction;
}

export function buildJurisdictionContext(
  state?: IndianState,
  courtLevel: CourtLevel = 'district',
  subjectKeywords: string[] = []
): JurisdictionContext {
  const centralActs = STATE_SPECIFIC_ACTS.filter(act => act.states === 'all');
  const stateActs = state ? STATE_SPECIFIC_ACTS.filter(act =>
    act.states !== 'all' && act.states.includes(state)
  ) : [];

  const relevantTribunals = getTribunalForSubject(subjectKeywords);
  const bindingHighCourt = state ? getHighCourtForState(state) : undefined;

  return {
    state,
    courtLevel,
    applicableCentralActs: centralActs,
    applicableStateActs: stateActs,
    relevantTribunals,
    bindingHighCourt
  };
}

// Format jurisdiction context for AI prompts
export function formatJurisdictionForPrompt(context: JurisdictionContext): string {
  let prompt = `\n## JURISDICTION CONTEXT:\n`;

  if (context.state) {
    prompt += `- State: ${context.state}\n`;
    if (context.bindingHighCourt) {
      prompt += `- Binding High Court: ${context.bindingHighCourt.name}\n`;
    }
  }

  prompt += `- Court Level: ${context.courtLevel.charAt(0).toUpperCase() + context.courtLevel.slice(1)}\n`;

  if (context.applicableStateActs.length > 0) {
    prompt += `\n### State-Specific Acts to Consider:\n`;
    context.applicableStateActs.slice(0, 5).forEach(act => {
      prompt += `- ${act.name} (${act.shortName}), ${act.year}: ${act.description}\n`;
    });
  }

  if (context.relevantTribunals.length > 0) {
    prompt += `\n### Relevant Tribunals:\n`;
    context.relevantTribunals.forEach(tribunal => {
      prompt += `- ${tribunal.name} (${tribunal.shortName}): ${tribunal.subjectMatter}\n`;
      prompt += `  Appeal lies to: ${tribunal.appealTo}\n`;
    });
  }

  return prompt;
}

// Citation validation patterns
export const CITATION_PATTERNS = {
  AIR: /AIR\s*\d{4}\s*(SC|SCR|Pat|Del|Bom|Cal|Mad|Kar|Ker|MP|Raj|Guj|P&H|Ori|All|AP|Gau|HP|J&K|Jhar|Chh|Utt|NOC)\s*\d+/gi,
  SCC: /\(\d{4}\)\s*\d+\s*SCC\s*\d+/gi,
  SCR: /\[\d{4}\]\s*\d*\s*SCR\s*\d+/gi,
  SUPREME_COURT_CASES: /\(\d{4}\)\s*\d*\s*Supreme Court Cases\s*\d+/gi,
  SCALE: /\(\d{4}\)\s*\d*\s*SCALE\s*\d+/gi,
  SCC_ONLINE: /\d{4}\s*SCC\s*OnLine\s*(SC|[A-Z]+)\s*\d+/gi,
  MANU: /MANU\/[A-Z]{2}\/\d{4}\/\d+/gi,
  CriLJ: /\d{4}\s*Cri\.?\s*L\.?J\.?\s*\d+/gi,
  ALL_INDIA_REPORTER: /All India Reporter\s*\d{4}\s*[A-Za-z]+\s*\d+/gi
};

export function validateCitation(citation: string): { valid: boolean; format?: string } {
  for (const [format, pattern] of Object.entries(CITATION_PATTERNS)) {
    if (pattern.test(citation)) {
      return { valid: true, format };
    }
  }
  return { valid: false };
}

export function extractCitationsFromText(text: string): Array<{ citation: string; format: string }> {
  const citations: Array<{ citation: string; format: string }> = [];

  for (const [format, pattern] of Object.entries(CITATION_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!citations.some(c => c.citation === match)) {
          citations.push({ citation: match, format });
        }
      });
    }
  }

  return citations;
}
