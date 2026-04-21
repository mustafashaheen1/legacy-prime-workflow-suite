import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

function Callout({ children }: { children: React.ReactNode }) {
  return <View style={styles.callout}>{children}</View>;
}

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#1E3A5F" />
          </TouchableOpacity>
          <Text style={styles.brandName}>Legacy Prime</Text>
          <View style={styles.nav}>
            <View style={styles.navActiveChip}>
              <Text style={styles.navActiveText}>Terms</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/privacy')}>
              <Text style={styles.navLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.page}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LEGAL</Text>
          </View>
          <Text style={styles.heroTitle}>Terms &amp; Conditions</Text>
          <Text style={styles.heroMeta}>
            Effective date: <Text style={styles.bold}>January 1, 2025</Text>
            {'  ·  '}
            Governing law: <Text style={styles.bold}>State of Washington</Text>
          </Text>
        </View>

        {/* Section 1 */}
        <Section number="1" title="Agreement to Terms">
          <Text style={styles.p}>These Terms and Conditions ("Terms") constitute a legally binding agreement between the Customer (individual or entity) and <Text style={styles.bold}>Legacy Construction Consulting Inc.</Text> ("Service Provider").</Text>
          <Text style={styles.p}>These Terms govern access to and use of <Text style={styles.bold}>Legacy Prime AI</Text>, including all software, mobile applications, AI tools, CRM, scheduling systems, communication tools, and marketplace features (collectively, the "Services").</Text>
          <Text style={styles.p}>By accessing or using the Services, Customer agrees to be bound by these Terms.</Text>
        </Section>

        {/* Section 2 */}
        <Section number="2" title="Privacy &amp; Data Protection">
          <Text style={styles.p}>Use of the Services is subject to the Privacy Policy, incorporated by reference into these Terms. Service Provider complies with applicable laws, including the California Consumer Privacy Act (CCPA).</Text>
          <SubSection title="Data Ownership">
            <Bullet>Customer retains full ownership of all Customer Data.</Bullet>
            <Bullet>Service Provider acts as a processor of Customer Data only as necessary to provide and improve the Services.</Bullet>
          </SubSection>
          <SubSection title="Data Usage">
            <Text style={styles.p}>Service Provider may use Customer Data to:</Text>
            <Bullet>Operate and maintain the Services</Bullet>
            <Bullet>Provide AI outputs and automation</Bullet>
            <Bullet>Improve platform performance and reliability</Bullet>
          </SubSection>
          <SubSection title="No Data Sale">
            <Text style={styles.p}>Customer Data is never sold to third parties.</Text>
          </SubSection>
        </Section>

        {/* Section 3 */}
        <Section number="3" title="Platform Structure (Multi-Tenant)">
          <Text style={styles.p}>Legacy Prime AI operates as a multi-tenant platform:</Text>
          <Bullet>Each Customer represents a company or organization.</Bullet>
          <Bullet>Customer is responsible for all End Users under their account.</Bullet>
          <Bullet>Admins control permissions and access for their organization.</Bullet>
          <Text style={styles.p}>All actions performed by End Users are legally attributed to the Customer.</Text>
        </Section>

        {/* Section 4 */}
        <Section number="4" title="Marketplace &amp; Network Features">
          <Text style={styles.p}>The Services may include a construction marketplace and network, allowing Customers to hire subcontractors, post jobs, rate/review users, and connect with vendors and professionals.</Text>
          <SubSection title="4.1 No Employment Relationship">
            <Text style={styles.p}>Service Provider is <Text style={styles.bold}>not</Text> an employer, broker, or agent, and does not guarantee the performance, licensing, or qualifications of any marketplace user.</Text>
          </SubSection>
          <SubSection title="4.2 Customer Responsibility">
            <Text style={styles.p}>Customers are solely responsible for vetting subcontractors, verifying licenses and insurance, and negotiating all agreements with third parties.</Text>
          </SubSection>
          <SubSection title="4.3 Ratings &amp; Reviews">
            <Text style={styles.p}>All submitted ratings or reviews must be truthful, non-defamatory, and lawful. Service Provider may remove content at its sole discretion.</Text>
          </SubSection>
          <SubSection title="4.4 Disputes Between Users">
            <Text style={styles.p}>Service Provider is not responsible for disputes between users. All disputes are handled solely between the parties involved.</Text>
          </SubSection>
        </Section>

        {/* Section 5 */}
        <Section number="5" title="AI Features &amp; Automation">
          <Text style={styles.p}>The Services include artificial intelligence tools. AI Features may rely on Customer Data and system-generated analysis to produce outputs.</Text>
          <SubSection title="5.1 Nature of AI Outputs">
            <Text style={styles.p}>AI outputs are <Text style={styles.bold}>informational only</Text> and may be inaccurate, incomplete, or misleading.</Text>
          </SubSection>
          <SubSection title="5.2 No Professional Advice">
            <Text style={styles.p}>AI Features do not provide legal advice, engineering validation, safety compliance determinations, or construction certification.</Text>
          </SubSection>
          <SubSection title="5.3 Customer Responsibility">
            <Text style={styles.p}>Customer must independently verify all AI outputs and maintain adequate human oversight over all AI-assisted decisions.</Text>
          </SubSection>
          <SubSection title="5.4 Prohibited Use of AI">
            <Callout>
              <Text style={styles.calloutText}><Text style={styles.calloutBold}>Customer may NOT use AI Features for:</Text> safety-critical decisions, regulatory compliance determinations, or automated legal or engineering conclusions without human review.</Text>
            </Callout>
          </SubSection>
        </Section>

        {/* Section 6 */}
        <Section number="6" title="Construction Compliance">
          <Text style={styles.p}>Legacy Prime AI is a <Text style={styles.bold}>project management and workflow tool only</Text>. Service Provider does not guarantee compliance with building codes, OSHA standards, permit requirements, or any other applicable federal, state, or local law.</Text>
          <Text style={styles.p}>Customer is solely responsible for ensuring all construction activities and operations comply with all applicable laws, regulations, and standards.</Text>
        </Section>

        {/* Section 7 */}
        <Section number="7" title="Messaging &amp; Communications">
          <Text style={styles.p}>The platform may allow SMS, email, or automated communications. Customer must comply with the Telephone Consumer Protection Act (TCPA) and all applicable communication laws, including obtaining proper consent, maintaining opt-out systems, and ensuring all communications are lawful.</Text>
          <Text style={styles.p}>Service Provider acts only as a technology provider and is not responsible for the content of any communications sent by Customer.</Text>

          <SubSection title="7.1 SMS / Text Messaging Terms">
            <Text style={styles.p}>By providing a phone number and creating an account on Legacy Prime, you consent to receive automated SMS/text messages from Legacy Prime related to your use of the Services. These messages may include:</Text>
            <Bullet>Account verification codes</Bullet>
            <Bullet>Job assignment and schedule notifications</Bullet>
            <Bullet>Subcontractor registration and onboarding invitations</Bullet>
            <Bullet>Project updates and task reminders</Bullet>
            <Bullet>Clock in/out confirmations</Bullet>
          </SubSection>

          <SubSection title="7.2 Message Frequency">
            <Text style={styles.p}>Message frequency varies based on your account activity. You may receive up to approximately 10 messages per month depending on project activity, job assignments, and account events. Message frequency is not fixed and depends on platform usage.</Text>
          </SubSection>

          <SubSection title="7.3 Message &amp; Data Rates">
            <Callout>
              <Text style={styles.calloutText}><Text style={styles.calloutBold}>Msg &amp; Data rates may apply.</Text> Your mobile carrier's standard messaging and data rates apply to all SMS/text messages sent and received. Legacy Prime is not responsible for any charges from your carrier.</Text>
            </Callout>
          </SubSection>

          <SubSection title="7.4 Opt-Out / How to Stop Messages">
            <Text style={styles.p}>You may opt out of receiving SMS messages at any time by replying <Text style={styles.bold}>STOP</Text> to any message. After opting out, you will receive a confirmation message and no further SMS messages will be sent unless you re-subscribe.</Text>
            <Text style={styles.p}>You may also opt out by contacting us at support@legacyprime.com.</Text>
          </SubSection>

          <SubSection title="7.5 Help">
            <Text style={styles.p}>For help with SMS messaging, reply <Text style={styles.bold}>HELP</Text> to any message, or contact support@legacyprime.com.</Text>
          </SubSection>

          <SubSection title="7.6 Consent">
            <Text style={styles.p}>By signing up for Legacy Prime and providing your phone number, you expressly consent to receive transactional and operational SMS/text messages. Consent is not required as a condition of purchase. You can opt out at any time.</Text>
          </SubSection>

          <SubSection title="7.7 Supported Carriers">
            <Text style={styles.p}>Messages are supported on all major U.S. carriers including AT&amp;T, T-Mobile, Verizon, Sprint, and others. Service availability may vary by carrier.</Text>
          </SubSection>

          <SubSection title="7.8 Privacy">
            <Text style={styles.p}>Your phone number and messaging data are handled in accordance with our Privacy Policy. We do not sell, rent, or share your phone number or opt-in data with third parties for marketing purposes. Your information is used solely to deliver SMS messages related to your use of the Legacy Prime platform.</Text>
          </SubSection>
        </Section>

        {/* Section 8 */}
        <Section number="8" title="Payments &amp; Subscriptions">
          <SubSection title="8.1 Billing">
            <Text style={styles.p}>The Services are offered on a subscription basis with automatic renewal.</Text>
          </SubSection>
          <SubSection title="8.2 No Refund Policy">
            <Text style={styles.p}>All payments are <Text style={styles.bold}>non-refundable</Text> unless otherwise required by applicable law.</Text>
          </SubSection>
          <SubSection title="8.3 Failed Payments">
            <Text style={styles.p}>Failure to maintain a valid payment method may result in suspension or termination of access to the Services.</Text>
          </SubSection>
          <SubSection title="8.4 Chargebacks">
            <Callout>
              <Text style={styles.calloutText}>Unauthorized chargebacks may result in <Text style={styles.calloutBold}>immediate account termination</Text> and potential legal action.</Text>
            </Callout>
          </SubSection>
        </Section>

        {/* Section 9 */}
        <Section number="9" title="Intellectual Property">
          <Text style={styles.p}>All intellectual property rights in the platform, software, AI models, designs, and systems are owned exclusively by Service Provider or its licensors. Customer receives a limited, non-exclusive license to use the Services for internal business purposes.</Text>
          <Text style={styles.p}>Customer may not copy or replicate the platform, reverse engineer it, build competing software based on it, or sublicense access to it.</Text>
        </Section>

        {/* Section 10 */}
        <Section number="10" title="Data Security &amp; Limitations">
          <Text style={styles.p}>Service Provider uses commercially reasonable security measures to protect Customer Data. However, no system is completely secure. Customer is responsible for safeguarding account credentials and promptly notifying Service Provider of any unauthorized access.</Text>
        </Section>

        {/* Section 11 */}
        <Section number="11" title="Limitation of Liability">
          <Text style={styles.p}>Service Provider's total liability shall not exceed the <Text style={styles.bold}>total fees paid by Customer in the last 12 months</Text>.</Text>
          <Text style={styles.p}>Service Provider is not liable for lost profits, data loss, business interruption, or indirect, incidental, or consequential damages.</Text>
        </Section>

        {/* Section 12 */}
        <Section number="12" title="Indemnification">
          <Text style={styles.p}>Customer agrees to indemnify Service Provider from claims arising from use of the Services, marketplace interactions, reliance on AI outputs, data misuse, or violation of any applicable law or these Terms.</Text>
        </Section>

        {/* Section 13 */}
        <Section number="13" title="Termination">
          <Text style={styles.p}>Service Provider may suspend or terminate Customer's account for violation of these Terms, non-payment, or misuse of the platform. Upon termination, access ends immediately, Customer Data may be deleted, and no refunds will be issued.</Text>
        </Section>

        {/* Section 14 */}
        <Section number="14" title="Force Majeure">
          <Text style={styles.p}>Service Provider is not liable for failures caused by natural disasters, internet outages, cloud provider failures, government actions, or other events outside its reasonable control.</Text>
        </Section>

        {/* Section 15 */}
        <Section number="15" title="Future Features">
          <Text style={styles.p}>Service Provider may introduce AI upgrades, marketplace expansions, and new modules at any time. All features remain subject to these Terms.</Text>
        </Section>

        {/* Section 16 */}
        <Section number="16" title="Governing Law">
          <Text style={styles.p}>These Terms are governed by the laws of the <Text style={styles.bold}>State of Washington</Text>. Any dispute shall be subject to the exclusive jurisdiction of the courts in <Text style={styles.bold}>King County, Washington</Text>.</Text>
        </Section>

        {/* Section 17 */}
        <Section number="17" title="Electronic Agreement">
          <Text style={styles.p}>Customer consents to electronic signatures and digital agreements. Acceptance through clicking "I Agree," checking a box, or continuing to use the Services constitutes a valid electronic signature.</Text>
        </Section>

        {/* Section 18 */}
        <Section number="18" title="Entire Agreement">
          <Text style={styles.p}>These Terms, together with the Privacy Policy and any other referenced policies, constitute the entire agreement between Customer and Service Provider and supersede all prior agreements.</Text>
        </Section>

        {/* Section 19 */}
        <Section number="19" title="Data Usage &amp; AI Processing">
          <SubSection title="19.1 Use of Customer Data">
            <Text style={styles.p}>Service Provider may process Customer Data solely to operate the Services, provide AI outputs, and improve platform performance.</Text>
          </SubSection>
          <SubSection title="19.2 AI Processing Authorization">
            <Text style={styles.p}>Customer expressly authorizes Service Provider to process Customer Data through AI Features, including automated analysis and system-assisted decision support.</Text>
          </SubSection>
          <SubSection title="19.3 No External Model Training Without Consent">
            <Text style={styles.p}>Service Provider shall <Text style={styles.bold}>not</Text> use Customer Data to train external or publicly available AI models without Customer's explicit prior written consent.</Text>
          </SubSection>
          <SubSection title="19.4 Aggregated and Anonymized Data">
            <Text style={styles.p}>Service Provider may use aggregated, anonymized data that does not identify Customer to improve the Services and analyze trends.</Text>
          </SubSection>
          <SubSection title="19.5 Customer Representations">
            <Text style={styles.p}>Customer warrants it has all necessary rights and permissions to provide Customer Data, and that all required consents from individuals have been obtained.</Text>
          </SubSection>
          <SubSection title="19.6 AI Limitations">
            <Text style={styles.p}>AI outputs may be inaccurate or unreliable. Customer is solely responsible for verifying all outputs and decisions made with or without AI assistance.</Text>
          </SubSection>
        </Section>

      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Legacy Construction Consulting Inc.</Text>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLinkActive}>Terms &amp; Conditions</Text>
          <Text style={styles.footerSep}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy')}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
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
  backBtn: {
    padding: 8,
    marginRight: 8,
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navActiveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
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
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
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
    backgroundColor: '#EFF6FF',
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
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

  // Bullet
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  bulletDot: {
    color: '#2563EB',
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

  // Callout
  callout: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
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
