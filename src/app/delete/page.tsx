import { redirect } from 'next/navigation';

/** Deleting now lives under Settings, Your data. */
export default function DeleteRedirect() {
  redirect('/profile/data');
}
