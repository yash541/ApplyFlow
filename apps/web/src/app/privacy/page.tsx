export const metadata = { title: "Privacy Policy — ApplyFlow AI" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2 text-indigo-400">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-12">Effective date: June 6, 2025 · ApplyFlow AI (applyflow.in)</p>

        <section className="space-y-10 text-white/80 leading-relaxed">

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">1. Who We Are</h2>
            <p>ApplyFlow AI ("ApplyFlow", "we", "our") is a job application management platform accessible at <strong>applyflow.in</strong> and via our Chrome browser extension. We help job seekers track applications, tailor resumes, and autofill job application forms using AI.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">2. What Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account information:</strong> Your name, email address, and hashed password when you register.</li>
              <li><strong>Profile data:</strong> Work experience, education, skills, contact information, and job preferences that you enter into your master profile for autofill purposes.</li>
              <li><strong>Resume content:</strong> Text extracted from resumes you upload (PDF, DOCX, or TXT).</li>
              <li><strong>Application data:</strong> Job titles, companies, URLs, and statuses of applications you track.</li>
              <li><strong>Job page content:</strong> Text from job listing pages read by the Chrome extension to generate match scores and extract job details. This data is sent to our API and processed by AI models.</li>
              <li><strong>Usage data:</strong> Monthly counts of features used (autofill sessions, match scores, resume tailorings) to enforce free-tier limits.</li>
              <li><strong>Payment information:</strong> Handled entirely by Razorpay. We store only your Razorpay customer ID and subscription ID — never your card details.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and operate the ApplyFlow service (resume tailoring, autofill, match scoring, application tracking).</li>
              <li>To authenticate your account and maintain your session securely.</li>
              <li>To send transactional emails (email verification, account notices) via Resend.</li>
              <li>To process subscription payments via Razorpay.</li>
              <li>To improve our AI models and service quality (in aggregate, anonymized form only).</li>
            </ul>
            <p className="mt-3">We do <strong>not</strong> sell your data. We do <strong>not</strong> use your data for advertising or profiling unrelated to the service.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">4. Chrome Extension Data Practices</h2>
            <p>The ApplyFlow Chrome Extension:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Reads job listing content (title, company, description) on LinkedIn and supported ATS platforms solely to generate match scores and autofill application forms.</li>
              <li>Stores your authentication token in <code className="bg-white/10 px-1 rounded text-sm">chrome.storage.local</code> to keep you logged in across browser sessions.</li>
              <li>Does <strong>not</strong> collect browsing history, track pages you visit outside job portals, or send any data to third parties other than the ApplyFlow API.</li>
              <li>Does <strong>not</strong> use remote code. All JavaScript is bundled locally in the extension package.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Anthropic:</strong> Job descriptions and resume text are sent to Anthropic's API to generate match scores and tailored content. Anthropic's privacy policy applies.</li>
              <li><strong>Razorpay:</strong> Payment processing. We never see or store your card details.</li>
              <li><strong>Resend:</strong> Transactional email delivery (verification emails only).</li>
              <li><strong>Railway:</strong> Our backend infrastructure hosting provider.</li>
              <li><strong>Vercel:</strong> Our frontend hosting provider.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. You may delete your account and all associated data at any time by contacting us at <strong>avulayashwanth64@gmail.com</strong>. Razorpay subscription records are retained per Razorpay's policies.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">7. Security</h2>
            <p>Passwords are hashed using bcrypt and never stored in plaintext. All data is transmitted over HTTPS. Authentication tokens expire after 24 hours. We take reasonable measures to protect your data but cannot guarantee absolute security.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <strong>avulayashwanth64@gmail.com</strong>. We will respond within 30 days.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify registered users of material changes via email. Continued use of ApplyFlow after changes constitutes acceptance of the updated policy.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p>For privacy-related questions, contact us at:<br />
            <strong>avulayashwanth64@gmail.com</strong><br />
            ApplyFlow AI · applyflow.in</p>
          </div>

        </section>
      </div>
    </div>
  );
}
