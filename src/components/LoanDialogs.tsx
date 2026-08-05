import { useState } from 'react';
import { useApp } from '../state';
import type { Loan, LoanFeedback } from '../types';
import { Modal } from './Modal';

export function LoanFeedbackDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { dispatch } = useApp();
  const [onTime, setOnTime] = useState(true);
  const [condition, setCondition] = useState<LoanFeedback['condition']>('Same condition');
  const [note, setNote] = useState('');

  function submit() {
    dispatch({
      type: 'SUBMIT_FEEDBACK',
      feedback: {
        loanId: loan.id,
        onTime,
        condition,
        privateNote: note.trim() || undefined,
      },
    });
    onClose();
  }

  return (
    <Modal title="Complete the return" onClose={onClose}>
      <div className="feedback-form">
        <div className="feedback-check">✓</div>
        <h3>Book received</h3>
        <p>This feedback belongs to the borrowing family. It is not a public rating of a child.</p>
        <fieldset><legend>Was it returned on time?</legend><label><input type="radio" checked={onTime} onChange={() => setOnTime(true)} /> Yes</label><label><input type="radio" checked={!onTime} onChange={() => setOnTime(false)} /> No</label></fieldset>
        <label>Book condition<select value={condition} onChange={(event) => setCondition(event.target.value as LoanFeedback['condition'])}><option>Same condition</option><option>Minor additional wear</option><option>Material damage</option></select></label>
        <label>Private note for the circle administrator <span>(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></label>
        <button className="button button-primary button-full" type="button" onClick={submit}>Complete loan</button>
      </div>
    </Modal>
  );
}

export function HandoverContactDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { state } = useApp();
  const isLender = loan.lenderFamilyId === state.family.id;
  const name = isLender ? loan.borrowerName : loan.lenderName;
  return (
    <Modal title="Coordinate handover" onClose={onClose}>
      <div className="contact-preview">
        <span className="contact-preview-icon" aria-hidden="true">💬</span>
        <h3>{name}</h3>
        <p>WhatsApp sharing is enabled only for this matched family during the active handover or loan.</p>
        <div className="masked-contact"><small>Parent WhatsApp</small><strong>+91 ••••• ••112</strong></div>
        <button className="button button-whatsapp button-full" type="button" onClick={onClose}>Preview: Open WhatsApp</button>
        <small className="prototype-disclaimer">The preview never opens or messages a real number. Production contact sharing will require parent consent.</small>
      </div>
    </Modal>
  );
}
