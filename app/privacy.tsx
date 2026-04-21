import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{number}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Callout({ green, children }: { green?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.callout, green && styles.calloutGreen]}>
      {children}
    </View>
  );
}

function DataRow({ category, examples, source }: { category: string; examples: string; source: string }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableCell}><Text style={styles.bold}>{category}</Text>{'\n'}<Text style={styles.tableSub}>{examples}</Text></Text>
      <Text style={[styles.tableCell, styles.tableCellRight]}>{source}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Text style={styles.brandName}>Legacy Prime</Text>
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.push('/terms')}>
              <Text style={styles.navLink}>Terms</Text>
            </TouchableOpacity>
            <View style={styles.navActiveChip}>
              <Text style={styles.navActiveText}>Privacy Policy</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.page}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PRIVACY</Text>
          </View>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroMeta}>
            Effective date: <Text style={styles.bold}>January 1, 2025</Text>
            {'  ·  '}
            Jurisdiction: <Text style={styles.bold}>State of Washington</Text>
          </Text>
          <Text style={styles.heroIntro}>
            Legacy Construction Consulting Inc. ("we," "us," or "Service Provider") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use <Text style={styles.bold}>Legacy Prime AI</Text>.
          </Text>
        </View>

        {/* Section 1 */}
        <Section number="1" title="Information We Collect">
          <Text style={styles.p}>We collect information in the following categories:</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Category</Text>
              <Text style={[styles.tableHeaderCell, styles.tableCellRight]}>Source</Text>
            </View>
            <DataRow category="Account Information" examples="Name, email, phone, role, company name" source="Provided at signup" />
            <DataRow category="Company Data" examples="Company name, logo, license number, billing info" source="Admin onboarding" />
            <DataRow category="Project & Operational Data" examples="Projects, tasks, estimates, expenses, photos, documents" source="Created by your team" />
            <DataRow category="Client Information" examples="Client names, emails, phone numbers, addresses" source="Entered in CRM" />
            <DataRow category="Communications" examples="Team chat, SMS records, voice call records" source="Generated on platform" />
            <DataRow category="Usage Data" examples="Login times, features accessed, IP address, device type" source="Automatically collected" />
            <DataRow category="Payment Data" examples="Billing address, last 4 digits of card" source="Subscription setup" />
            <DataRow category="Files & Media" examples="Photos, documents, receipts, voice messages" source="Uploaded by your team" />
          </View>
        </Section>

        {/* Section 2 */}
        <Section number="2" title="How We Use Your Information">
          <Text style={styles.p}>We use the information we collect to:</Text>
          <Bullet>Provide the Services — operate, maintain, and deliver all platform features</Bullet>
          <Bullet>AI-Powered Features — generate AI outputs, automate workflows, and provide smart suggestions</Bullet>
          <Bullet>Billing & Payments — process subscriptions, send invoices, manage accounts</Bullet>
          <Bullet>Communications — send transactional emails, SMS, and push notifications</Bullet>
          <Bullet>Support — respond to inquiries and resolve technical issues</Bullet>
          <Bullet>Security & Compliance — detect fraud, enforce our Terms, comply with legal obligations</Bullet>
          <Bullet>Platform Improvement — analyze usage patterns to develop new features</Bullet>
        </Section>

        {/* Section 3 */}
        <Section number="3" title="AI Processing &amp; Automation">
          <Text style={styles.p}>Legacy Prime AI includes artificial intelligence features including document analysis, virtual receptionist, schedule generation, and AI-assisted workflows.</Text>
          <Callout>
            <Text style={styles.calloutText}><Text style={styles.calloutBold}>AI Authorization:</Text> By using the Services, you expressly authorize us to process your Customer Data through our AI systems to deliver these features.</Text>
          </Callout>
          <SubSection title="How AI Uses Your Data">
            <Bullet>Analyze documents, receipts, and photos you upload</Bullet>
            <Bullet>Generate estimates, reports, and schedule recommendations</Bullet>
            <Bullet>Power the AI virtual receptionist and chat assistant</Bullet>
            <Bullet>Provide context-aware suggestions within the platform</Bullet>
          </SubSection>
          <SubSection title="No External Model Training">
            <Text style={styles.p}>We will <Text style={styles.bold}>not</Text> use your Customer Data to train publicly available or third-party AI models without your explicit written consent.</Text>
          </SubSection>
          <SubSection title="AI Limitations">
            <Text style={styles.p}>AI outputs are informational only and may be inaccurate or incomplete. AI does not provide legal, engineering, safety, or compliance advice. You are solely responsible for verifying all AI-generated outputs.</Text>
          </SubSection>
        </Section>

        {/* Section 4 */}
        <Section number="4" title="Data Sharing &amp; Disclosure">
          <Text style={styles.p}>We do not sell your personal information. We may share your information only in these limited circumstances:</Text>
          <SubSection title="Service Providers">
            <Text style={styles.p}>We share data with trusted vendors contractually bound to protect your data:</Text>
            <Bullet>Supabase — database hosting and authentication</Bullet>
            <Bullet>Amazon Web Services (S3) — file and media storage</Bullet>
            <Bullet>Stripe — payment processing</Bullet>
            <Bullet>OpenAI — AI language model processing</Bullet>
            <Bullet>Twilio — SMS and voice communications</Bullet>
            <Bullet>Vercel — application hosting and infrastructure</Bullet>
          </SubSection>
          <SubSection title="Legal Requirements">
            <Text style={styles.p}>We may disclose your information if required by law, court order, or governmental authority.</Text>
          </SubSection>
          <SubSection title="Business Transfers">
            <Text style={styles.p}>In the event of a merger or acquisition, your information may be transferred. We will notify you of any such change.</Text>
          </SubSection>
        </Section>

        {/* Section 5 */}
        <Section number="5" title="No Sale of Data">
          <Callout green>
            <Text style={styles.calloutGreenText}><Text style={styles.calloutGreenBold}>We do not sell your personal information.</Text> Customer Data is never sold to data brokers, advertisers, or any third parties for their own commercial purposes.</Text>
          </Callout>
        </Section>

        {/* Section 6 */}
        <Section number="6" title="Aggregated &amp; Anonymized Data">
          <Text style={styles.p}>We may use aggregated, de-identified data that cannot identify any individual or company to improve the Services, analyze usage trends, and publish general statistics. Such data does not include personally identifiable information.</Text>
        </Section>

        {/* Section 7 */}
        <Section number="7" title="Data Retention">
          <Text style={styles.p}>We retain Customer Data for as long as your account is active. Upon termination, access ends immediately. Customer Data may be retained for a reasonable period to comply with legal obligations, then deleted or anonymized.</Text>
          <Text style={styles.p}>You may request deletion of your data by contacting us. We will fulfill requests subject to any legal retention obligations.</Text>
        </Section>

        {/* Section 8 */}
        <Section number="8" title="Data Security">
          <Text style={styles.p}>We implement commercially reasonable security measures including:</Text>
          <Bullet>Encryption of data in transit (TLS/HTTPS) and at rest</Bullet>
          <Bullet>Role-based access controls and row-level security</Bullet>
          <Bullet>Secure file storage on AWS S3 with access controls</Bullet>
          <Bullet>Authentication via Supabase Auth with support for MFA</Bullet>
          <Bullet>Regular security reviews and monitoring</Bullet>
          <Callout>
            <Text style={styles.calloutText}>No system is completely secure. You are responsible for maintaining the confidentiality of your account credentials. Contact us immediately if you suspect unauthorized access.</Text>
          </Callout>
        </Section>

        {/* Section 9 */}
        <Section number="9" title="Your Rights">
          <Text style={styles.p}>Depending on your location, you may have the right to:</Text>
          <Bullet>Access — request a copy of the personal information we hold about you</Bullet>
          <Bullet>Correction — request correction of inaccurate or incomplete information</Bullet>
          <Bullet>Deletion — request deletion of your personal information</Bullet>
          <Bullet>Portability — request a machine-readable copy of your data</Bullet>
          <Bullet>Restriction — request limits on how we process your data</Bullet>
          <Bullet>Objection — object to certain types of processing</Bullet>
          <Bullet>Withdraw Consent — withdraw consent where processing is based on consent</Bullet>
          <Text style={styles.p}>Contact us to exercise any of these rights. We will respond in accordance with applicable law.</Text>
        </Section>

        {/* Section 10 */}
        <Section number="10" title="California Privacy Rights (CCPA)">
          <Text style={styles.p}>If you are a California resident, the CCPA provides you with additional rights:</Text>
          <SubSection title="Right to Know">
            <Text style={styles.p}>You have the right to request disclosure of what personal information we collect, use, and disclose about you.</Text>
          </SubSection>
          <SubSection title="Right to Delete">
            <Text style={styles.p}>You have the right to request deletion of personal information we have collected, subject to certain exceptions.</Text>
          </SubSection>
          <SubSection title="Right to Non-Discrimination">
            <Text style={styles.p}>We will not discriminate against you for exercising your CCPA rights.</Text>
          </SubSection>
          <SubSection title="Do Not Sell My Personal Information">
            <Callout green>
              <Text style={styles.calloutGreenText}>We <Text style={styles.calloutGreenBold}>do not sell</Text> personal information to third parties. You do not need to opt out.</Text>
            </Callout>
          </SubSection>
        </Section>

        {/* Section 11 */}
        <Section number="11" title="Third-Party Services">
          <Text style={styles.p}>The Services integrate with third-party platforms that have their own privacy policies:</Text>
          <Bullet>Stripe — payment processing (stripe.com/privacy)</Bullet>
          <Bullet>Supabase — database and auth (supabase.com/privacy)</Bullet>
          <Bullet>OpenAI — AI language models (openai.com/policies/privacy-policy)</Bullet>
          <Bullet>Twilio — SMS and voice (twilio.com/legal/privacy)</Bullet>
          <Bullet>Amazon Web Services — file storage (aws.amazon.com/privacy)</Bullet>
          <Text style={styles.p}>We are not responsible for the privacy practices of these third parties.</Text>
        </Section>

        {/* Section 12 */}
        <Section number="12" title="Communications &amp; Marketing">
          <Text style={styles.p}>We may send transactional communications (billing, password resets, service alerts) which cannot be opted out of while you have an active account. Marketing emails include an unsubscribe link. Opting out of marketing does not affect transactional messages.</Text>
        </Section>

        {/* Section 13 — SMS */}
        <Section number="13" title="SMS / Text Messaging Privacy">
          <Text style={styles.p}>When you provide your phone number during account registration or subcontractor onboarding, you consent to receive automated SMS/text messages related to your use of the platform.</Text>
          <SubSection title="Types of Messages">
            <Text style={styles.p}>SMS messages are limited to transactional and operational notifications, including:</Text>
            <Bullet>Account verification codes</Bullet>
            <Bullet>Job assignment and schedule notifications</Bullet>
            <Bullet>Subcontractor registration invitations</Bullet>
            <Bullet>Project updates and task reminders</Bullet>
          </SubSection>
          <SubSection title="How We Use Your Phone Number">
            <Text style={styles.p}>Your phone number is used solely to deliver SMS messages related to the Legacy Prime platform. We do <Text style={styles.bold}>not</Text> sell, rent, or share your phone number or opt-in data with third parties for marketing or promotional purposes.</Text>
          </SubSection>
          <SubSection title="Message Frequency &amp; Rates">
            <Text style={styles.p}>Message frequency varies based on account activity (approximately up to 10 messages per month). <Text style={styles.bold}>Msg &amp; Data rates may apply</Text> based on your mobile carrier plan.</Text>
          </SubSection>
          <SubSection title="Opt-Out">
            <Text style={styles.p}>You may opt out of SMS messages at any time by replying <Text style={styles.bold}>STOP</Text> to any message. For help, reply <Text style={styles.bold}>HELP</Text> or contact support@legacyprime.com.</Text>
          </SubSection>
          <SubSection title="Third-Party Messaging Provider">
            <Text style={styles.p}>SMS messages are delivered via Twilio. Your phone number is shared with Twilio solely for message delivery. See Twilio's privacy policy at twilio.com/legal/privacy.</Text>
          </SubSection>
          <Text style={styles.p}>For full SMS terms, see Section 7 of our{' '}
            <Text style={styles.link} onPress={() => router.push('/terms')}>Terms &amp; Conditions</Text>.
          </Text>
        </Section>

        {/* Section 14 */}
        <Section number="14" title="Children's Privacy">
          <Text style={styles.p}>The Services are designed for business use and are not directed to individuals under 18. We do not knowingly collect personal information from minors. Contact us immediately if you believe we have inadvertently collected such information.</Text>
        </Section>

        {/* Section 15 */}
        <Section number="15" title="Changes to This Policy">
          <Text style={styles.p}>We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date and notify account administrators via email or in-app notification. Continued use of the Services after the effective date constitutes acceptance of the changes.</Text>
        </Section>

        {/* Section 16 */}
        <Section number="16" title="Contact Us">
          <Text style={styles.p}>For questions, requests, or concerns related to this Privacy Policy:</Text>
          <Callout>
            <Text style={styles.calloutText}>
              <Text style={styles.calloutBold}>Legacy Construction Consulting Inc.{'\n'}</Text>
              Privacy Inquiries{'\n'}
              Jurisdiction: King County, Washington{'\n'}
              Governing Law: State of Washington
            </Text>
          </Callout>
          <Text style={styles.p}>For Terms &amp; Conditions, see our{' '}
            <Text style={styles.link} onPress={() => router.push('/terms')}>Terms &amp; Conditions page</Text>.
          </Text>
        </Section>

      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Legacy Construction Consulting Inc.</Text>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => router.push('/terms')}>
            <Text style={styles.footerLink}>Terms &amp; Conditions</Text>
          </TouchableOpacity>
          <Text style={styles.footerSep}>·</Text>
          <Text style={styles.footerLinkActive}>Privacy Policy</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flexGrow: 1,
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 24,
  },
  headerInner: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navActiveChip: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navActiveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16A34A',
  },
  navLink: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // Page
  page: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 16,
  },

  // Hero
  hero: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 40,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#F0FDF4',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  heroMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  heroIntro: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  bold: {
    fontWeight: '600',
    color: '#1F2937',
  },

  // Section
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionNumber: {
    backgroundColor: '#F0FDF4',
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },

  // Subsection
  subsection: {
    marginTop: 16,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },

  // Text
  p: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 12,
  },
  link: {
    color: '#2563EB',
  },

  // Bullet
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  bulletDot: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 24,
  },
  bulletText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    flex: 1,
  },

  // Callout (amber)
  callout: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  calloutText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 22,
  },
  calloutBold: {
    fontWeight: '700',
    color: '#78350F',
  },

  // Callout (green)
  calloutGreen: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: '#16A34A',
  },
  calloutGreenText: {
    fontSize: 14,
    color: '#14532D',
    lineHeight: 22,
  },
  calloutGreenBold: {
    fontWeight: '700',
    color: '#166534',
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 12,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 12,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  tableCellRight: {
    color: '#6B7280',
  },
  tableSub: {
    color: '#6B7280',
    fontSize: 12,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLinkActive: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  footerSep: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  footerLink: {
    fontSize: 14,
    color: '#2563EB',
  },
});
