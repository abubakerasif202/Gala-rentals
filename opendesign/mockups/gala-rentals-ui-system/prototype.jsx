const { useEffect, useMemo, useState } = React;

const variants = [
  { id: 'executive', label: 'Executive polish', note: 'Closest to the current navy and gold premium direction.' },
  { id: 'operations', label: 'Control room', note: 'Denser admin-first surface with stronger operational hierarchy.' },
  { id: 'trust', label: 'Trust-led public', note: 'Lighter public shell with luxury automotive restraint.' }
];

const screens = [
  ['public', 'Public site'],
  ['apply', 'Application'],
  ['admin', 'Admin ops'],
  ['payment', 'Payment'],
  ['documents', 'Documents'],
  ['customer', 'Customer status']
];

const seedApplications = [
  { id: 'APP-1048', name: 'Amelia Hart', email: 'amelia.hart@example.com', phone: '0412 482 915', status: 'Pending', experience: '3+ years', vehicle: 'To be assigned', weekly: 0, bond: 0, start: '2026-07-01' },
  { id: 'APP-1047', name: 'Rafi Mahmoud', email: 'rafi.mahmoud@example.com', phone: '0431 902 774', status: 'Approved', experience: '1-3 years', vehicle: 'Approved weekly rental package', weekly: 465, bond: 500, start: '2026-06-29' },
  { id: 'APP-1046', name: 'Grace Chen', email: 'grace.chen@example.com', phone: '0490 181 337', status: 'Paid', experience: '3+ years', vehicle: 'Approved subscription rental package', weekly: 440, bond: 500, start: '2026-06-27' },
  { id: 'APP-1045', name: 'Noah Williams', email: 'noah.williams@example.com', phone: '0406 333 119', status: 'Payment Review', experience: 'Less than 1 year', vehicle: 'Approved rental handover details', weekly: 420, bond: 500, start: '2026-06-28' },
  { id: 'APP-1044', name: 'Priya Singh', email: 'priya.singh@example.com', phone: '0422 118 405', status: 'Rejected', experience: 'New Driver', vehicle: 'To be assigned', weekly: 0, bond: 0, start: '2026-07-04' }
];

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function badgeClass(status) {
  if (status === 'Paid') return 'badge paid';
  if (status === 'Approved') return 'badge approved';
  if (status === 'Payment Review') return 'badge review';
  if (status === 'Rejected' || status === 'Cancelled') return 'badge rejected';
  return 'badge pending';
}

function App() {
  const [variant, setVariant] = useStoredState('gala.variant', 'executive');
  const [screen, setScreen] = useStoredState('gala.screen', 'public');
  const [applyStep, setApplyStep] = useState(1);
  const [applications, setApplications] = useState(seedApplications);
  const [selectedId, setSelectedId] = useState('APP-1048');
  const [paymentLinkGenerated, setPaymentLinkGenerated] = useState(false);
  const [documentsGenerated, setDocumentsGenerated] = useState(1);
  const [notice, setNotice] = useState('');

  const selected = applications.find((item) => item.id === selectedId) || applications[0];
  const variantMeta = variants.find((item) => item.id === variant) || variants[0];

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  function updateSelected(patch) {
    setApplications((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function approveAndSendLink() {
    updateSelected({
      status: 'Approved',
      vehicle: 'Approved weekly rental package',
      weekly: 465,
      bond: 500
    });
    setPaymentLinkGenerated(true);
    flash('Pricing locked and secure Stripe checkout link generated. No rental row is created here.');
  }

  function markPaidOnly() {
    updateSelected({ status: 'Paid' });
    flash('Stripe checkout complete. Application marked Paid only; operational activation remains manual.');
  }

  function generateAgreement() {
    if (selected.status !== 'Paid') {
      flash('Agreement generation unlocks after payment is recorded.');
      return;
    }
    setDocumentsGenerated((count) => count + 1);
    flash('Rental agreement generated and saved to the application history.');
  }

  return (
    <div className={`app-shell variant-${variant}`}>
      <div className="browser">
        <header className="topbar">
          <div className="brand">
            <img src="../../design-systems/gala-rentals/assets/logos/gala-logo-navbar.png" alt="Gala Rentals" />
          </div>
          <div className="switcher" aria-label="Design variations">
            {variants.map((item) => (
              <button key={item.id} className={`chip ${variant === item.id ? 'active' : ''}`} onClick={() => setVariant(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <button className="chip active" onClick={() => setScreen('admin')}>Live ops</button>
        </header>
        <div className="workspace">
          <aside className="side">
            <p className="side-title">Prototype map</p>
            <p className="side-copy">{variantMeta.note} All routes preserve review before payment and payment-only checkout completion.</p>
            <nav>
              {screens.map(([id, label]) => (
                <button key={id} className={`screen-btn ${screen === id ? 'active' : ''}`} onClick={() => setScreen(id)}>{label}</button>
              ))}
            </nav>
          </aside>
          <main className="canvas">
            <div className="notice">
              <p><strong>Workflow guardrail:</strong> Admin reviews first, then sends a secure Stripe checkout link. Stripe payment marks the application Paid only.</p>
              <span className={badgeClass(selected.status)}>{selected.status}</span>
            </div>
            {screen === 'public' && <PublicSite setScreen={setScreen} variant={variant} />}
            {screen === 'apply' && <ApplyFlow applyStep={applyStep} setApplyStep={setApplyStep} setScreen={setScreen} flash={flash} />}
            {screen === 'admin' && (
              <AdminOps
                applications={applications}
                selected={selected}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                setScreen={setScreen}
                approveAndSendLink={approveAndSendLink}
                markPaidOnly={markPaidOnly}
                paymentLinkGenerated={paymentLinkGenerated}
              />
            )}
            {screen === 'payment' && <PaymentScreen selected={selected} markPaidOnly={markPaidOnly} setScreen={setScreen} />}
            {screen === 'documents' && <Documents selected={selected} generateAgreement={generateAgreement} documentsGenerated={documentsGenerated} setScreen={setScreen} />}
            {screen === 'customer' && <CustomerStatus selected={selected} paymentLinkGenerated={paymentLinkGenerated} setScreen={setScreen} />}
          </main>
        </div>
      </div>
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

function PublicSite({ setScreen, variant }) {
  return (
    <section className="page">
      <div className="hero">
        <div className="panel">
          <p className="eyebrow">Premium Sydney rentals</p>
          <h1>{variant === 'operations' ? 'Rental operations that feel controlled.' : 'Subscription rentals made simple.'}</h1>
          <p className="lead">Flexible rental applications with a calm review process, admin-approved pricing, and a secure Stripe checkout link only after review.</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setScreen('apply')}>Start application</button>
            <button className="btn btn-secondary" onClick={() => setScreen('customer')}>Preview customer status</button>
          </div>
          <div className="stat-grid">
            <div className="stat"><strong>4</strong><span>Lifecycle steps</span></div>
            <div className="stat"><strong>0</strong><span>Payment before review</span></div>
            <div className="stat"><strong>AU</strong><span>Sydney service</span></div>
            <div className="stat"><strong>SSL</strong><span>Stripe checkout</span></div>
          </div>
        </div>
        <div className="vehicle-frame">
          <img src="/images/rental-service-hero.svg" alt="Secure rental approval process" />
          <div className="vehicle-caption">
            <p className="eyebrow">Application preview</p>
            <strong>Approved rental summary</strong>
            <p>Rental details are approved by admin before checkout.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ApplyFlow({ applyStep, setApplyStep, setScreen, flash }) {
  const steps = ['Personal', 'Driver', 'Preference', 'Documents', 'Review'];
  const canGoBack = applyStep > 1;
  const canGoNext = applyStep < steps.length;
  return (
    <section className="page two-col">
      <div className="panel">
        <p className="eyebrow">Customer application</p>
        <h2>Apply once. Let admin review before payment.</h2>
        <p className="lead">This flow keeps the current Gala model explicit: documents and driver details come first, payment is never requested until approval.</p>
        <div className="stepper">
          {steps.map((step, index) => <div key={step} className={`step ${applyStep === index + 1 ? 'active' : applyStep > index + 1 ? 'done' : ''}`}>{step}</div>)}
        </div>
        <div className="form-grid">
          {applyStep === 1 && (
            <>
              <label>Full name<input defaultValue="Amelia Hart" /></label>
              <label>Mobile<input defaultValue="0412 482 915" /></label>
              <label>Email<input defaultValue="amelia.hart@example.com" /></label>
              <label>Address<input defaultValue="Parramatta NSW" /></label>
            </>
          )}
          {applyStep === 2 && (
            <>
              <label>Licence state<select defaultValue="NSW"><option>NSW</option><option>VIC</option><option>QLD</option></select></label>
              <label>Licence number<input defaultValue="NSW492818" /></label>
              <label>Uber status<select defaultValue="Active"><option>Active</option><option>Applying</option><option>Not Yet Registered</option></select></label>
              <label>Experience<select defaultValue="3+ years"><option>New Driver</option><option>1-3 years</option><option>3+ years</option></select></label>
            </>
          )}
          {applyStep === 3 && (
            <>
              <label>Rental preference<input defaultValue="Flexible weekly rental" /></label>
              <label>Preferred start<input defaultValue="2026-07-01" /></label>
              <label>Weekly budget<input defaultValue="$420 to $480" /></label>
              <label>Duration<input defaultValue="12 weeks" /></label>
            </>
          )}
          {applyStep === 4 && (
            <>
              <label>Licence front<input value="licence-front.jpg selected" readOnly /></label>
              <label>Licence back<input value="licence-back.jpg selected" readOnly /></label>
              <label>Proof of address<input value="utility-bill.pdf selected" readOnly /></label>
              <label>Additional notes<input value="Ready from July" readOnly /></label>
            </>
          )}
          {applyStep === 5 && (
            <label style={{ gridColumn: '1 / -1' }}>Signature<textarea defaultValue="Amelia Hart confirms the submitted information is accurate and understands payment follows admin approval." /></label>
          )}
        </div>
        <div className="actions">
          <button className="btn btn-secondary" disabled={!canGoBack} onClick={() => setApplyStep(applyStep - 1)}>Back</button>
          {canGoNext ? (
            <button className="btn btn-primary" onClick={() => setApplyStep(applyStep + 1)}>Continue</button>
          ) : (
            <button className="btn btn-primary" onClick={() => { flash('Application submitted for admin review. No payment requested.'); setScreen('admin'); }}>Submit for review</button>
          )}
        </div>
      </div>
      <aside className="panel">
        <p className="eyebrow">Trust copy</p>
        <h3>What customers see</h3>
        <div className="timeline">
          <div className="timeline-item"><strong>1. Apply online</strong> Driver and document details are collected securely.</div>
          <div className="timeline-item"><strong>2. Admin review</strong> Gala checks the application and locks pricing.</div>
          <div className="timeline-item"><strong>3. Secure checkout</strong> Stripe link is sent only after approval.</div>
          <div className="timeline-item"><strong>4. Manual onboarding</strong> Handover and documents stay operationally controlled.</div>
        </div>
      </aside>
    </section>
  );
}

function AdminOps({ applications, selected, selectedId, setSelectedId, setScreen, approveAndSendLink, markPaidOnly, paymentLinkGenerated }) {
  const pending = applications.filter((item) => item.status === 'Pending').length;
  const paid = applications.filter((item) => item.status === 'Paid').length;
  return (
    <section className="page admin-layout">
      <div className="panel">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Admin operations</p>
            <h2>Application review queue</h2>
          </div>
          <button className="btn btn-secondary" onClick={() => setScreen('documents')}>Open documents</button>
        </div>
        <div className="stat-grid">
          <div className="stat"><strong>{applications.length}</strong><span>Applications</span></div>
          <div className="stat"><strong>{pending}</strong><span>Pending review</span></div>
          <div className="stat"><strong>{paid}</strong><span>Paid only</span></div>
          <div className="stat"><strong>$465</strong><span>Approved weekly</span></div>
        </div>
        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table>
            <thead>
              <tr><th>Driver</th><th>Status</th><th>Vehicle text</th><th>Weekly</th><th>Start</th><th>Action</th></tr>
            </thead>
            <tbody>
              {applications.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><br /><span className="mono">{item.id}</span></td>
                  <td><span className={badgeClass(item.status)}>{item.status}</span></td>
                  <td>{item.vehicle}</td>
                  <td>{item.weekly ? `$${item.weekly}/wk` : 'Approval needed'}</td>
                  <td>{item.start}</td>
                  <td><button className={`chip ${selectedId === item.id ? 'active' : ''}`} onClick={() => setSelectedId(item.id)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="panel">
        <p className="eyebrow">Detail drawer</p>
        <h2>{selected.name}</h2>
        <p className="lead">{selected.email} | {selected.phone}</p>
        <div className="detail-list">
          <div className="detail-row"><span>Status</span><strong>{selected.status}</strong></div>
          <div className="detail-row"><span>Experience</span><strong>{selected.experience}</strong></div>
          <div className="detail-row"><span>Approved vehicle</span><strong>{selected.vehicle}</strong></div>
          <div className="detail-row"><span>Bond</span><strong>{selected.bond ? `$${selected.bond}` : 'Not set'}</strong></div>
          <div className="detail-row"><span>Weekly</span><strong>{selected.weekly ? `$${selected.weekly}` : 'Not set'}</strong></div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" disabled={selected.status === 'Paid'} onClick={approveAndSendLink}>Approve and send link</button>
          <button className="btn btn-secondary" disabled={!paymentLinkGenerated && selected.status !== 'Approved'} onClick={() => setScreen('payment')}>Preview checkout</button>
          <button className="btn btn-secondary" disabled={selected.status !== 'Approved'} onClick={markPaidOnly}>Mark Stripe paid</button>
          <button className="btn btn-danger" disabled={selected.status === 'Paid'}>Reject</button>
        </div>
        <div className="timeline">
          <div className="timeline-item"><strong>Application received</strong> Documents and licence fields captured.</div>
          <div className="timeline-item"><strong>Admin approval required</strong> Pricing and vehicle text must be locked before payment.</div>
          <div className="timeline-item"><strong>Payment-only checkout</strong> Paid status does not create a rental automatically.</div>
        </div>
      </aside>
    </section>
  );
}

function PaymentScreen({ selected, markPaidOnly, setScreen }) {
  return (
    <section className="page two-col">
      <div className="panel">
        <p className="eyebrow">Secure Stripe handoff</p>
        <h2>Approved payment summary</h2>
        <p className="lead">Customer payment screen shows only locked admin-approved values. The continue action leaves the prototype as a payment-only state transition.</p>
        <div className="detail-list">
          <div className="detail-row"><span>Application</span><strong>{selected.id}</strong></div>
          <div className="detail-row"><span>Approved rental</span><strong>{selected.vehicle}</strong></div>
          <div className="detail-row"><span>Bond</span><strong>${selected.bond || 500}.00</strong></div>
          <div className="detail-row"><span>Weekly rental</span><strong>${selected.weekly || 465}.00</strong></div>
          <div className="detail-row"><span>Start date</span><strong>{selected.start}</strong></div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={markPaidOnly}>Simulate Stripe paid</button>
          <button className="btn btn-secondary" onClick={() => setScreen('admin')}>Back to admin</button>
        </div>
      </div>
      <div className="vehicle-frame">
        <img src="/images/rental-payment-security.svg" alt="Secure rental approval process" />
        <div className="vehicle-caption">
          <p className="eyebrow">Checkout note</p>
          <strong>Payment confirms billing only</strong>
          <p>Operations still handles handover, documents, and activation manually.</p>
        </div>
      </div>
    </section>
  );
}

function Documents({ selected, generateAgreement, documentsGenerated, setScreen }) {
  return (
    <section className="page">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Documents and notices</p>
          <h2>Agreement, toll notice, invoice, and audit panels</h2>
        </div>
        <button className="btn btn-primary" onClick={generateAgreement}>Generate agreement</button>
      </div>
      <div className="document-grid">
        {[
          ['Rental agreement', selected.status === 'Paid' ? `${documentsGenerated} generated` : 'Unlocks after Paid'],
          ['Toll transfer notice', 'Draft ready'],
          ['Manual invoice', 'Open balance $0.00'],
          ['Driver documents', '3 private files'],
          ['Audit trail', '6 events'],
          ['Payment records', selected.status]
        ].map(([title, meta]) => (
          <article className="document-card" key={title}>
            <p className="eyebrow">{title}</p>
            <h3>{meta}</h3>
            <p className="lead" style={{ fontSize: 13 }}>Private operational records stay behind admin auth and use signed document access.</p>
          </article>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 18 }}>
        <p className="eyebrow">Audit timeline</p>
        <div className="timeline">
          <div className="timeline-item"><strong>Application submitted</strong> Customer accepted terms and uploaded required files.</div>
          <div className="timeline-item"><strong>Pricing approved</strong> Vehicle text, bond, and weekly rental locked by admin.</div>
          <div className="timeline-item"><strong>Checkout completed</strong> Status changed to Paid. No automatic rental created.</div>
          <div className="timeline-item"><strong>Agreement generated</strong> Uses approved manual vehicle text and current template version.</div>
        </div>
        <div className="actions"><button className="btn btn-secondary" onClick={() => setScreen('admin')}>Return to queue</button></div>
      </div>
    </section>
  );
}

function CustomerStatus({ selected, paymentLinkGenerated, setScreen }) {
  const statusCopy = selected.status === 'Paid'
    ? 'Payment received. Gala Rentals will complete handover, documents, and operational follow-up.'
    : selected.status === 'Approved'
      ? 'Approved. Your secure Stripe checkout link is ready.'
      : 'Application received. Gala Rentals is reviewing your details before payment is requested.';
  return (
    <section className="page">
      <div className="phone">
        <div className="phone-screen">
          <p className="eyebrow">Customer portal</p>
          <h2>My rental status</h2>
          <p className="lead">{statusCopy}</p>
          <div className="detail-list" style={{ marginTop: 20 }}>
            <div className="detail-row"><span>Status</span><strong>{selected.status}</strong></div>
            <div className="detail-row"><span>Vehicle</span><strong>{selected.vehicle}</strong></div>
            <div className="detail-row"><span>Weekly</span><strong>{selected.weekly ? `$${selected.weekly}` : 'After approval'}</strong></div>
            <div className="detail-row"><span>Start</span><strong>{selected.start}</strong></div>
          </div>
          <div className="actions">
            <button className="btn btn-primary" disabled={!paymentLinkGenerated && selected.status !== 'Approved'} onClick={() => setScreen('payment')}>Open checkout</button>
            <button className="btn btn-secondary">Contact support</button>
          </div>
          <div className="timeline">
            <div className="timeline-item"><strong>Apply</strong> Submitted online.</div>
            <div className="timeline-item"><strong>Review</strong> Admin confirms driver and pricing.</div>
            <div className="timeline-item"><strong>Pay</strong> Secure Stripe checkout after approval.</div>
            <div className="timeline-item"><strong>Handover</strong> Manual operational follow-up.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
