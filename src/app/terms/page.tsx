import { LegalPage } from '@/components/fk/LegalPage';

export const metadata = { title: 'Terms · Gist' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      lead="Short version. Last updated 9 October 2026."
      other={{ href: '/privacy', label: 'Read the Privacy notice' }}
      sections={[
        { h: 'What Gist is', p: 'Gist helps you think, remember and decide. It is not medical, legal, religious or mental health advice, and it is not a person.' },
        { h: 'Who can use it', p: 'You must be 16 or older. You are responsible for what you write and for the numbers you save.' },
        { h: 'Early product', p: 'This is an early test. Things will change and may break. Your data stays yours.' },
      ]}
    />
  );
}
