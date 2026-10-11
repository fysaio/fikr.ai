import { Button, Notice } from '@/components/fk';

export default function NotFound() {
  return (
    <Notice title="I can't find that." body="The page may have moved, or the link is old.">
      <Button variant="primary" hero href="/today">Go to Today</Button>
    </Notice>
  );
}
