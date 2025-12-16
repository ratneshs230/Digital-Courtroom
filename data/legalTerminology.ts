/**
 * Legal Terminology Dictionary for NyayaSutra
 * Contains correct usage of Indian legal terms, Latin maxims, and court procedures
 */

// Legal term with definition and usage
export interface LegalTerm {
  term: string;
  hindiEquivalent?: string;
  latinOrigin?: string;
  definition: string;
  correctUsage: string;
  incorrectUsage?: string;
  relatedTerms?: string[];
  applicableIn: ('civil' | 'criminal' | 'constitutional' | 'family' | 'commercial' | 'all')[];
}

// Latin maxims commonly used in Indian courts
export const LATIN_MAXIMS: LegalTerm[] = [
  {
    term: 'Audi Alteram Partem',
    definition: 'Hear the other side; no one should be condemned unheard',
    correctUsage: 'The principle of audi alteram partem mandates that the respondent be given an opportunity to be heard.',
    relatedTerms: ['Natural Justice', 'Fair Hearing'],
    applicableIn: ['all']
  },
  {
    term: 'Nemo Judex in Causa Sua',
    definition: 'No one should be a judge in their own cause; rule against bias',
    correctUsage: 'The judge recused himself applying the maxim nemo judex in causa sua.',
    relatedTerms: ['Natural Justice', 'Bias'],
    applicableIn: ['all']
  },
  {
    term: 'Res Judicata',
    definition: 'A matter already adjudicated; prevents re-litigation of the same issue',
    correctUsage: 'The suit is barred by res judicata as the matter was conclusively decided in the earlier proceedings.',
    incorrectUsage: 'Do not use for matters that were never actually decided on merits.',
    relatedTerms: ['Constructive Res Judicata', 'Issue Estoppel'],
    applicableIn: ['civil', 'constitutional']
  },
  {
    term: 'Ratio Decidendi',
    definition: 'The reason for the decision; the binding principle of a judgment',
    correctUsage: 'The ratio decidendi of the Supreme Court judgment in Vishakha is binding on all courts.',
    incorrectUsage: 'Do not confuse with obiter dicta which are incidental remarks.',
    relatedTerms: ['Obiter Dicta', 'Precedent', 'Stare Decisis'],
    applicableIn: ['all']
  },
  {
    term: 'Obiter Dicta',
    definition: 'Things said by the way; incidental remarks in a judgment that are not binding',
    correctUsage: 'The observation regarding future legislation was merely obiter dicta and not binding precedent.',
    relatedTerms: ['Ratio Decidendi'],
    applicableIn: ['all']
  },
  {
    term: 'Stare Decisis',
    definition: 'To stand by things decided; the doctrine of following precedents',
    correctUsage: 'Following stare decisis, this Court is bound by the constitutional bench decision.',
    relatedTerms: ['Precedent', 'Ratio Decidendi'],
    applicableIn: ['all']
  },
  {
    term: 'Prima Facie',
    definition: 'At first appearance; on the face of it; sufficient to establish a fact unless rebutted',
    correctUsage: 'The petitioner has established a prima facie case warranting interim relief.',
    incorrectUsage: 'Do not use to mean "conclusive" - it means "apparently true but subject to rebuttal".',
    relatedTerms: ['Burden of Proof'],
    applicableIn: ['all']
  },
  {
    term: 'Inter Alia',
    definition: 'Among other things',
    correctUsage: 'The petitioner prayed for, inter alia, a declaration and permanent injunction.',
    relatedTerms: ['Et Al', 'Et Cetera'],
    applicableIn: ['all']
  },
  {
    term: 'Ex Parte',
    definition: 'From one side only; without notice to the other party',
    correctUsage: 'An ex parte interim injunction was granted as the defendant was evading service.',
    incorrectUsage: 'Ex parte does not mean "temporary" - it refers to proceedings without the other party.',
    relatedTerms: ['Ad Interim', 'Injunction'],
    applicableIn: ['civil', 'family']
  },
  {
    term: 'Ad Interim',
    definition: 'In the meanwhile; temporary until further orders',
    correctUsage: 'Ad interim relief of stay is granted till the next date of hearing.',
    relatedTerms: ['Ex Parte', 'Status Quo'],
    applicableIn: ['civil', 'constitutional']
  },
  {
    term: 'Suo Motu',
    definition: 'On its own motion; action taken by the court without application by a party',
    correctUsage: 'The High Court took suo motu cognizance of the matter based on newspaper reports.',
    relatedTerms: ['PIL', 'Cognizance'],
    applicableIn: ['constitutional', 'criminal']
  },
  {
    term: 'Locus Standi',
    definition: 'Standing to sue; the right to bring an action before a court',
    correctUsage: 'The respondent challenged the petitioner\'s locus standi to file this PIL.',
    relatedTerms: ['PIL', 'Aggrieved Person'],
    applicableIn: ['all']
  },
  {
    term: 'Ultra Vires',
    definition: 'Beyond powers; an act that exceeds the authority conferred by law',
    correctUsage: 'The impugned notification is ultra vires the parent Act and hence void.',
    relatedTerms: ['Intra Vires', 'Delegated Legislation'],
    applicableIn: ['constitutional', 'commercial']
  },
  {
    term: 'Caveat Emptor',
    definition: 'Let the buyer beware',
    correctUsage: 'The principle of caveat emptor does not apply to latent defects.',
    relatedTerms: ['Consumer Protection', 'Defect'],
    applicableIn: ['commercial', 'civil']
  },
  {
    term: 'Actus Reus',
    definition: 'The guilty act; the physical element of a crime',
    correctUsage: 'The prosecution must prove both actus reus and mens rea beyond reasonable doubt.',
    relatedTerms: ['Mens Rea', 'Crime'],
    applicableIn: ['criminal']
  },
  {
    term: 'Mens Rea',
    definition: 'Guilty mind; the mental element required for a crime',
    correctUsage: 'Section 302 IPC requires mens rea in the form of intention or knowledge.',
    relatedTerms: ['Actus Reus', 'Intention', 'Knowledge'],
    applicableIn: ['criminal']
  },
  {
    term: 'In Pari Delicto',
    definition: 'In equal fault; both parties are equally at fault',
    correctUsage: 'Being in pari delicto, neither party can seek equitable relief.',
    relatedTerms: ['Equity', 'Clean Hands'],
    applicableIn: ['civil', 'commercial']
  },
  {
    term: 'Quantum Meruit',
    definition: 'As much as deserved; reasonable compensation for work done',
    correctUsage: 'In the absence of a fixed rate, the contractor is entitled to quantum meruit.',
    relatedTerms: ['Unjust Enrichment', 'Contract'],
    applicableIn: ['civil', 'commercial']
  },
  {
    term: 'Quid Pro Quo',
    definition: 'Something for something; consideration in a contract',
    correctUsage: 'Every valid contract requires quid pro quo between the parties.',
    relatedTerms: ['Consideration', 'Contract'],
    applicableIn: ['commercial', 'civil']
  },
  {
    term: 'Damnum Sine Injuria',
    definition: 'Damage without legal injury; no actionable wrong despite actual loss',
    correctUsage: 'Competition causing business loss is damnum sine injuria and not actionable.',
    relatedTerms: ['Injuria Sine Damno', 'Tort'],
    applicableIn: ['civil']
  },
  {
    term: 'Injuria Sine Damno',
    definition: 'Legal injury without actual damage; actionable even without proven loss',
    correctUsage: 'Trespass to land is injuria sine damno and actionable per se.',
    relatedTerms: ['Damnum Sine Injuria', 'Tort'],
    applicableIn: ['civil']
  }
];

// Indian-specific legal terminology
export const INDIAN_LEGAL_TERMS: LegalTerm[] = [
  {
    term: 'Public Interest Litigation (PIL)',
    hindiEquivalent: 'जनहित याचिका',
    definition: 'A petition filed in public interest for enforcement of fundamental rights or public duties',
    correctUsage: 'The PIL under Article 226 was admitted as it raised substantial questions of public importance.',
    incorrectUsage: 'PIL cannot be filed for private grievances or commercial disputes.',
    relatedTerms: ['Article 32', 'Article 226', 'Epistolary Jurisdiction'],
    applicableIn: ['constitutional']
  },
  {
    term: 'First Information Report (FIR)',
    hindiEquivalent: 'प्रथम सूचना रिपोर्ट',
    definition: 'The first report of a cognizable offence lodged with the police under Section 154 CrPC',
    correctUsage: 'FIR was registered under Sections 302/34 IPC at PS Sadar on 15.01.2024.',
    incorrectUsage: 'FIR is not the same as a complaint - FIR is for cognizable offences only.',
    relatedTerms: ['Section 154 CrPC', 'Cognizable Offence', 'NCR'],
    applicableIn: ['criminal']
  },
  {
    term: 'Cognizable Offence',
    hindiEquivalent: 'संज्ञेय अपराध',
    definition: 'An offence for which police can arrest without warrant and investigate without magistrate\'s permission',
    correctUsage: 'Murder under Section 302 IPC is a cognizable offence.',
    relatedTerms: ['Non-Cognizable Offence', 'FIR'],
    applicableIn: ['criminal']
  },
  {
    term: 'Non-Cognizable Offence',
    hindiEquivalent: 'गैर-संज्ञेय अपराध',
    definition: 'An offence where police cannot arrest without warrant or investigate without magistrate\'s order',
    correctUsage: 'For non-cognizable offences, a complaint must be filed before the Magistrate.',
    relatedTerms: ['Cognizable Offence', 'Section 155 CrPC'],
    applicableIn: ['criminal']
  },
  {
    term: 'Bail (Regular)',
    hindiEquivalent: 'जमानत',
    definition: 'Release of an accused from custody upon furnishing security for appearance in court',
    correctUsage: 'Regular bail was granted under Section 439 CrPC with conditions.',
    relatedTerms: ['Anticipatory Bail', 'Interim Bail', 'Default Bail'],
    applicableIn: ['criminal']
  },
  {
    term: 'Anticipatory Bail',
    hindiEquivalent: 'अग्रिम जमानत',
    definition: 'Bail granted in anticipation of arrest under Section 438 CrPC',
    correctUsage: 'Anticipatory bail u/s 438 CrPC is granted in apprehension of arrest in a non-bailable offence.',
    incorrectUsage: 'Anticipatory bail is not available after arrest - then regular bail must be sought.',
    relatedTerms: ['Section 438 CrPC', 'Regular Bail'],
    applicableIn: ['criminal']
  },
  {
    term: 'Default Bail (Statutory Bail)',
    hindiEquivalent: 'डिफॉल्ट जमानत',
    definition: 'Bail as a matter of right when investigation is not completed within statutory period (Section 167(2) CrPC)',
    correctUsage: 'The accused invoked his indefeasible right to default bail as chargesheet was not filed within 90 days.',
    relatedTerms: ['Section 167(2) CrPC', 'Chargesheet'],
    applicableIn: ['criminal']
  },
  {
    term: 'Chargesheet',
    hindiEquivalent: 'आरोप पत्र',
    definition: 'Police report under Section 173 CrPC submitted to Magistrate after investigation',
    correctUsage: 'Chargesheet was filed under Sections 420/406 IPC before the learned Metropolitan Magistrate.',
    relatedTerms: ['Section 173 CrPC', 'Final Report', 'Closure Report'],
    applicableIn: ['criminal']
  },
  {
    term: 'Stay Order',
    hindiEquivalent: 'स्थगन आदेश',
    definition: 'An order directing suspension of proceedings or execution of a decree/order',
    correctUsage: 'Stay of the impugned order is granted subject to deposit of 50% of the demand.',
    relatedTerms: ['Injunction', 'Status Quo'],
    applicableIn: ['civil', 'constitutional', 'commercial']
  },
  {
    term: 'Status Quo',
    definition: 'The existing state of affairs to be maintained',
    correctUsage: 'Parties are directed to maintain status quo with respect to the suit property.',
    relatedTerms: ['Stay Order', 'Injunction'],
    applicableIn: ['civil', 'family']
  },
  {
    term: 'Writ Petition',
    hindiEquivalent: 'रिट याचिका',
    definition: 'A petition filed under Article 32 (Supreme Court) or Article 226 (High Court) for constitutional remedies',
    correctUsage: 'Writ Petition under Article 226 for issuance of writ of certiorari was filed.',
    relatedTerms: ['Habeas Corpus', 'Mandamus', 'Certiorari', 'Prohibition', 'Quo Warranto'],
    applicableIn: ['constitutional']
  },
  {
    term: 'Habeas Corpus',
    definition: 'Writ to produce the body; remedy against illegal detention',
    correctUsage: 'Habeas corpus petition was filed challenging the illegal detention of the detenu.',
    relatedTerms: ['Article 32', 'Article 226', 'Illegal Detention'],
    applicableIn: ['constitutional', 'criminal']
  },
  {
    term: 'Mandamus',
    definition: 'Writ commanding a public authority to perform its statutory duty',
    correctUsage: 'Writ of mandamus was sought directing the respondent authority to decide the representation.',
    incorrectUsage: 'Mandamus cannot be issued against private parties or for discretionary duties.',
    relatedTerms: ['Public Duty', 'Statutory Authority'],
    applicableIn: ['constitutional']
  },
  {
    term: 'Certiorari',
    definition: 'Writ to quash an order passed without jurisdiction or in violation of natural justice',
    correctUsage: 'Writ of certiorari was issued quashing the order passed in violation of principles of natural justice.',
    relatedTerms: ['Jurisdictional Error', 'Natural Justice'],
    applicableIn: ['constitutional']
  },
  {
    term: 'Interlocutory Application (IA)',
    hindiEquivalent: 'अंतर्वर्ती आवेदन',
    definition: 'An application filed during pendency of main proceedings for interim relief or other matters',
    correctUsage: 'IA for temporary injunction was filed in the pending suit.',
    relatedTerms: ['Interim Relief', 'Main Petition'],
    applicableIn: ['civil', 'constitutional', 'commercial']
  },
  {
    term: 'Ex-Parte Decree',
    hindiEquivalent: 'एक-पक्षीय डिक्री',
    definition: 'A decree passed against a party who fails to appear despite service',
    correctUsage: 'Ex-parte decree was passed as the defendant failed to appear despite valid service.',
    relatedTerms: ['Order IX CPC', 'Set Aside'],
    applicableIn: ['civil', 'family']
  },
  {
    term: 'Maintenance (Alimony)',
    hindiEquivalent: 'भरण-पोषण',
    definition: 'Financial support payable to spouse/children/parents under various laws',
    correctUsage: 'Maintenance u/s 125 CrPC was granted at Rs. 25,000 per month.',
    relatedTerms: ['Section 125 CrPC', 'Section 24 HMA', 'DV Act'],
    applicableIn: ['family', 'criminal']
  },
  {
    term: 'Specific Performance',
    hindiEquivalent: 'विशिष्ट पालन',
    definition: 'Equitable relief compelling a party to perform their contractual obligations',
    correctUsage: 'Suit for specific performance of the agreement to sell was decreed.',
    incorrectUsage: 'Specific performance is discretionary and not available for personal service contracts.',
    relatedTerms: ['Section 10 SRA', 'Readiness and Willingness'],
    applicableIn: ['civil', 'commercial']
  },
  {
    term: 'Permanent Injunction',
    hindiEquivalent: 'स्थायी निषेधाज्ञा',
    definition: 'Final injunction granted after trial restraining defendant from certain acts',
    correctUsage: 'Permanent injunction was granted restraining the defendant from interfering with plaintiff\'s possession.',
    relatedTerms: ['Temporary Injunction', 'Section 38 SRA'],
    applicableIn: ['civil']
  },
  {
    term: 'Temporary Injunction',
    hindiEquivalent: 'अस्थायी निषेधाज्ञा',
    definition: 'Interim injunction granted during trial to preserve subject matter',
    correctUsage: 'Temporary injunction under Order XXXIX CPC was granted till disposal of suit.',
    relatedTerms: ['Order XXXIX CPC', 'Prima Facie Case', 'Balance of Convenience', 'Irreparable Injury'],
    applicableIn: ['civil']
  },
  {
    term: 'Quashing (of FIR/Proceedings)',
    hindiEquivalent: 'FIR/कार्यवाही रद्द करना',
    definition: 'Annulment of criminal proceedings by High Court under Section 482 CrPC',
    correctUsage: 'The FIR was quashed under Section 482 CrPC as no cognizable offence was made out.',
    relatedTerms: ['Section 482 CrPC', 'Inherent Powers'],
    applicableIn: ['criminal']
  },
  {
    term: 'Discharge',
    hindiEquivalent: 'उन्मोचन',
    definition: 'Release of accused before framing of charges when no prima facie case exists',
    correctUsage: 'The accused was discharged under Section 227 CrPC as no sufficient ground existed for trial.',
    relatedTerms: ['Section 227 CrPC', 'Section 239 CrPC'],
    applicableIn: ['criminal']
  },
  {
    term: 'Acquittal',
    hindiEquivalent: 'दोषमुक्ति',
    definition: 'Final verdict declaring the accused not guilty after trial',
    correctUsage: 'The accused was acquitted of all charges as prosecution failed to prove guilt beyond reasonable doubt.',
    relatedTerms: ['Benefit of Doubt', 'Section 232 CrPC'],
    applicableIn: ['criminal']
  },
  {
    term: 'Conviction',
    hindiEquivalent: 'दोषसिद्धि',
    definition: 'Final verdict declaring the accused guilty after trial',
    correctUsage: 'The accused was convicted under Section 302 IPC and sentenced to life imprisonment.',
    relatedTerms: ['Sentence', 'Appeal'],
    applicableIn: ['criminal']
  },
  {
    term: 'Restitution of Conjugal Rights',
    hindiEquivalent: 'दांपत्य अधिकारों की बहाली',
    definition: 'Relief under Section 9 HMA when spouse withdraws from society without reasonable excuse',
    correctUsage: 'Petition for restitution of conjugal rights was filed alleging desertion by the respondent.',
    relatedTerms: ['Section 9 HMA', 'Desertion'],
    applicableIn: ['family']
  },
  {
    term: 'Caveat',
    hindiEquivalent: 'केवियट',
    definition: 'A notice filed to be heard before any ex-parte order is passed (Section 148A CPC)',
    correctUsage: 'Caveat was filed to ensure that no ex-parte order is passed without hearing the caveator.',
    relatedTerms: ['Section 148A CPC', 'Ex-Parte Order'],
    applicableIn: ['civil', 'constitutional', 'commercial']
  }
];

// Common procedural terms and their correct usage
export const PROCEDURAL_TERMS: LegalTerm[] = [
  {
    term: 'Plaint',
    hindiEquivalent: 'वाद-पत्र',
    definition: 'The written statement of plaintiff\'s claim in a civil suit (Order VII CPC)',
    correctUsage: 'The plaint was filed with all requisite documents as per Order VII CPC.',
    relatedTerms: ['Written Statement', 'Order VII CPC'],
    applicableIn: ['civil']
  },
  {
    term: 'Written Statement',
    hindiEquivalent: 'लिखित कथन',
    definition: 'The defendant\'s response to the plaint (Order VIII CPC)',
    correctUsage: 'Written statement was filed within 90 days as mandated by Order VIII Rule 1 CPC.',
    relatedTerms: ['Plaint', 'Order VIII CPC'],
    applicableIn: ['civil']
  },
  {
    term: 'Issues',
    hindiEquivalent: 'विवाद्यक',
    definition: 'Questions of fact or law to be decided by the court (Order XIV CPC)',
    correctUsage: 'Five issues were framed by the learned Trial Court for determination.',
    relatedTerms: ['Order XIV CPC', 'Framing'],
    applicableIn: ['civil']
  },
  {
    term: 'Evidence (Examination)',
    hindiEquivalent: 'साक्ष्य',
    definition: 'Oral or documentary proof presented before the court',
    correctUsage: 'Plaintiff\'s evidence was completed and defendant\'s evidence was scheduled.',
    relatedTerms: ['Examination-in-Chief', 'Cross-Examination', 'Re-Examination'],
    applicableIn: ['civil', 'criminal']
  },
  {
    term: 'Arguments',
    hindiEquivalent: 'बहस',
    definition: 'Oral submissions made by counsels after evidence is completed',
    correctUsage: 'After completion of evidence, matter was fixed for final arguments.',
    relatedTerms: ['Judgment Reserved', 'Written Arguments'],
    applicableIn: ['all']
  },
  {
    term: 'Decree',
    hindiEquivalent: 'डिक्री',
    definition: 'Formal expression of adjudication in a civil suit (Section 2(2) CPC)',
    correctUsage: 'Preliminary decree for partition was passed, directing sale of property.',
    relatedTerms: ['Judgment', 'Order', 'Preliminary Decree', 'Final Decree'],
    applicableIn: ['civil']
  },
  {
    term: 'Order',
    hindiEquivalent: 'आदेश',
    definition: 'Formal expression of decision on any question other than the suit determination',
    correctUsage: 'Order rejecting the application for amendment was passed.',
    relatedTerms: ['Decree', 'Judgment'],
    applicableIn: ['all']
  },
  {
    term: 'Judgment',
    hindiEquivalent: 'निर्णय',
    definition: 'Statement of grounds for a decree or order (Section 2(9) CPC)',
    correctUsage: 'Detailed judgment was pronounced on 15.01.2024 with reasons.',
    relatedTerms: ['Decree', 'Order', 'Reasoned Order'],
    applicableIn: ['all']
  },
  {
    term: 'Appeal',
    hindiEquivalent: 'अपील',
    definition: 'Proceeding to challenge a judgment/decree/order in a higher court',
    correctUsage: 'First appeal was filed under Section 96 CPC before the High Court.',
    relatedTerms: ['Section 96 CPC', 'Section 100 CPC', 'Section 374 CrPC'],
    applicableIn: ['all']
  },
  {
    term: 'Revision',
    hindiEquivalent: 'पुनरीक्षण',
    definition: 'Supervisory jurisdiction of High Court under Section 115 CPC or 397/401 CrPC',
    correctUsage: 'Revision petition under Section 115 CPC was filed challenging the interlocutory order.',
    incorrectUsage: 'Revision is not available as a matter of right - it is discretionary.',
    relatedTerms: ['Section 115 CPC', 'Section 397 CrPC'],
    applicableIn: ['civil', 'criminal']
  },
  {
    term: 'Review',
    hindiEquivalent: 'पुनर्विलोकन',
    definition: 'Application to the same court to reconsider its judgment (Order XLVII CPC)',
    correctUsage: 'Review petition under Order XLVII CPC was filed on grounds of apparent error on record.',
    incorrectUsage: 'Review is not available as an appeal in disguise - only for errors apparent on face of record.',
    relatedTerms: ['Order XLVII CPC', 'Error Apparent'],
    applicableIn: ['all']
  },
  {
    term: 'Curative Petition',
    definition: 'A remedy against final Supreme Court judgment in exceptional cases',
    correctUsage: 'Curative petition was filed following the principles laid in Rupa Hurra case.',
    relatedTerms: ['Review', 'Supreme Court'],
    applicableIn: ['constitutional']
  },
  {
    term: 'Execution',
    hindiEquivalent: 'निष्पादन',
    definition: 'Process of enforcing a decree (Order XXI CPC)',
    correctUsage: 'Execution petition was filed for recovery of decretal amount.',
    relatedTerms: ['Order XXI CPC', 'Decree Holder', 'Judgment Debtor'],
    applicableIn: ['civil']
  }
];

// Court address forms and procedural etiquette
export const COURT_ADDRESS_FORMS = {
  supremeCourt: {
    judge: "Hon'ble Justice" ,
    court: "This Hon'ble Court",
    address: "Your Lordship / Your Lordships",
    referring: "The Apex Court / This Court"
  },
  highCourt: {
    judge: "Hon'ble Justice",
    court: "This Hon'ble Court",
    address: "Your Lordship / Your Lordships",
    referring: "This High Court"
  },
  districtCourt: {
    judge: "Learned Judge / Learned District Judge",
    court: "This Learned Court",
    address: "Your Honour",
    referring: "The Trial Court"
  },
  magistrateCourt: {
    judge: "Learned Magistrate / Learned CMM",
    court: "This Learned Court",
    address: "Your Honour",
    referring: "The Learned Magistrate"
  },
  tribunal: {
    judge: "Learned Member / Hon'ble Presiding Officer",
    court: "This Learned Tribunal",
    address: "Your Honour",
    referring: "The Learned Tribunal"
  }
};

// Common legal phrases and their proper usage
export const LEGAL_PHRASES: Record<string, { meaning: string; usage: string }> = {
  'without prejudice': {
    meaning: 'Without affecting any right or claim; used in settlement negotiations',
    usage: 'This offer is made without prejudice to the rights of my client in the pending proceedings.'
  },
  'subject to': {
    meaning: 'Conditional upon; dependent on',
    usage: 'The order is granted subject to deposit of 50% of the amount in dispute.'
  },
  'on merits': {
    meaning: 'Based on substantial rights and justice, not technicalities',
    usage: 'The matter was decided on merits after full trial.'
  },
  'sine die': {
    meaning: 'Without fixing a date; indefinitely',
    usage: 'The matter is adjourned sine die pending decision of the constitutional bench.'
  },
  'per incuriam': {
    meaning: 'Through inadvertence; a decision given in ignorance of relevant law',
    usage: 'The cited judgment is per incuriam as it was passed without noticing the earlier binding precedent.'
  },
  'sub silentio': {
    meaning: 'Under silence; a point not expressly argued or decided',
    usage: 'The point decided sub silentio in that case cannot be treated as binding precedent.'
  },
  'mutatis mutandis': {
    meaning: 'With necessary changes; applying the same principle with appropriate modifications',
    usage: 'The ratio of that case applies mutatis mutandis to the present facts.'
  },
  'ipso facto': {
    meaning: 'By that very fact; as a direct result',
    usage: 'Non-payment of rent for six months ipso facto gives rise to a ground for eviction.'
  },
  'ab initio': {
    meaning: 'From the beginning',
    usage: 'The contract was void ab initio due to lack of free consent.'
  },
  'in toto': {
    meaning: 'Completely; as a whole',
    usage: 'The impugned order is quashed in toto.'
  }
};

// Helper functions
export function getLegalTerm(term: string): LegalTerm | undefined {
  const allTerms = [...LATIN_MAXIMS, ...INDIAN_LEGAL_TERMS, ...PROCEDURAL_TERMS];
  return allTerms.find(t => t.term.toLowerCase() === term.toLowerCase());
}

export function getTermsByCategory(category: LegalTerm['applicableIn'][number]): LegalTerm[] {
  const allTerms = [...LATIN_MAXIMS, ...INDIAN_LEGAL_TERMS, ...PROCEDURAL_TERMS];
  return allTerms.filter(t => t.applicableIn.includes(category) || t.applicableIn.includes('all'));
}

export function searchTerms(query: string): LegalTerm[] {
  const allTerms = [...LATIN_MAXIMS, ...INDIAN_LEGAL_TERMS, ...PROCEDURAL_TERMS];
  const lowerQuery = query.toLowerCase();
  return allTerms.filter(t =>
    t.term.toLowerCase().includes(lowerQuery) ||
    t.definition.toLowerCase().includes(lowerQuery) ||
    (t.hindiEquivalent && t.hindiEquivalent.includes(query))
  );
}

// Format terminology guidelines for AI prompts
export function formatTerminologyForPrompt(caseType: LegalTerm['applicableIn'][number]): string {
  const relevantTerms = getTermsByCategory(caseType).slice(0, 10);

  let prompt = `\n## LEGAL TERMINOLOGY GUIDELINES:\n`;
  prompt += `Use the following terms correctly in arguments:\n\n`;

  relevantTerms.forEach(term => {
    prompt += `**${term.term}**: ${term.definition}\n`;
    prompt += `- Correct usage: "${term.correctUsage}"\n`;
    if (term.incorrectUsage) {
      prompt += `- Avoid: ${term.incorrectUsage}\n`;
    }
    prompt += '\n';
  });

  prompt += `\n### COURT ADDRESS PROTOCOL:\n`;
  prompt += `- Supreme/High Court: Address as "Your Lordship(s)", refer to "This Hon'ble Court"\n`;
  prompt += `- District/Magistrate Court: Address as "Your Honour", refer to "This Learned Court"\n`;

  return prompt;
}

// Export all terms for comprehensive access
export const ALL_LEGAL_TERMS = [
  ...LATIN_MAXIMS,
  ...INDIAN_LEGAL_TERMS,
  ...PROCEDURAL_TERMS
];
