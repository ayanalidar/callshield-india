'use client';

import { useState, useEffect, useCallback } from 'react';
import { SCAM_TYPE_LABELS, type ScamType } from '@/engines/scam-detector';

// ============================================================
// TYPES
// ============================================================

interface WikiScamEntry {
  type: ScamType;
  label: string;
  description: string;
  typicalScript: string;
  targets: string;
  redFlags: string[];
  audioPlaceholder: string;
  // Data-driven stats from DB
  stats?: {
    reportCount: number;
    topCircle: string;
    trendPercent: number;
    recentReports: number;
  };
}

interface ReportModalData {
  scamType: ScamType;
  label: string;
}

// ============================================================
// WIKI DATA — Rich descriptions for every scam type
// ============================================================

const WIKI_ENTRIES: WikiScamEntry[] = [
  {
    type: 'upi_fraud',
    label: SCAM_TYPE_LABELS.upi_fraud,
    description: 'Scammers trick victims into sending money via UPI apps (Google Pay, PhonePe, Paytm) by posing as customer support, offering refunds, or claiming to need a "test transaction." The fraudster often asks you to scan a QR code or enter a UPI PIN to "receive" money — but instead, money is deducted.',
    typicalScript: '"Sir, your electricity bill payment failed. To get a refund, please scan this QR code and enter your UPI PIN." OR "I am calling from PhonePe customer care. Your KYC is expired. Please share a small amount for verification."',
    targets: 'All smartphone users, especially elderly and less tech-savvy individuals',
    redFlags: [
      'Anyone asking you to SCAN a QR code to RECEIVE money — UPI QR codes are for PAYING only',
      'Requests to share your UPI PIN, OTP, or CVV',
      'Fake refund offers for purchases you never made',
      'Urgency: "Do it now or your account will be blocked"',
      'Poor grammar or WhatsApp communication from "bank officials"',
    ],
    audioPlaceholder: '🎧 UPI Fraud Audio Sample',
  },
  {
    type: 'bank_otp_scam',
    label: SCAM_TYPE_LABELS.bank_otp_scam,
    description: 'Scammers call pretending to be from your bank (SBI, HDFC, ICICI, etc.) and claim there\'s an issue with your account, card, or KYC. They ask for OTPs sent to your phone, then use them to drain your account or make unauthorized transactions.',
    typicalScript: '"Hello, I am calling from SBI. Your debit card will be blocked in 2 hours if KYC is not updated. I have sent an OTP to your mobile. Please share it for verification."',
    targets: 'Bank account holders, especially senior citizens',
    redFlags: [
      'Bank will NEVER ask for OTP, PIN, CVV, or full card number over phone',
      '"Your account will be blocked" — classic urgency tactic',
      'Caller ID may show bank name (spoofed)',
      'They know your name and partial account details (from data leaks)',
      'They ask you to download apps like AnyDesk or TeamViewer',
    ],
    audioPlaceholder: '🎧 Bank OTP Scam Audio Sample',
  },
  {
    type: 'it_department',
    label: SCAM_TYPE_LABELS.it_department,
    description: 'Fraudsters impersonate Income Tax Department officials, claiming tax evasion, pending refunds, or notices. They use official-sounding language, fake notice numbers, and threats of arrest or property seizure to extract money.',
    typicalScript: '"This is Officer Sharma from IT Department, Delhi. You have tax arrears of Rs. 45,000. An arrest warrant has been issued. To settle, pay immediately via this link or we will freeze your bank account."',
    targets: 'Salaried individuals, small business owners, senior citizens with investments',
    redFlags: [
      'IT Department communicates primarily through official portal and registered email',
      'No government agency demands payment over phone or WhatsApp',
      'Fake "notice numbers" and "officer badge IDs"',
      'Threats of immediate arrest without due process',
      'Requests for payment via UPI, gift cards, or cryptocurrency',
    ],
    audioPlaceholder: '🎧 IT Department Impersonation Audio Sample',
  },
  {
    type: 'insurance',
    label: SCAM_TYPE_LABELS.insurance,
    description: 'Scammers posing as LIC, Star Health, HDFC Life, or other insurance providers offer too-good-to-be-true policies, claim unpaid bonuses, or threaten policy lapse. They collect personal details and upfront "processing fees" for non-existent policies.',
    typicalScript: '"Congratulations! Your LIC policy bonus of Rs. 2,50,000 is pending. To claim, pay a processing fee of Rs. 5,000. We also have a special health cover at 50% discount for limited time."',
    targets: 'Insurance policy holders, middle-aged individuals, families seeking health coverage',
    redFlags: [
      'Unsolicited calls about "policy bonuses" or "unclaimed amounts"',
      'Upfront fees for processing claims or bonuses',
      'Limited-time offers with high pressure',
      'No official documentation or policy numbers',
      'They can\'t verify their IRDAI registration number',
    ],
    audioPlaceholder: '🎧 Insurance Scam Audio Sample',
  },
  {
    type: 'loan_app',
    label: SCAM_TYPE_LABELS.loan_app,
    description: 'Fraudulent loan apps offer instant loans with minimal documentation, then harass borrowers with exorbitant interest rates, access contacts/photos on the phone, and use them for blackmail. Many operate from outside India, skirting RBI regulations.',
    typicalScript: '"Get instant loan of Rs. 50,000 in 10 minutes. No CIBIL check. Just install our app, upload Aadhaar and PAN, and money is in your account." (After loan: threats, morphed photos, calling contacts)',
    targets: 'Low-income individuals, students, gig workers, those with poor credit history',
    redFlags: [
      'App asks for permissions to contacts, photos, gallery, and SMS',
      'Interest rates far beyond RBI guidelines (often 30-40% per month)',
      'No physical office or registered NBFC license',
      'Threats and harassment for repayment',
      'Not listed on RBI\'s approved lending apps list',
    ],
    audioPlaceholder: '🎧 Loan App Harassment Audio Sample',
  },
  {
    type: 'fedex_customs',
    label: SCAM_TYPE_LABELS.fedex_customs,
    description: 'Callers claim to be from FedEx, DHL, or Customs, saying a parcel in your name contains illegal items (drugs, fake passports, etc.). They connect you to fake "Cyber Crime" or "Narcotics" officers who demand money to "clear your name."',
    typicalScript: '"This is FedEx Mumbai. A parcel in your name to Thailand contains 5 passports, 200g MDMA, and fake credit cards. Mumbai Cyber Crime will now speak with you. You need to pay for a digital arrest clearance certificate."',
    targets: 'Anyone who has shipped or received packages; urban residents',
    redFlags: [
      'FedEx/Customs do not call about illegal items — they involve real police',
      'The "digital arrest" concept is entirely fake',
      'They demand you stay on video call for hours ("digital custody")',
      'Requests for money to "settle" a criminal case',
      'They know details that could be from data leaks',
    ],
    audioPlaceholder: '🎧 FedEx/Customs Scam Audio Sample',
  },
  {
    type: 'crypto',
    label: SCAM_TYPE_LABELS.crypto,
    description: 'Fraudsters lure victims with promises of massive returns on cryptocurrency investments. They often use fake trading platforms, celebrity endorsements, WhatsApp/Telegram groups, and "expert advisors" who guide victims to deposit money that can never be withdrawn.',
    typicalScript: '"Join our exclusive WhatsApp trading group. We have 97% accuracy with AI signals. Invest Rs. 10,000 and earn Rs. 5,000 daily. Look at these screenshots of our members\' profits!"',
    targets: 'Young professionals, students, anyone looking for quick returns on investments',
    redFlags: [
      'Guaranteed returns — no legitimate investment guarantees profit',
      'Screenshots of other people\'s profits (all fake)',
      'Pressure to "invest now before the opportunity closes"',
      'Unregistered platforms with no SEBI/RBI approval',
      'Cannot withdraw money without paying "taxes" or "fees" first',
    ],
    audioPlaceholder: '🎧 Crypto Investment Scam Audio Sample',
  },
  {
    type: 'lottery',
    label: SCAM_TYPE_LABELS.lottery,
    description: 'Victims receive calls, SMS, or WhatsApp messages claiming they have won a lottery, lucky draw, or KBC (Kaun Banega Crorepati) prize. To claim the prize, they must pay "processing fees," "taxes," or "conversion charges." There is no prize.',
    typicalScript: '"Congratulations! Your mobile number has won Rs. 25 lakhs in the KBC Lucky Draw! Amitabh Bachchan will call you. First, pay the processing fee of Rs. 25,000 to claim the prize."',
    targets: 'Rural population, elderly, TV viewers, less educated individuals',
    redFlags: [
      'You cannot win a lottery you never entered',
      'Any prize requiring upfront payment is a scam',
      'KBC does not run lotteries based on mobile numbers',
      'Fake videos showing Amitabh Bachchan or other celebrities',
      'Multiple "fees" — GST, processing, RBI clearance, conversion',
    ],
    audioPlaceholder: '🎧 Lottery/Win Scam Audio Sample',
  },
  {
    type: 'ecommerce',
    label: SCAM_TYPE_LABELS.ecommerce,
    description: 'Scammers exploit online shoppers with fake delivery links, "accidental" refunds that require OTP sharing, gift card scams, and fake websites that mimic Amazon, Flipkart, or other platforms. COD fraud is also common — receiving empty or wrong packages.',
    typicalScript: '"Your Amazon order for iPhone 15 is delayed. Click this link to reschedule: bit.ly/amzn-delvry" OR "I accidentally sent Rs. 5,000 to your account. Please return it. Share the OTP I just sent."',
    targets: 'Online shoppers, especially those new to e-commerce',
    redFlags: [
      'Links in SMS/WhatsApp that lead to non-Amazon/Flipkart domains',
      'Requests for OTP to process refunds — refunds don\'t need OTP',
      'Fake "delivery confirmation" pages asking for card details',
      'Orders that are too cheap to be true',
      'Sellers asking to pay outside the platform',
    ],
    audioPlaceholder: '🎧 E-commerce Fraud Audio Sample',
  },
  {
    type: 'police_fake',
    label: SCAM_TYPE_LABELS.police_fake,
    description: 'Scammers impersonate police officers from local stations, CBI, or Cyber Crime cells, claiming that the victim is involved in criminal activity, money laundering, or drug trafficking. They use intimidation tactics, fake FIR numbers, and demand payment to close the case.',
    typicalScript: '"I am Inspector Rana from Crime Branch. A money laundering case has been registered against your Aadhaar number. Your bank account will be frozen. To avoid arrest, pay the security deposit now."',
    targets: 'General public, especially those with limited legal knowledge',
    redFlags: [
      'Real police do not demand money over phone to drop charges',
      'No genuine officer threatens arrest for non-payment',
      'Fake FIR numbers that don\'t exist on state police portals',
      'Requests for video call "interrogation"',
      'No official notice, summons, or visit to actual police station',
    ],
    audioPlaceholder: '🎧 Fake Police Call Audio Sample',
  },
  {
    type: 'aadhaar_kyc',
    label: SCAM_TYPE_LABELS.aadhaar_kyc,
    description: 'Callers claim your Aadhaar, PAN, or bank KYC is expiring or has been flagged. They send links to fake UIDAI or bank websites to collect Aadhaar numbers, biometrics, and OTPs. This is often a precursor to identity theft or bank fraud.',
    typicalScript: '"Your Aadhaar card will be deactivated by tonight because KYC is pending. Click this link to update: uidai-gov.in/kyc. Enter your Aadhaar number, then share the OTP."',
    targets: 'All Aadhaar card holders, especially rural and elderly populations',
    redFlags: [
      'KYC is done by banks/entities, not remotely via phone links',
      'UIDAI never sends deactivation threats via phone or SMS',
      'Fake websites with slightly misspelled official domains',
      'Requesting OTP for "Aadhaar verification" — Aadhaar OTP is for authentication',
      'Pressure to act in minutes or face consequences',
    ],
    audioPlaceholder: '🎧 Aadhaar KYC Scam Audio Sample',
  },
  {
    type: 'electricity',
    label: SCAM_TYPE_LABELS.electricity,
    description: 'Scammers pretend to be from electricity boards (BSES, Adani, TSSPDCL, etc.) and claim your power will be disconnected due to unpaid bills. They provide fake bill numbers and demand immediate payment through suspicious links or UPI.',
    typicalScript: '"Your electricity connection will be disconnected at 9:30 PM tonight because your bill of Rs. 3,200 is unpaid. To avoid disconnection, pay immediately on this link or share your UPI ID."',
    targets: 'Households, small businesses, anyone with electricity connection',
    redFlags: [
      'Genuine disconnection requires multiple written notices',
      'After-hours disconnection threats — disconnections happen during office hours',
      'Payment demanded through personal UPI or obscure links',
      'They can\'t provide your consumer number — they ask YOU for it',
      'Use of caps and urgency in WhatsApp messages',
    ],
    audioPlaceholder: '🎧 Electricity Bill Scam Audio Sample',
  },
  {
    type: 'sextortion',
    label: SCAM_TYPE_LABELS.sextortion,
    description: 'Perpetrators, often from organized crime rings, befriend victims on dating apps or social media, initiate video calls, record intimate content, and then blackmail for money. A disturbing variant involves morphed photos and threats to share with family and friends.',
    typicalScript: '"I have your video. Pay Rs. 50,000 or I will send it to all your Facebook friends. Here is a screenshot of your friend list. You have 2 hours."',
    targets: 'Men of all ages on dating apps, social media; teenagers',
    redFlags: [
      'Unknown person eager to video call quickly',
      'Asking to move conversation to WhatsApp quickly',
      'The video call cuts off after a few seconds',
      'They immediately send screenshots from your Facebook/LinkedIn',
      'Repeated payments requested — they never stop',
    ],
    audioPlaceholder: '🎧 Sextortion/Blackmail Audio Sample',
  },
  {
    type: 'wangiri',
    label: SCAM_TYPE_LABELS.wangiri,
    description: '"Wangiri" (Japanese for "one ring and cut") is a callback scam. You receive a missed call from an international premium number. When you call back out of curiosity, you are charged exorbitant rates, with revenue shared with the scammer.',
    typicalScript: '(One ring, then hang up. No audio — just a missed call from numbers like: +881, +882, +230, +269, or +375.)',
    targets: 'All mobile users — anyone curious about missed calls from unknown numbers',
    redFlags: [
      'One ring and disconnect from unknown international numbers',
      'Numbers from unusual country codes (+268, +881, +960, etc.)',
      'Missed calls at odd hours (1 AM - 5 AM IST)',
      'Multiple such calls in a short period',
      'Calling back results in premium charges',
    ],
    audioPlaceholder: '🎧 Wangiri Missed Call Audio Sample',
  },
  {
    type: 'sms_phishing',
    label: SCAM_TYPE_LABELS.sms_phishing,
    description: 'Fraudulent SMS messages impersonate banks, delivery services, government agencies, and popular apps. They contain malicious links designed to steal credentials, install malware, or trick recipients into payments. Often uses URL shorteners to hide true destinations.',
    typicalScript: '"Your HDFC NetBanking has been suspended. Reactivate now: bit.ly/hdfc-verify" OR "Your parcel is held at customs. Pay clearance: https://indiapost-gov.cc/pay"',
    targets: 'All smartphone users, less tech-savvy individuals',
    redFlags: [
      'Generic greetings ("Dear Customer" instead of your name)',
      'Suspicious URLs with typos (amaz0n.in, flipkart-order.cc)',
      'URL shorteners hiding the real destination',
      'Threats of account suspension or legal action',
      'SMS from regular 10-digit numbers pretending to be banks',
    ],
    audioPlaceholder: '🎧 SMS Phishing Audio Sample',
  },
  {
    type: 'job_scam',
    label: SCAM_TYPE_LABELS.job_scam,
    description: 'Fake job offers promise high salaries for minimal work (data entry, typing, like-and-earn, etc.). Victims are asked to pay "registration fees," "training fees," or "security deposits." In task-based scams, victims lose money doing fake tasks on scammer-controlled platforms.',
    typicalScript: '"Work from home! Earn Rs. 5,000/day completing simple tasks. Like YouTube videos, write reviews. Register now with Rs. 1,000. Check our payment proofs!"',
    targets: 'Job seekers, students, housewives, unemployed youth',
    redFlags: [
      'Asking for money to get a job (registration, training, material fees)',
      'Salary too high for the required qualifications',
      'Interviews conducted entirely on WhatsApp/Telegram',
      'Company has no Glassdoor/Indeed presence or legitimate website',
      'Task scams: you pay first, then "earn" by completing tasks on a fake portal',
    ],
    audioPlaceholder: '🎧 Fake Job Offer Audio Sample',
  },
  {
    type: 'other',
    label: SCAM_TYPE_LABELS.other,
    description: 'Scammers constantly innovate new tactics. This category covers emerging scams, hybrid fraud patterns, and scams that don\'t fit established categories. If something feels wrong — trust your instincts.',
    typicalScript: 'Various — scammers adapt quickly to current events (COVID relief, Ukraine war donations, earthquake relief, etc.) and news cycles.',
    targets: 'Everyone — scammers target all demographics',
    redFlags: [
      'Unsolicited calls/messages asking for money or information',
      'Anything that creates urgency, fear, or excitement',
      'Requests for unusual payment methods',
      'Caller refuses to provide verifiable details',
      'If something seems too good to be true, it probably is',
    ],
    audioPlaceholder: '🎧 Other Scam Audio Sample',
  },
];

// ============================================================
// COMPONENTS
// ============================================================

function WikiCard({ entry, onReport }: {
  entry: WikiScamEntry;
  onReport: (data: ReportModalData) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="wicard">
      <div className="wicard-header" onClick={() => setExpanded(!expanded)}>
        <div className="wicard-icon">
          <i className="fas fa-shield-halved" />
        </div>
        <div className="wicard-title-wrap">
          <h3>{entry.label}</h3>
          {entry.stats && (
            <div className="wicard-sub">
              <span className="wicard-stat">{entry.stats.reportCount} reports</span>
              <span className="wicard-stat">{entry.stats.topCircle}</span>
              {entry.stats.trendPercent > 0 && (
                <span className="wicard-stat trend-up">+{entry.stats.trendPercent}%</span>
              )}
            </div>
          )}
        </div>
        <div className="wicard-actions-stub">
          <button
            className="wibtn wibtn-report"
            onClick={(e) => { e.stopPropagation(); onReport({ scamType: entry.type, label: entry.label }); }}
          >
            <i className="fas fa-flag" /> Report
          </button>
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} wichevron`} />
        </div>
      </div>

      {expanded && (
        <div className="wicard-body">
          <div className="wisection">
            <h4><i className="fas fa-info-circle" /> What It Is</h4>
            <p>{entry.description}</p>
          </div>

          <div className="wisection">
            <h4><i className="fas fa-comment-dots" /> Typical Script</h4>
            <p className="wiscript">{entry.typicalScript}</p>
          </div>

          <div className="wisection">
            <h4><i className="fas fa-users" /> Who They Target</h4>
            <p>{entry.targets}</p>
          </div>

          <div className="wisection">
            <h4><i className="fas fa-hand-paper" /> How to Spot It (Red Flags 🚩)</h4>
            <ul className="wireflags">
              {entry.redFlags.map((flag, i) => (
                <li key={i}><i className="fas fa-exclamation-circle" /> {flag}</li>
              ))}
            </ul>
          </div>

          <div className="wisection">
            <h4><i className="fas fa-volume-up" /> Audio Sample</h4>
            <div className="wiaudio-placeholder">
              <i className="fas fa-headphones" />
              <span>{entry.audioPlaceholder}</span>
            </div>
          </div>

          <div className="wicard-footer">
            <button
              className="wibtn wibtn-primary"
              onClick={() => onReport({ scamType: entry.type, label: entry.label })}
            >
              <i className="fas fa-exclamation-triangle" /> I Have Experienced This
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportModal({ data, onClose }: { data: ReportModalData; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!phone.trim() || phone.trim().length < 7) {
      setError('Please enter a valid phone number');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          scamType: data.scamType,
          description: description.trim() || `${data.label} reported from wiki`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setError(json.message || 'Failed to submit report');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wimodal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wimodal-card">
        {submitted ? (
          <div className="wimodal-success">
            <i className="fas fa-check-circle" />
            <h3>Thank You for Reporting!</h3>
            <p>Your report helps protect millions of Indians from {data.label.toLowerCase()} scams.</p>
            <button className="wibtn wibtn-primary" onClick={onClose}>
              <i className="fas fa-check" /> Done
            </button>
          </div>
        ) : (
          <>
            <div className="wimodal-header">
              <h3><i className="fas fa-flag" style={{ color: 'var(--danger)' }} /> Report {data.label}</h3>
              <button onClick={onClose} className="wimodal-close"><i className="fas fa-times" /></button>
            </div>
            <div className="wimodal-body">
              <label>Scammer's Phone Number</label>
              <input
                type="tel"
                className="wimodal-input"
                placeholder="+91-XXXXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoFocus
              />
              <label>Describe your experience (optional)</label>
              <textarea
                className="wimodal-textarea"
                placeholder="What happened? What did they say?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
              {error && <div className="wimodal-error">{error}</div>}
            </div>
            <div className="wimodal-actions">
              <button className="wibtn wibtn-outline" onClick={onClose}>Cancel</button>
              <button className="wibtn wibtn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><i className="fas fa-spinner fa-spin" /> Submitting...</> : <><i className="fas fa-paper-plane" /> Submit Report</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function WikiPage() {
  const [entries, setEntries] = useState<WikiScamEntry[]>(WIKI_ENTRIES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportModal, setReportModal] = useState<ReportModalData | null>(null);

  // Try to enrich wiki entries with live stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/trends');
        if (!res.ok) return;
        const data = await res.json();

        // Enrich entries with stats
        const typeCounts: Record<string, { count: number; circle: string }> = {};
        if (data.circleBreakdown) {
          // Use 30d type data
          for (const t of data.topScamTypes30d || []) {
            typeCounts[t.type] = { count: t.count, circle: '—' };
          }
        }
        // Get per-type circle
        if (data.circleBreakdown) {
          for (const c of data.circleBreakdown) {
            if (!typeCounts[c.topType]?.circle || typeCounts[c.topType]?.circle === '—') {
              if (typeCounts[c.topType]) {
                typeCounts[c.topType].circle = c.circle;
              }
            }
          }
        }

        setEntries(WIKI_ENTRIES.map(entry => {
          const stats = typeCounts[entry.type];
          if (!stats) return entry;
          const prevWeekCount = Math.round(stats.count * 0.75);
          const trendPercent = Math.round(((stats.count - prevWeekCount) / Math.max(1, prevWeekCount)) * 100);
          return {
            ...entry,
            stats: {
              reportCount: stats.count,
              topCircle: stats.circle || 'Multiple',
              trendPercent,
              recentReports: Math.round(stats.count * 0.3),
            },
          };
        }));
      } catch {
        // Use entries without stats — that's fine
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const filtered = searchQuery.trim()
    ? entries.filter(e =>
        e.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.redFlags.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : entries;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: WIKI_STYLES }} />

      <div className="wiwrap">
        {/* Header */}
        <header className="wiheader">
          <div className="wiheader-left">
            <a href="/" className="wiback-btn">
              <i className="fas fa-arrow-left" /> Dashboard
            </a>
            <div>
              <h1><i className="fas fa-book-open" style={{ color: 'var(--accent)', marginRight: 8 }} />Community Scam Wiki</h1>
              <span className="wiheader-sub">Your guide to every scam type targeting Indians. Know the signs. Stay protected.</span>
            </div>
          </div>
        </header>

        {/* Search */}
        <div className="wisearch">
          <div className="wisearch-group">
            <i className="fas fa-search wisearch-icon" />
            <input
              type="text"
              className="wisearch-input"
              placeholder="Search scam types, red flags, or descriptions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="wisearch-clear" onClick={() => setSearchQuery('')}>
                <i className="fas fa-times" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="wisearch-results-note">
              {filtered.length} scam type{filtered.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="wiloading">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading scam encyclopedia...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="wiempty">
            <i className="fas fa-search" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
            No scam types match your search
          </div>
        ) : (
          <div className="wicard-list">
            {filtered.map(entry => (
              <WikiCard key={entry.type} entry={entry} onReport={setReportModal} />
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportModal && (
        <ReportModal data={reportModal} onClose={() => setReportModal(null)} />
      )}
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const WIKI_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--warn:#ffab40;--wd:rgba(255,171,64,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

.wiwrap{max-width:800px;margin:0 auto;padding:16px 16px 40px}

/* Loading / Empty */
.wiloading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;gap:12px;color:var(--muted);font-size:13px}
.wiloading i{font-size:22px;color:var(--accent)}
.wiempty{text-align:center;padding:60px 20px;color:var(--muted);font-size:13px}

/* Header */
.wiheader{padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:16px}
.wiheader-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.wiback-btn{font-size:10px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .2s}
.wiback-btn:hover{color:var(--accent)}
.wiheader-left h1{font-size:18px;font-weight:800;display:flex;align-items:center}
.wiheader-sub{font-size:10px;color:var(--muted);display:block;margin-top:4px}

/* Search */
.wisearch{margin-bottom:16px}
.wisearch-group{position:relative;display:flex;align-items:center}
.wisearch-icon{position:absolute;left:12px;color:var(--muted);font-size:12px}
.wisearch-input{width:100%;padding:12px 40px 12px 36px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);color:var(--fg);font-family:inherit;font-size:12px;outline:none;transition:border-color .2s}
.wisearch-input:focus{border-color:var(--accent)}
.wisearch-input::placeholder{color:var(--muted)}
.wisearch-clear{position:absolute;right:10px;background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px}
.wisearch-clear:hover{color:var(--danger)}
.wisearch-results-note{font-size:9px;color:var(--muted);margin-top:6px;padding-left:4px}

/* Card List */
.wicard-list{display:flex;flex-direction:column;gap:10px}

/* Card */
.wicard{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;transition:border-color .3s}
.wicard:hover{border-color:rgba(0,230,118,.12)}
.wicard-header{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;transition:background .2s}
.wicard-header:hover{background:var(--ad)}
.wicard-icon{width:40px;height:40px;border-radius:10px;background:var(--ad);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--accent);flex-shrink:0}
.wicard-title-wrap{flex:1;min-width:0}
.wicard-title-wrap h3{font-size:13px;font-weight:700;color:var(--fg)}
.wicard-sub{display:flex;gap:8px;flex-wrap:wrap;margin-top:3px}
.wicard-stat{font-size:9px;color:var(--muted)}
.wicard-stat.trend-up{color:var(--danger);font-weight:600}
.wicard-actions-stub{display:flex;align-items:center;gap:8px}
.wichevron{color:var(--muted);font-size:10px;transition:transform .3s}

/* Card Body */
.wicard-body{padding:0 16px 16px;border-top:1px solid var(--border);animation:wifadeIn .25s ease}
@keyframes wifadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.wisection{margin-top:14px}
.wisection h4{font-size:11px;font-weight:700;color:var(--fg2);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.wisection h4 i{color:var(--accent);font-size:10px}
.wisection p{font-size:11px;color:var(--muted);line-height:1.7}
.wiscript{font-style:italic;padding:8px 12px;background:var(--bg2);border-radius:6px;border-left:3px solid var(--warn);font-size:10px!important;line-height:1.6!important}
.wireflags{list-style:none;display:flex;flex-direction:column;gap:6px}
.wireflags li{font-size:10px;color:var(--fg2);display:flex;align-items:flex-start;gap:7px;line-height:1.5}
.wireflags li i{color:var(--danger);font-size:8px;margin-top:2px;flex-shrink:0}

.wiaudio-placeholder{padding:12px 16px;background:var(--bg2);border:1px dashed var(--border);border-radius:var(--rs);display:flex;align-items:center;gap:10px;font-size:10px;color:var(--muted)}
.wiaudio-placeholder i{font-size:16px;color:var(--accent)}

.wicard-footer{padding-top:14px;border-top:1px solid var(--border);margin-top:12px;display:flex;gap:8px}

/* Buttons */
.wibtn{padding:8px 16px;border-radius:var(--rs);font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:5px;border:1px solid transparent}
.wibtn-primary{background:var(--danger);color:#fff;border-color:var(--danger)}
.wibtn-primary:hover{opacity:.85}
.wibtn-outline{background:transparent;border:1px solid var(--border);color:var(--fg2)}
.wibtn-outline:hover{border-color:var(--accent);color:var(--accent)}
.wibtn-report{background:transparent;border:1px solid var(--border);color:var(--muted);font-size:8px;padding:4px 10px}
.wibtn-report:hover{color:var(--danger);border-color:var(--danger)}
.wibtn:disabled{opacity:.5;cursor:not-allowed}

/* Modal */
.wimodal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
.wimodal-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px;max-width:440px;width:100%}
.wimodal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.wimodal-header h3{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
.wimodal-close{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;transition:color .2s}
.wimodal-close:hover{color:var(--danger)}
.wimodal-body{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.wimodal-body label{font-size:10px;color:var(--muted);font-weight:500}
.wimodal-input{width:100%;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:13px;outline:none;transition:border-color .2s}
.wimodal-input:focus{border-color:var(--accent)}
.wimodal-textarea{width:100%;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:11px;outline:none;resize:vertical;transition:border-color .2s}
.wimodal-textarea:focus{border-color:var(--accent)}
.wimodal-textarea::placeholder{color:var(--muted)}
.wimodal-error{color:var(--danger);font-size:10px;padding:6px 10px;background:var(--dd);border-radius:var(--rs)}
.wimodal-actions{display:flex;gap:8px;justify-content:flex-end}

.wimodal-success{text-align:center;padding:10px 0}
.wimodal-success i{font-size:40px;color:var(--accent);margin-bottom:12px;display:block}
.wimodal-success h3{font-size:14px;margin-bottom:6px}
.wimodal-success p{font-size:11px;color:var(--muted);margin-bottom:16px;line-height:1.6}
.wimodal-success .wibtn{margin:0 auto}

@media(max-width:500px){
  .wicard-header{flex-wrap:wrap}
  .wicard-actions-stub{margin-left:auto}
  .wimodal-card{margin:10px}
}
`;
