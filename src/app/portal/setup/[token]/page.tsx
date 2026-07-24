import SetupForm from './setup-form'

export default async function PortalSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SetupForm token={token} />
}
