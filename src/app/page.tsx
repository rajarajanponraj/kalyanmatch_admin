import { redirect } from 'next/navigation'

export default function RootPage() {
  // Redirect the root path to the admin dashboard
  redirect('/admin')
}
