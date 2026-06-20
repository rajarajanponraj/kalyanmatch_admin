export default function RMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b p-4 bg-background">
        <h1 className="text-xl font-semibold">RM Portal</h1>
      </header>
      <main className="flex-1 p-8 bg-muted/40">
        {children}
      </main>
    </div>
  )
}
