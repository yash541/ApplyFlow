"use client";

export default function DemoApplyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, background: "#6366f1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>A</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>Acme Corp — Senior Software Engineer</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>San Francisco, CA · Full-time · Remote OK</div>
        </div>
        <div style={{ marginLeft: "auto", padding: "6px 14px", background: "#ecfdf5", color: "#059669", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          🧪 ApplyFlow Autofill Test Page
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "32px auto", padding: "0 24px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "32px 36px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111" }}>Application Form</h1>
          <p style={{ margin: "0 0 28px", color: "#6b7280", fontSize: 14 }}>
            This page is for testing the ApplyFlow autofill extension. Open the extension, sign in, then click the <strong>⚡ Autofill</strong> badge that appears.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>

            {/* Personal Info */}
            <fieldset style={{ border: "none", margin: "0 0 28px", padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Personal Information</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label htmlFor="first_name" style={labelStyle}>First Name *</label>
                  <input id="first_name" name="first_name" type="text" placeholder="Jane" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="last_name" style={labelStyle}>Last Name *</label>
                  <input id="last_name" name="last_name" type="text" placeholder="Smith" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="email" style={labelStyle}>Email Address *</label>
                  <input id="email" name="email" type="email" placeholder="jane@example.com" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="phone" style={labelStyle}>Phone Number</label>
                  <input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="location" style={labelStyle}>Current Location</label>
                  <input id="location" name="location" type="text" placeholder="San Francisco, CA" style={inputStyle} />
                </div>
              </div>
            </fieldset>

            {/* Online Presence */}
            <fieldset style={{ border: "none", margin: "0 0 28px", padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Online Presence</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label htmlFor="linkedin" style={labelStyle}>LinkedIn URL</label>
                  <input id="linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/yourname" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="github" style={labelStyle}>GitHub URL</label>
                  <input id="github" name="github" type="url" placeholder="https://github.com/yourname" style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="website" style={labelStyle}>Personal Website / Portfolio</label>
                  <input id="website" name="website" type="url" placeholder="https://yoursite.com" style={inputStyle} />
                </div>
              </div>
            </fieldset>

            {/* Professional */}
            <fieldset style={{ border: "none", margin: "0 0 28px", padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Professional</legend>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label htmlFor="headline" style={labelStyle}>Current Job Title / Headline</label>
                  <input id="headline" name="headline" type="text" placeholder="Senior Software Engineer at XYZ" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="summary" style={labelStyle}>Cover Letter / Professional Summary</label>
                  <textarea id="summary" name="summary" rows={5} placeholder="Tell us about yourself and why you're interested in this role..." style={{ ...inputStyle, resize: "vertical" as const }} />
                </div>
                <div>
                  <label htmlFor="resume" style={labelStyle}>Resume / CV</label>
                  <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" style={{ ...inputStyle, padding: "8px 12px" }} />
                </div>
              </div>
            </fieldset>

            {/* Application Questions */}
            <fieldset style={{ border: "none", margin: "0 0 28px", padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Application Questions</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label htmlFor="work_authorization" style={labelStyle}>Work Authorization</label>
                  <select id="work_authorization" name="work_authorization" style={inputStyle}>
                    <option value="">Select…</option>
                    <option value="us_citizen">US Citizen</option>
                    <option value="green_card">Green Card / Permanent Resident</option>
                    <option value="h1b">H1B Visa</option>
                    <option value="opt">OPT / CPT</option>
                    <option value="tn">TN Visa</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="requires_sponsorship" style={labelStyle}>Require Visa Sponsorship?</label>
                  <select id="requires_sponsorship" name="requires_sponsorship" style={inputStyle}>
                    <option value="">Select…</option>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="years_experience" style={labelStyle}>Years of Experience</label>
                  <select id="years_experience" name="years_experience" style={inputStyle}>
                    <option value="">Select…</option>
                    <option value="0-2">0–2 years</option>
                    <option value="3-5">3–5 years</option>
                    <option value="6-10">6–10 years</option>
                    <option value="10+">10+ years</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="salary" style={labelStyle}>Expected Salary</label>
                  <input id="salary" name="salary" type="text" placeholder="e.g. USD 120,000" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="notice_period" style={labelStyle}>Notice Period / Availability</label>
                  <input id="notice_period" name="notice_period" type="text" placeholder="e.g. 2 weeks" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="remote_preference" style={labelStyle}>Work Preference</label>
                  <select id="remote_preference" name="remote_preference" style={inputStyle}>
                    <option value="">Select…</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="willing_to_relocate" style={labelStyle}>Willing to Relocate?</label>
                  <select id="willing_to_relocate" name="willing_to_relocate" style={inputStyle}>
                    <option value="">Select…</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {/* EEO */}
            <fieldset style={{ border: "none", margin: "0 0 32px", padding: "20px", background: "#f9fafb", borderRadius: 8 }}>
              <legend style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, paddingInline: 4 }}>Voluntary EEO Information</legend>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9ca3af" }}>Optional — responses do not affect hiring decisions.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label htmlFor="gender" style={labelStyle}>Gender</label>
                  <select id="gender" name="gender" style={inputStyle}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ethnicity" style={labelStyle}>Ethnicity</label>
                  <select id="ethnicity" name="ethnicity" style={inputStyle}>
                    <option value="">Prefer not to say</option>
                    <option value="asian">Asian</option>
                    <option value="black">Black or African American</option>
                    <option value="hispanic">Hispanic or Latino</option>
                    <option value="white">White</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="veteran_status" style={labelStyle}>Veteran Status</label>
                  <select id="veteran_status" name="veteran_status" style={inputStyle}>
                    <option value="">Prefer not to say</option>
                    <option value="not_veteran">I am not a veteran</option>
                    <option value="veteran">I am a veteran</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="disability_status" style={labelStyle}>Disability Status</label>
                  <select id="disability_status" name="disability_status" style={inputStyle}>
                    <option value="">Prefer not to say</option>
                    <option value="no">No disability</option>
                    <option value="yes">Yes, I have a disability</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <button type="submit" style={{ width: "100%", padding: "12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Submit Application
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px",
  border: "1px solid #d1d5db", borderRadius: 7, fontSize: 14, color: "#111",
  outline: "none", background: "#fff",
};
