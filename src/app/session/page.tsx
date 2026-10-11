import { Button, Notice } from '@/components/fk';

export const metadata = { title: 'Log in again · Gist' };

export default function SessionEnded() {
  return (
    <Notice title="Log in again" body="Your session ended. Anything you wrote is saved on this phone and will send after you log in.">
      <Button variant="primary" hero href="/login">Log in again</Button>
    </Notice>
  );
}
