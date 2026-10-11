import { LegalPage } from '@/components/fk/LegalPage';

export const metadata = { title: 'Privacy · Gist' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      lead="In plain words. Last updated 9 October 2026."
      other={{ href: '/terms', label: 'Read the Terms' }}
      sections={[
        { h: 'What I keep', p: 'What you tell me and what I work out from it, marked as stated, observed or a guess. You can read it all in Life.' },
        { h: 'Who helps me reply', p: 'To write replies, your messages are sent to AI services. Right now that is Groq and, if it is down, Google. They are not used to advertise to you.' },
        { h: 'People you mention', p: "If you save someone's number, it stays on your account. I never message or call them." },
        { h: 'Your controls', p: 'Fix any line, forget it, export everything, or delete your account. Deleting removes it from my side too.' },
      ]}
    />
  );
}
