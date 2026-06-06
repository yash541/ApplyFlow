// No GuestGuard or AuthGuard — verify pages need to be accessible
// to authenticated-but-unverified users
export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
